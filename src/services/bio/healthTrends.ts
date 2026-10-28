import { BIO_HEALTH_METRICS, type BioHealthMetric, type BioHealthRead, type BioHealthSample, type BioHealthTrend, type BioHealthDay } from '@/models/bioHealth';
import { localCheckInDate } from './dailyCheckIn';

export const HEALTH_WINDOW_DAYS = 42;
export const HEALTH_REFERENCE_DAYS = 28;
export const HEALTH_REFERENCE_MIN_DAYS = 14;
const DAY = 86_400_000;
export const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
export function healthWindowStart(now: number): number {
  const start = new Date(now); start.setDate(start.getDate() - HEALTH_WINDOW_DAYS); start.setHours(0, 0, 0, 0);
  return start.getTime();
}
/** Sleep is attributed to the local day whose noon closes the interval. */
function sleepDate(end: number): string {
  const date = new Date(end);
  if (date.getHours() >= 12) date.setDate(date.getDate() + 1);
  return localCheckInDate(date.getTime());
}
function valid(sample: BioHealthSample, metric: BioHealthMetric, now: number): boolean {
  return sample?.metric === metric && typeof sample.id === 'string' && !!sample.id
    && typeof sample.sourceId === 'string' && !!sample.sourceId && sample.sourceId.length <= 500
    && typeof sample.sourceName === 'string' && !!sample.sourceName && sample.sourceName.length <= 300
    && sample.manuallyEntered === false && Number.isFinite(sample.start) && sample.start >= healthWindowStart(now)
    && Number.isFinite(sample.end) && sample.end >= sample.start && sample.end <= now
    && Number.isFinite(sample.value) && sample.value > 0
    && (metric === 'SLEEP' ? sample.end > sample.start && sample.end - sample.start <= DAY
      : sample.value <= (metric === 'RESTING_HR' ? 300 : 2000));
}
function sleepDays(samples: BioHealthSample[], today: string): BioHealthDay[] {
  const buckets = new Map<string, { start: number; end: number }[]>();
  for (const sample of samples) {
    // Split at local noons, including DST, before merging overlapping asleep stages.
    let cursor = sample.start;
    while (cursor < sample.end) {
      const boundary = new Date(cursor); boundary.setHours(12, 0, 0, 0);
      if (boundary.getTime() <= cursor) boundary.setDate(boundary.getDate() + 1);
      const end = Math.min(sample.end, boundary.getTime());
      const date = sleepDate(end - 1);
      if (date <= today) {
        const bucket = buckets.get(date) ?? []; bucket.push({ start: cursor, end }); buckets.set(date, bucket);
      }
      cursor = end;
    }
  }
  return [...buckets].map(([date, intervals]) => {
    intervals.sort((a, b) => a.start - b.start);
    let total = 0, start = intervals[0].start, end = intervals[0].end;
    for (const interval of intervals.slice(1)) {
      if (interval.start <= end) end = Math.max(end, interval.end);
      else { total += end - start; start = interval.start; end = interval.end; }
    }
    return { date, value: (total + end - start) / 60_000, at: end, samples: intervals.length };
  });
}
function quantityDays(samples: BioHealthSample[]): BioHealthDay[] {
  const buckets = new Map<string, BioHealthSample[]>();
  for (const sample of samples) {
    const date = localCheckInDate(sample.end), bucket = buckets.get(date) ?? []; bucket.push(sample); buckets.set(date, bucket);
  }
  return [...buckets].map(([date, entries]) => ({ date, value: median(entries.map((entry) => entry.value)),
    at: Math.max(...entries.map((entry) => entry.end)), samples: entries.length }));
}

/** Same-source daily medians and prior-day references; never pool different devices. */
export function buildHealthTrends(input: BioHealthRead, now: number): BioHealthTrend[] {
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) return [];
  const today = localCheckInDate(now);
  return BIO_HEALTH_METRICS.map((metric) => {
    const result = input?.[metric];
    const empty: BioHealthTrend = { metric, status: 'EMPTY', days: [], fresh: false };
    if (result?.error) return { ...empty, status: 'ERROR' };
    if (result?.truncated) return { ...empty, status: 'TRUNCATED' };
    const unique = new Map<string, BioHealthSample>();
    for (const sample of result?.samples ?? []) if (valid(sample, metric, now)) unique.set(sample.id, sample);
    const sources = new Map<string, BioHealthSample[]>();
    for (const sample of unique.values()) { const source = sources.get(sample.sourceId) ?? []; source.push(sample); sources.set(sample.sourceId, source); }
    const candidates = [...sources].map(([sourceId, samples]) => ({ sourceId, sourceName: samples[0].sourceName,
      days: (metric === 'SLEEP' ? sleepDays(samples, today) : quantityDays(samples)).sort((a, b) => a.date.localeCompare(b.date)) }));
    // Prefer a recently observed source, then the longest comparable daily history.
    candidates.sort((a, b) => Number((b.days.at(-1)?.at ?? 0) >= now - 36 * 3_600_000) - Number((a.days.at(-1)?.at ?? 0) >= now - 36 * 3_600_000)
      || b.days.length - a.days.length || a.sourceId.localeCompare(b.sourceId));
    const selected = candidates.find((candidate) => candidate.days.length > 0);
    if (!selected) return empty;
    const latest = selected.days.at(-1)!;
    const lower = new Date(`${latest.date}T12:00:00`); lower.setDate(lower.getDate() - HEALTH_REFERENCE_DAYS);
    const previous = selected.days.filter((day) => day.date < latest.date && day.date >= localCheckInDate(lower.getTime()));
    return { metric, status: 'AVAILABLE', ...selected, latest, fresh: latest.at >= now - 36 * 3_600_000,
      ...(previous.length >= HEALTH_REFERENCE_MIN_DAYS ? { reference: { median: median(previous.map((day) => day.value)),
        days: previous.length, from: previous[0].date, to: previous.at(-1)!.date } } : {}) };
  });
}

/** Fixed calendar slots preserve missing days without fabricating zero measurements. */
export function healthChartDays(trend: BioHealthTrend): { date: string; day?: BioHealthDay }[] {
  if (!trend.latest) return [];
  const date = new Date(`${trend.latest.date}T12:00:00`);
  date.setDate(date.getDate() - 13);
  return Array.from({ length: 14 }, () => {
    const key = localCheckInDate(date.getTime()); date.setDate(date.getDate() + 1);
    return { date: key, day: trend.days.find((day) => day.date === key) };
  });
}
