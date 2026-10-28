import { BIO_NIGHT_METRICS, type BioNightAnalysis, type BioNightCardiac, type BioNightInterval,
  type BioNightMetric, type BioNightRead, type BioNightResult, type BioNightSample, type BioSleepEpisode } from '@/models/bioNight';
import { localCheckInDate } from './dailyCheckIn';
import { median } from './healthTrends';

export const NIGHT_WINDOW_DAYS = 70;
export const NIGHT_SAMPLE_LIMIT = 50_000;
const MINUTE = 60_000;
// Episode grouping and reference coverage are product rules, not physiological cutoffs.
const EPISODE_GAP = 90 * MINUTE;
export function nightWindowStart(now: number): number {
  const date = new Date(now); date.setDate(date.getDate() - NIGHT_WINDOW_DAYS); date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function valid(sample: BioNightSample, metric: BioNightMetric, from: number, now: number): boolean {
  return !!sample && sample.metric === metric && typeof sample.id === 'string' && !!sample.id && sample.id.length <= 500
    && typeof sample.sourceId === 'string' && !!sample.sourceId && sample.sourceId.length <= 500
    && typeof sample.sourceName === 'string' && !!sample.sourceName && sample.sourceName.length <= 300
    && sample.manuallyEntered === false && Number.isFinite(sample.start) && sample.start >= from
    && Number.isFinite(sample.end) && sample.end >= sample.start && sample.end <= now
    && Number.isFinite(sample.value) && sample.value > 0
    && (metric === 'SLEEP'
      ? sample.end > sample.start && sample.end - sample.start <= 24 * 60 * MINUTE
        && ['ASLEEP', 'AWAKE', 'IN_BED'].includes(sample.sleepState!)
      : sample.value <= (metric === 'HEART_RATE' ? 300 : 2000));
}
function resultStatus(result?: BioNightResult): BioNightCardiac['status'] {
  if (!result || result.error) return 'ERROR';
  if (result.truncated || !Array.isArray(result.samples) || result.samples.length > NIGHT_SAMPLE_LIMIT) return 'TRUNCATED';
  return result.unsupported ? 'UNSUPPORTED' : 'AVAILABLE';
}
function merge(intervals: readonly BioNightInterval[]): BioNightInterval[] {
  const merged: BioNightInterval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ start: interval.start, end: interval.end });
  }
  return merged;
}
const duration = (intervals: readonly BioNightInterval[]) => intervals.reduce((total, interval) => total + interval.end - interval.start, 0) / MINUTE;
function subtractAwake(asleep: BioNightInterval[], awake: BioNightInterval[]): BioNightInterval[] {
  const result: BioNightInterval[] = [];
  let index = 0;
  for (const interval of asleep) {
    let cursor = interval.start;
    while (index < awake.length && awake[index].end <= cursor) index++;
    for (let cut = index; cut < awake.length && awake[cut].start < interval.end; cut++) {
      if (awake[cut].start > cursor) result.push({ start: cursor, end: awake[cut].start });
      cursor = Math.max(cursor, awake[cut].end);
    }
    if (cursor < interval.end) result.push({ start: cursor, end: interval.end });
  }
  return result;
}
function summary(metric: Exclude<BioNightMetric, 'SLEEP'>, result: BioNightResult | undefined,
  samples: BioNightSample[], episode: BioSleepEpisode): BioNightCardiac {
  const status = resultStatus(result);
  const empty: BioNightCardiac = { metric, status, samples: 0, occupiedBins: 0, spanMinutes: 0 };
  if (status !== 'AVAILABLE') return empty;
  // Every accepted sample must fit wholly inside one asleep interval. Never prorate HRV.
  let lower = 0, upper = samples.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (samples[middle].start < episode.start) lower = middle + 1; else upper = middle;
  }
  const points: BioNightSample[] = [];
  let otherSourceInsideSleep = false;
  for (let index = lower; index < samples.length && samples[index].start < episode.end; index++) {
    const sample = samples[index];
    if (episode.asleep.some((interval) => sample.start >= interval.start && sample.start < interval.end && sample.end <= interval.end)) {
      if (sample.sourceId === episode.sourceId) points.push(sample);
      else otherSourceInsideSleep = true;
    }
  }
  if (!points.length) return { ...empty, status: 'EMPTY', missingReason: !samples.length ? 'NO_READABLE_SAMPLES'
    : otherSourceInsideSleep ? 'SOURCE_MISMATCH' : 'OUTSIDE_SLEEP' };
  const bins = new Set(points.map((sample) => Math.min(5, Math.floor((sample.start - episode.start) / (episode.end - episode.start) * 6))));
  const last = points.reduce((end, sample) => Math.max(end, sample.end), episode.start);
  return { metric, status: 'AVAILABLE', median: median(points.map((sample) => sample.value)), samples: points.length,
    occupiedBins: bins.size, spanMinutes: (last - points[0].start) / MINUTE };
}

/**
 * Source-specific sleep episodes and observations, not a recovery score.
 * The longest episode on each local wake-date is primary; others remain visible.
 * Unknown gaps are not called awake. A primary episode is not proof of a full night's sleep.
 */
export function buildNightObservations(input: BioNightRead, now: number): BioNightAnalysis {
  const empty: BioNightAnalysis = { policy: 'SLEEP_MATCHED_V1', status: 'EMPTY', episodes: [], fresh: false, references: {} };
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime()) || input?.version !== 1) return { ...empty, status: 'ERROR' };
  const sleepStatus = resultStatus(input.metrics?.SLEEP);
  if (sleepStatus !== 'AVAILABLE') return { ...empty, status: sleepStatus };
  const from = nightWindowStart(now);
  const observations = Object.fromEntries(BIO_NIGHT_METRICS.map((metric) => {
    const result = input.metrics[metric];
    const unique = new Map<string, BioNightSample | null>();
    if (resultStatus(result) === 'AVAILABLE') for (const sample of result.samples) {
      if (!valid(sample, metric, from, now)) continue;
      const key = `${sample.sourceId}:${sample.id}`, previous = unique.get(key);
      // A conflicting UUID is excluded rather than letting input order choose the value.
      if (previous === null || previous && (previous.start !== sample.start || previous.end !== sample.end || previous.value !== sample.value
        || previous.sleepState !== sample.sleepState || previous.sourceName !== sample.sourceName)) unique.set(key, null);
      else unique.set(key, sample);
    }
    return [metric, [...unique.values()].filter((sample): sample is BioNightSample => sample !== null)
      .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))];
  })) as Record<BioNightMetric, BioNightSample[]>;
  const sources = new Map<string, BioNightSample[]>();
  for (const sample of observations.SLEEP) {
    const list = sources.get(sample.sourceId) ?? []; list.push(sample); sources.set(sample.sourceId, list);
  }
  const episodes: BioSleepEpisode[] = [];
  for (const [sourceId, samples] of sources) {
    const awakeIntervals = merge(samples.filter((sample) => sample.sleepState === 'AWAKE'));
    const asleep = subtractAwake(merge(samples.filter((sample) => sample.sleepState === 'ASLEEP')), awakeIntervals);
    const groups: BioNightInterval[][] = [];
    for (const interval of asleep) {
      const last = groups.at(-1);
      if (last && interval.start - last.at(-1)!.end <= EPISODE_GAP) last.push(interval);
      else groups.push([interval]);
    }
    for (const group of groups) {
      const start = group[0].start, end = group.at(-1)!.end;
      if (end - start > 24 * 60 * MINUTE) continue;
      const awake = merge(awakeIntervals.filter((sample) => sample.start < end && sample.end > start)
        .map((sample) => ({ start: Math.max(start, sample.start), end: Math.min(end, sample.end) })));
      const asleepMinutes = duration(group), knownMinutes = duration(merge([...group, ...awake]));
      // Overlapping contradictory labels do not inflate either total.
      const awakeMinutes = Math.max(0, knownMinutes - asleepMinutes);
      episodes.push({ id: `${sourceId}:${start}`, sourceId, sourceName: samples[0].sourceName, date: localCheckInDate(end), start, end,
        asleepMinutes, awakeMinutes, unobservedMinutes: Math.max(0, (end - start) / MINUTE - knownMinutes),
        asleep: group, primary: false, cardiac: [] });
    }
  }
  // Deterministic selection, independent of input ordering. Do not select by favorable values.
  const candidates = [...sources.keys()].map((sourceId) => {
    const entries = episodes.filter((episode) => episode.sourceId === sourceId);
    return { sourceId, recent: Math.max(0, ...entries.map((episode) => episode.end)) >= now - 36 * 3600000,
      days: new Set(entries.map((episode) => episode.date)).size };
  }).sort((a, b) => Number(b.recent) - Number(a.recent) || b.days - a.days || a.sourceId.localeCompare(b.sourceId));
  const selected = candidates.find((candidate) => candidate.days > 0);
  if (!selected) return empty;
  const chosen = episodes.filter((episode) => episode.sourceId === selected.sourceId).sort((a, b) => a.start - b.start);
  const primaryByDate = new Map<string, BioSleepEpisode>();
  for (const episode of chosen) {
    const previous = primaryByDate.get(episode.date);
    if (!previous || episode.asleepMinutes > previous.asleepMinutes) primaryByDate.set(episode.date, episode);
    episode.cardiac = (['HEART_RATE', 'HRV_SDNN', 'HRV_RMSSD'] as const).map((metric) => summary(metric, input.metrics[metric], observations[metric], episode));
  }
  for (const episode of primaryByDate.values()) episode.primary = true;
  const latest = [...primaryByDate.values()].sort((a, b) => b.end - a.end)[0];
  const cutoff = new Date(latest.end); cutoff.setDate(cutoff.getDate() - 60);
  const previous = [...primaryByDate.values()].filter((episode) => episode.date < latest.date && episode.date >= localCheckInDate(cutoff.getTime()));
  const references: BioNightAnalysis['references'] = {};
  for (const metric of BIO_NIGHT_METRICS) {
    const values = previous.flatMap((episode) => {
      const observation = episode.cardiac.find((entry) => entry.metric === metric);
      return metric === 'SLEEP' ? [episode.asleepMinutes] : observation?.status === 'AVAILABLE' ? [observation.median!] : [];
    });
    if (values.length >= 14) references[metric] = { median: median(values), days: values.length };
  }
  return { policy: 'SLEEP_MATCHED_V1', status: 'AVAILABLE', episodes: chosen, latest,
    fresh: latest.end >= now - 36 * 3600000, references };
}
