import { BIO_NIGHT_METRICS, type BioNightMetric, type BioNightRead, type BioNightSample } from '@/models/bioNight';
import { buildNightObservations, NIGHT_SAMPLE_LIMIT, nightWindowStart } from '../nightObservations';

const now = new Date(2026, 9, 27, 10).getTime(), minute = 60_000;
const end = new Date(2026, 9, 27, 7).getTime(), start = end - 8 * 60 * minute;
function sample(metric: BioNightMetric, patch: Partial<BioNightSample> = {}): BioNightSample {
  return { metric, id: `${metric}:1`, sourceId: 'watch:1', sourceName: 'Synthetic Watch', manuallyEntered: false,
    start: metric === 'SLEEP' ? start : start + minute, end: metric === 'SLEEP' ? end : start + minute,
    value: metric === 'SLEEP' ? 480 : metric === 'HEART_RATE' ? 55 : 40,
    ...(metric === 'SLEEP' ? { sleepState: 'ASLEEP' as const } : {}), ...patch };
}
function input(): BioNightRead {
  return { version: 1, metrics: Object.fromEntries(BIO_NIGHT_METRICS.map((metric) => [metric, {
    samples: [sample(metric)], error: false, truncated: false,
  }])) as BioNightRead['metrics'] };
}
it('keeps immutable source-matched sleep and HRV methods separate, with no numeric readiness', () => {
  const read = input(), before = JSON.stringify(read), result = buildNightObservations(read, now);
  expect(result.status).toBe('AVAILABLE'); expect(result.fresh).toBe(true);
  expect(result.latest).toMatchObject({ start, end, asleepMinutes: 480, awakeMinutes: 0, unobservedMinutes: 0, primary: true, date: '2026-10-27' });
  expect(result.latest!.cardiac.map((entry) => [entry.metric, entry.median, entry.samples])).toEqual([
    ['HEART_RATE', 55, 1], ['HRV_SDNN', 40, 1], ['HRV_RMSSD', 40, 1],
  ]);
  expect(result).not.toHaveProperty('score'); expect(result.references).toEqual({}); expect(JSON.stringify(read)).toBe(before);
});
it('merges overlaps, excludes awake/in-bed time and distinguishes unknown gaps from awake', () => {
  const read = input(); read.metrics.SLEEP.samples = [sample('SLEEP'), sample('SLEEP', { id: 'overlap', end: start + 30 * minute }),
    sample('SLEEP', { id: 'inbed', start: start - 30 * minute, sleepState: 'IN_BED' }),
    sample('SLEEP', { id: 'awake', start: start + 30 * minute, end: start + 60 * minute, sleepState: 'AWAKE' })];
  expect(buildNightObservations(read, now).latest).toMatchObject({ asleepMinutes: 450, awakeMinutes: 30, unobservedMinutes: 0 });
  read.metrics.SLEEP.samples = [sample('SLEEP', { end: start + 30 * minute }), sample('SLEEP', { id: 'later', start: start + 60 * minute })];
  expect(buildNightObservations(read, now).latest).toMatchObject({ asleepMinutes: 450, awakeMinutes: 0, unobservedMinutes: 30 });
});
it('includes only complete cardiac samples inside asleep intervals from the same source', () => {
  const read = input(); read.metrics.SLEEP.samples.push(sample('SLEEP', { id: 'awake', start: start + 30 * minute, end: start + 60 * minute, sleepState: 'AWAKE' }));
  read.metrics.HRV_SDNN.samples = [sample('HRV_SDNN'),
    sample('HRV_SDNN', { id: 'awake', start: start + 40 * minute, end: start + 40 * minute, value: 900 }),
    sample('HRV_SDNN', { id: 'other', sourceId: 'other', value: 900 }),
    sample('HRV_SDNN', { id: 'cross', start: start + 25 * minute, end: start + 35 * minute, value: 900 }),
    sample('HRV_SDNN', { id: 'at-end', start: end, end, value: 900 }),
    sample('HRV_SDNN', { id: 'before', start: start - minute, end: start, value: 900 })];
  expect(buildNightObservations(read, now).latest!.cardiac[1]).toMatchObject({ median: 40, samples: 1, occupiedBins: 1 });
});
it('reports distribution without inferring continuous coverage and exposes both HRV methods', () => {
  const read = input();
  read.metrics.HEART_RATE.samples = [sample('HEART_RATE'), sample('HEART_RATE', { id: 'late', start: end - minute, end: end - minute, value: 65 })];
  read.metrics.HRV_RMSSD.samples[0].value = 100;
  const cardiac = buildNightObservations(read, now).latest!.cardiac;
  expect(cardiac[0]).toMatchObject({ median: 60, samples: 2, occupiedBins: 2, spanMinutes: 478 });
  expect(cardiac[1].median).toBe(40); expect(cardiac[2].median).toBe(100);
});
it('explains empty matches without inferring permission denial or relaxing source/sleep admission', () => {
  const read = input();
  read.metrics.HEART_RATE.samples = [];
  read.metrics.HRV_SDNN.samples = [sample('HRV_SDNN', { sourceId: 'different-device' })];
  read.metrics.HRV_RMSSD.samples = [sample('HRV_RMSSD', { start: end, end })];
  const entries = buildNightObservations(read, now).latest!.cardiac;
  expect(entries.map((entry) => entry.missingReason)).toEqual(['NO_READABLE_SAMPLES', 'SOURCE_MISMATCH', 'OUTSIDE_SLEEP']);
  expect(entries.every((entry) => entry.status === 'EMPTY' && entry.median === undefined && entry.samples === 0)).toBe(true);
  read.metrics.HRV_SDNN.samples.push(sample('HRV_SDNN'));
  expect(buildNightObservations(read, now).latest!.cardiac[1]).toMatchObject({ status: 'AVAILABLE', median: 40 });
  expect(buildNightObservations(read, now).latest!.cardiac[1].missingReason).toBeUndefined();
});
it('preserves additional episodes, daytime sleep and deterministic source selection without selecting favorable HRV', () => {
  const read = input(); const napStart = new Date(2026, 9, 27, 8).getTime();
  read.metrics.SLEEP.samples.push(sample('SLEEP', { id: 'nap', start: napStart, end: napStart + 30 * minute }),
    sample('SLEEP', { id: 'other-source', sourceId: 'watch:2', sourceName: 'Another watch' }));
  // A gap of exactly 90 minutes joins an episode; this gap is 60, so move beyond it.
  read.metrics.SLEEP.samples[1].start = end + 100 * minute; read.metrics.SLEEP.samples[1].end = end + 120 * minute;
  const result = buildNightObservations(read, now);
  expect(result.episodes).toHaveLength(2); expect(result.latest!.asleepMinutes).toBe(480);
  expect(result.episodes[1].primary).toBe(false); expect(result.latest!.sourceId).toBe('watch:1');
  for (const metric of BIO_NIGHT_METRICS) read.metrics[metric].samples.reverse();
  expect(buildNightObservations(read, now)).toEqual(result);
  const daytime = input(); daytime.metrics.SLEEP.samples = [sample('SLEEP', { start: end - 4 * 60 * minute, end })];
  expect(buildNightObservations(daytime, now).latest!.asleepMinutes).toBe(240);
});
it('builds separate previous-night references, excluding today and other methods or sources', () => {
  const read = input();
  for (let index = 1; index <= 15; index++) for (const metric of BIO_NIGHT_METRICS) {
    const original = sample(metric); read.metrics[metric].samples.push({ ...original, id: `${metric}:day:${index}`,
      start: original.start - index * 86400000, end: original.end - index * 86400000,
      value: metric === 'HRV_RMSSD' ? 100 : original.value });
  }
  read.metrics.HRV_SDNN.samples[0].value = 1000;
  expect(buildNightObservations(read, now).references).toEqual({ SLEEP: { median: 480, days: 15 }, HEART_RATE: { median: 55, days: 15 },
    HRV_SDNN: { median: 40, days: 15 }, HRV_RMSSD: { median: 100, days: 15 } });
  read.metrics.HRV_RMSSD.samples = [sample('HRV_RMSSD')];
  expect(buildNightObservations(read, now).references.HRV_RMSSD).toBeUndefined();
  expect(buildNightObservations(read, now).references.HRV_SDNN!.days).toBe(15);
});
it('does not hide an acute bad night behind a rolling cardiac median', () => {
  const read = input();
  for (let index = 1; index <= 6; index++) {
    read.metrics.SLEEP.samples.push(sample('SLEEP', { id: `sleep:${index}`, start: start - index * 86400000, end: end - index * 86400000 }));
    read.metrics.HEART_RATE.samples.push(sample('HEART_RATE', { id: `pulse:${index}`, start: start - index * 86400000, end: start - index * 86400000 }));
  }
  read.metrics.HEART_RATE.samples[0].value = 85;
  expect(buildNightObservations(read, now).latest!.cardiac[0].median).toBe(85);
});
it('handles partial errors, absent types, unsupported RMSSD, truncation and incompatible payloads explicitly', () => {
  for (const [patch, expected] of [[{ error: true }, 'ERROR'], [{ truncated: true }, 'TRUNCATED'], [{ unsupported: true }, 'UNSUPPORTED'], [{ samples: null }, 'TRUNCATED']] as const) {
    const read = input(); Object.assign(read.metrics.HRV_RMSSD, patch);
    const result = buildNightObservations(read, now); expect(result.status).toBe('AVAILABLE'); expect(result.latest!.cardiac[2].status).toBe(expected);
    Object.assign(read.metrics.SLEEP, patch); expect(buildNightObservations(read, now).status).toBe(expected);
  }
  const read = input(); delete (read.metrics as any).HEART_RATE;
  expect(buildNightObservations(read, now).latest!.cardiac[0].status).toBe('ERROR');
  for (const invalid of [undefined, {}, { version: 0 }, { version: 1 }, { ...input(), version: 2 }]) expect(buildNightObservations(invalid as any, now).status).toBe('ERROR');
  expect(buildNightObservations(input(), NaN).status).toBe('ERROR');
  read.metrics.SLEEP.samples = Array(NIGHT_SAMPLE_LIMIT + 1).fill(sample('SLEEP'));
  expect(buildNightObservations(read, now).status).toBe('TRUNCATED');
});
it('rejects malformed/future/manual samples and duplicate conflicts without input-order dependence', () => {
  const read = input();
  for (const patch of [{ id: '' }, { sourceId: '' }, { sourceName: '' }, { start: NaN }, { end: now + 1 }, { manuallyEntered: true },
    { value: 0 }, { value: Infinity }, { metric: 'OTHER' }, { sleepState: 'UNKNOWN' }, { end: start }, { start: nightWindowStart(now) - 1 },
    { start: end + 1 }, { sourceId: 'x'.repeat(501) }, { sourceName: 'x'.repeat(301) }, { id: 'x'.repeat(501) }]) {
    read.metrics.SLEEP.samples = [sample('SLEEP', patch as any)]; expect(buildNightObservations(read, now).status).toBe('EMPTY');
  }
  const data = input(); data.metrics.HEART_RATE.samples.push(sample('HEART_RATE'));
  expect(buildNightObservations(data, now).latest!.cardiac[0].samples).toBe(1);
  data.metrics.HEART_RATE.samples.push(sample('HEART_RATE', { value: 75 }));
  expect(buildNightObservations(data, now).latest!.cardiac[0].status).toBe('EMPTY');
  data.metrics.HEART_RATE.samples.reverse(); expect(buildNightObservations(data, now).latest!.cardiac[0].status).toBe('EMPTY');
  for (const metric of ['HEART_RATE', 'HRV_SDNN'] as const) {
    const invalid = input(); invalid.metrics[metric].samples = [sample(metric, { value: 3000 })];
    expect(buildNightObservations(invalid, now).latest!.cardiac.find((entry) => entry.metric === metric)!.status).toBe('EMPTY');
  }
});
it('keeps old data stale and measures real elapsed time across a DST transition', () => {
  expect(buildNightObservations(input(), now + 3 * 86400000).fresh).toBe(false);
  const read = input(), a = Date.parse('2026-10-25T01:30:00+02:00'), b = Date.parse('2026-10-25T03:30:00+01:00');
  read.metrics.SLEEP.samples = [sample('SLEEP', { start: a, end: b })];
  expect(buildNightObservations(read, now).latest).toMatchObject({ asleepMinutes: 180, date: '2026-10-25' });
});
it('handles awake annotations before/over the episode and excludes implausibly continuous multi-day sleep', () => {
  const read = input(); read.metrics.SLEEP.samples.push(sample('SLEEP', { id: 'early-awake', start: start - 60 * minute,
    end: start - 30 * minute, sleepState: 'AWAKE' }));
  expect(buildNightObservations(read, now).latest!.asleepMinutes).toBe(480);
  read.metrics.SLEEP.samples.push(sample('SLEEP', { id: 'fully-awake', sleepState: 'AWAKE' }));
  expect(buildNightObservations(read, now).status).toBe('EMPTY');
  const long = input(); long.metrics.SLEEP.samples.push(sample('SLEEP', { id: 'continuation', start: start - 20 * 60 * minute, end: start + 4 * 60 * minute }));
  expect(buildNightObservations(long, now).status).toBe('EMPTY');
});
it('keeps afternoon/shift-worker sleep on its actual wake-date, with no noon split', () => {
  const read = input(), end = new Date(2026, 9, 26, 16).getTime(), start = new Date(2026, 9, 26, 8).getTime();
  read.metrics.SLEEP.samples = [sample('SLEEP', { start, end })];
  read.metrics.HEART_RATE.samples = [sample('HEART_RATE', { start: start + 3600000, end: start + 3600000 })];
  expect(buildNightObservations(read, now).latest).toMatchObject({ date: '2026-10-26', asleepMinutes: 480 });
  expect(buildNightObservations(read, now).latest!.cardiac[0].samples).toBe(1);
});
it('prefers a recent source over longer stale history and does not carry old-device references across', () => {
  const read = input(); read.metrics.SLEEP.samples = [];
  for (let index = 3; index <= 20; index++) read.metrics.SLEEP.samples.push(sample('SLEEP', {
    id: `old:${index}`, sourceId: 'watch:old-version', start: start - index * 86400000, end: end - index * 86400000,
  }));
  read.metrics.SLEEP.samples.push(sample('SLEEP', { sourceId: 'watch:new-version' }));
  const result = buildNightObservations(read, now);
  expect(result.latest!.sourceId).toBe('watch:new-version'); expect(result.references).toEqual({});
  expect(result.latest!.cardiac.every((entry) => entry.status === 'EMPTY')).toBe(true);
  // Among recently observed sources, more distinct wake-dates win, not higher pulse/HRV.
  read.metrics.SLEEP.samples.push(sample('SLEEP', { id: 'newer:1', sourceId: 'watch:stable', start: start - 86400000, end: end - 86400000 }),
    sample('SLEEP', { id: 'newer:2', sourceId: 'watch:stable' }));
  expect(buildNightObservations(read, now).latest!.sourceId).toBe('watch:stable');
});
