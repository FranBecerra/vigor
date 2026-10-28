import type { BioNightAnalysis, BioSleepEpisode } from '@/models/bioNight';
import { buildReadinessIndex } from '../readinessIndex';
import { validSleepGoal } from '../sleepGoal';
import { readinessFixture, READINESS_FIXTURE_NOW as now } from '@/test-support/readinessFixture';

const run = (analysis: BioNightAnalysis | undefined = readinessFixture(), goal: unknown = 480, at = now) => buildReadinessIndex(analysis, goal, at);
function set(episode: BioSleepEpisode, metric: string, value: number) { episode.cardiac.find((entry) => entry.metric === metric)!.median = value; }
it('publishes a versioned experimental index, separate components and reproducible coverage without mutating input', () => {
  const analysis = readinessFixture(), before = JSON.stringify(analysis), result = run(analysis);
  expect(result).toMatchObject({ policy: 'RECOVERY_CONTEXT_V1', score: 100, coverage: 'ESTABLISHED', reasons: [],
    sleep: { score: 100, goalMinutes: 480, observedDays: 7 }, cardiac: { score: 100, hrv: { metric: 'HRV_RMSSD', baselineDays: 35, referenceWindows: 33 } } });
  expect(JSON.stringify(analysis)).toBe(before);
  expect(run({ ...analysis, episodes: [...analysis.episodes].reverse(), references: { HRV_RMSSD: { days: 1000, median: 999 } } })).toEqual(result);
  expect(run(readinessFixture(21)).coverage).toBe('LIMITED');
});
it('rejects invalid/empty/error/truncated/unsupported inputs, future sleep and invalid clocks rather than inventing a score', () => {
  expect(buildReadinessIndex(undefined, 480, now).reasons).toEqual(['NO_OBSERVATIONS']);
  for (const status of ['EMPTY', 'ERROR', 'TRUNCATED', 'UNSUPPORTED']) expect(run({ ...readinessFixture(), status } as BioNightAnalysis).score).toBeUndefined();
  for (const at of [NaN, Infinity, 9e15]) expect(run(readinessFixture(), 480, at).reasons).toEqual(['NO_OBSERVATIONS']);
  for (const patch of [{ sourceId: '' }, { start: NaN }, { end: now + 1 }, { start: now }, { asleepMinutes: 0 },
    { asleepMinutes: NaN }, { asleepMinutes: 1000 }, { unobservedMinutes: -1 }, { unobservedMinutes: Infinity }, { unobservedMinutes: 49 }, { date: 'bad' }, { start: now - 2 * 86400000 }]) {
    const analysis = readinessFixture(); Object.assign(analysis.latest!, patch);
    expect(run(analysis).reasons).toEqual(['NO_OBSERVATIONS']);
  }
  expect(run({ ...readinessFixture(), policy: 'unknown' } as any).score).toBeUndefined();
  expect(run({ ...readinessFixture(), latest: undefined }).score).toBeUndefined();
});
it('expires after 36 hours even if the stored fresh flag is true, with an inclusive freshness boundary', () => {
  const analysis = readinessFixture(), end = analysis.latest!.end;
  expect(run(analysis, 480, end + 36 * 3600000).score).toBe(100);
  expect(run(analysis, 480, end + 36 * 3600000 + 1)).toMatchObject({ reasons: ['STALE'], coverage: 'INSUFFICIENT' });
  expect(run(analysis, 480, end + 36 * 3600000 + 1).score).toBeUndefined();
});
it('requires a deliberately configured goal, with strict bounds and no default taken from habitual sleep', () => {
  for (const goal of [undefined, null, '480', 239, 721, 480.5, NaN, Infinity]) {
    expect(validSleepGoal(goal)).toBe(false); const result = buildReadinessIndex(readinessFixture(), goal, now);
    expect(result.score).toBeUndefined(); expect(result.reasons).toContain('SLEEP_GOAL'); expect(result.cardiac.score).toBe(100);
  }
  expect(validSleepGoal(240)).toBe(true); expect(validSleepGoal(720)).toBe(true);
});
it('does not hide an adverse latest night behind a favorable weekly median or another cardiac signal', () => {
  const analysis = readinessFixture(); set(analysis.latest!, 'HEART_RATE', 56);
  const result = run(analysis);
  expect(result.cardiac.pulse).toMatchObject({ current: 56, recent: 50, currentDeviation: 3, score: 50 });
  expect(result.cardiac.hrv!.score).toBe(100); expect(result.cardiac.score).toBe(50); expect(result.score).toBe(60);
  set(analysis.latest!, 'HEART_RATE', 100); expect(run(analysis).score).toBe(10);
  set(analysis.latest!, 'HEART_RATE', 50); set(analysis.latest!, 'HRV_RMSSD', 35);
  expect(run(analysis).cardiac.score).toBe(0); expect(run(analysis).score).toBe(10);
});
it('retains an adverse rolling trend when the latest night has returned to its reference', () => {
  const analysis = readinessFixture(); analysis.episodes.slice(1, 7).forEach((episode) => set(episode, 'HEART_RATE', 56));
  const result = run(analysis);
  expect(result.cardiac.pulse).toMatchObject({ current: 50, currentDeviation: 0, recent: 56, trendDeviation: 3, score: 50 });
  expect(result.score).toBe(60);
});
it('uses personal spread rather than a fixed population deviation when sufficient variation exists', () => {
  const analysis = readinessFixture(43); analysis.episodes.slice(7).forEach((episode, index) => set(episode, 'HEART_RATE', index % 2 ? 46 : 54));
  set(analysis.latest!, 'HEART_RATE', 56);
  expect(run(analysis).cardiac.pulse!.currentDeviation).toBeCloseTo(1.0117, 3);
  expect(Number.isFinite(run(analysis).score)).toBe(true);
});
it('withholds unusual favorable cardiac outliers instead of awarding recovery points', () => {
  for (const metric of ['HRV_RMSSD', 'HEART_RATE']) {
    const analysis = readinessFixture(); set(analysis.latest!, metric, metric === 'HEART_RATE' ? 40 : 140);
    const result = run(analysis); expect(result.score).toBeUndefined(); expect(result.cardiac.score).toBeUndefined();
    expect(result.reasons).toContain('UNUSUAL_SIGNAL');
  }
});
it('separates source and method references and falls back only to a mature same-source SDNN series', () => {
  const analysis = readinessFixture(); analysis.episodes.slice(1).forEach((episode) => episode.cardiac = episode.cardiac.filter((entry) => entry.metric !== 'HRV_RMSSD'));
  expect(run(analysis).cardiac.hrv).toMatchObject({ metric: 'HRV_SDNN', baselineDays: 35, score: 100 });
  analysis.episodes.forEach((episode) => episode.cardiac = episode.cardiac.filter((entry) => entry.metric !== 'HRV_SDNN'));
  expect(run(analysis)).toMatchObject({ reasons: ['HRV_COVERAGE'], cardiac: { hrv: { metric: 'HRV_RMSSD', baselineDays: 0 } } });
  analysis.latest!.cardiac = analysis.latest!.cardiac.filter((entry) => entry.metric !== 'HRV_RMSSD');
  expect(run(analysis).cardiac.hrv!.current).toBeUndefined();
  const changed = readinessFixture(); changed.episodes.slice(7).forEach((episode) => episode.sourceId = 'new-device-or-software');
  expect(run(changed).score).toBeUndefined(); expect(run(changed).cardiac.pulse!.baselineDays).toBe(0);
});
it('rejects sparse, failed, truncated and implausible cardiac observations without renormalizing remaining inputs', () => {
  for (const patch of [{ status: 'EMPTY' }, { status: 'ERROR' }, { status: 'TRUNCATED' }, { status: 'UNSUPPORTED' },
    { median: undefined }, { median: NaN }, { median: 0 }, { median: 301 }, { samples: 2 }, { occupiedBins: 2 }, { occupiedBins: 7 }, { spanMinutes: 239 }, { spanMinutes: 481 }]) {
    const analysis = readinessFixture(); Object.assign(analysis.latest!.cardiac[0], patch);
    const result = run(analysis); expect(result.score).toBeUndefined(); expect(result.reasons).toContain('PULSE_COVERAGE');
  }
  const analysis = readinessFixture(); set(analysis.latest!, 'HRV_RMSSD', 2001); set(analysis.latest!, 'HRV_SDNN', 2001);
  expect(run(analysis).reasons).toContain('HRV_COVERAGE');
});
it('requires actual observed recent dates and references; gaps are not zeros and repeated dates add no evidence', () => {
  const analysis = readinessFixture(); analysis.episodes = analysis.episodes.filter((_episode, index) => index === 0 || index >= 7);
  expect(run(analysis)).toMatchObject({ reasons: ['SLEEP_COVERAGE', 'PULSE_COVERAGE', 'HRV_COVERAGE'], sleep: { observedDays: 1 } });
  expect(run(readinessFixture(20)).score).toBeUndefined();
  const duplicate = readinessFixture(); duplicate.episodes.push({ ...duplicate.latest!, id: 'duplicate' });
  expect(run(duplicate).reasons).toEqual(['NO_OBSERVATIONS']);
  const missing = readinessFixture(); missing.episodes = missing.episodes.slice(1); expect(run(missing).score).toBeUndefined();
  const extras = readinessFixture(); extras.episodes.push({ ...extras.latest!, id: 'nap', primary: false, asleepMinutes: 60 });
  expect(run(extras)).toEqual(run());
});
it('does not treat short habitual sleep as adequate or use extra sleep to cancel earlier shortfall', () => {
  const short = readinessFixture(); short.episodes.forEach((episode) => { episode.asleepMinutes = 360; episode.awakeMinutes = 120; });
  expect(run(short)).toMatchObject({ sleep: { score: 75 }, cardiac: { score: 100 }, score: 85 });
  const analysis = readinessFixture(); analysis.episodes.slice(1, 7).forEach((episode) => { episode.asleepMinutes = 240; });
  analysis.latest!.start -= 2 * 3600000; analysis.latest!.asleepMinutes = 600;
  analysis.latest!.cardiac.forEach((entry) => entry.spanMinutes = 400);
  expect(run(analysis).sleep.score).toBe(85); expect(run(analysis).score).toBe(90);
});
it('handles the minimum recent dates, reference window gate, daylight saving and shift-worker wake dates', () => {
  const analysis = readinessFixture(42); analysis.episodes = analysis.episodes.filter((_episode, index) => index < 3 || index >= 7);
  expect(run(analysis)).toMatchObject({ score: 100, coverage: 'LIMITED', sleep: { observedDays: 3 } });
  const sparse = readinessFixture(69); sparse.episodes = sparse.episodes.filter((_episode, index) => index < 7 || index >= 7 && (index - 7) % 4 === 0);
  expect(run(sparse).cardiac.pulse!.baselineDays).toBe(14); expect(run(sparse).cardiac.pulse!.referenceWindows).toBe(0);
  expect(run(sparse).score).toBeUndefined();
  const shifted = readinessFixture(42, new Date(2026, 9, 27, 20).getTime());
  shifted.episodes.forEach((episode) => { episode.start += 8 * 3600000; episode.end += 8 * 3600000; });
  expect(run(shifted, 480, new Date(2026, 9, 27, 20).getTime()).score).toBe(100);
});
