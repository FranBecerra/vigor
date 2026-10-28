import type { BioNightAnalysis, BioSleepEpisode } from '@/models/bioNight';
import type { BioReadinessIndex, ReadinessMetric, ReadinessSignal } from '@/models/bioReadiness';
import { median } from './healthTrends';
import { localCheckInDate } from './dailyCheckIn';
import { validSleepGoal } from './sleepGoal';

const MINUTE = 60_000;
// Stabilize floating-point boundaries before flooring the displayed five-point steps.
const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 1e8) / 1e8;
const roundScore = (value: number) => Math.floor(clamp(value) / 5) * 5;
function dateOffset(time: number, days: number): string {
  const date = new Date(time); date.setDate(date.getDate() + days); return localCheckInDate(date.getTime());
}
function usableSleep(episode: BioSleepEpisode, now: number): boolean {
  const span = (episode.end - episode.start) / MINUTE;
  return !!episode.sourceId && Number.isFinite(episode.start) && Number.isFinite(episode.end) && episode.end <= now
    && span > 0 && span <= 1440 && episode.date === localCheckInDate(episode.end)
    && Number.isFinite(episode.asleepMinutes) && episode.asleepMinutes > 0 && episode.asleepMinutes <= span
    && Number.isFinite(episode.unobservedMinutes) && episode.unobservedMinutes >= 0
    && episode.unobservedMinutes / span <= 0.1;
}
function observation(episode: BioSleepEpisode, metric: ReadinessMetric): number | undefined {
  const value = episode.cardiac.find((entry) => entry.metric === metric);
  return value?.status === 'AVAILABLE' && Number.isFinite(value.median) && value.median! > 0
    && value.median! <= (metric === 'HEART_RATE' ? 300 : 2000) && value.samples >= 3 && value.occupiedBins >= 3
    && value.occupiedBins <= 6 && value.spanMinutes >= (episode.end - episode.start) / MINUTE / 2
    && value.spanMinutes <= (episode.end - episode.start) / MINUTE ? value.median : undefined;
}
function spread(values: number[], center: number, floor: number): number {
  return Math.max(floor, 1.4826 * median(values.map((value) => Math.abs(value - center))));
}
/** No pooled devices or HRV methods; compare rolling medians with rolling references. */
function signal(episodes: BioSleepEpisode[], latest: BioSleepEpisode, metric: ReadinessMetric): ReadinessSignal {
  const recentFrom = dateOffset(latest.end, -6), baselineFrom = dateOffset(latest.end, -60);
  const points = episodes.flatMap((episode) => {
    const value = observation(episode, metric);
    return value === undefined ? [] : [{ date: episode.date, end: episode.end, value }];
  });
  const baseline = points.filter((point) => point.date >= baselineFrom && point.date < recentFrom);
  const recent = points.filter((point) => point.date >= recentFrom && point.date <= latest.date);
  const current = observation(latest, metric), logarithmic = metric !== 'HEART_RATE';
  const transform = (value: number) => logarithmic ? Math.log(value) : value;
  const values = baseline.map((point) => transform(point.value));
  const windows = baseline.flatMap((anchor) => {
    const from = dateOffset(anchor.end, -6);
    const entries = baseline.filter((point) => point.date >= from && point.date <= anchor.date);
    return entries.length >= 3 ? [median(entries.map((point) => transform(point.value)))] : [];
  });
  const result: ReadinessSignal = { metric, current, recent: recent.length ? median(recent.map((point) => point.value)) : undefined,
    reference: baseline.length ? median(baseline.map((point) => point.value)) : undefined,
    baselineDays: baseline.length, recentDays: recent.length, referenceWindows: windows.length, unusual: false };
  if (current === undefined || baseline.length < 14 || recent.length < 3 || windows.length < 7) return result;
  const floor = logarithmic ? 0.1 : 2, direction = logarithmic ? -1 : 1;
  const center = median(values), trendCenter = median(windows);
  const currentDeviation = direction * (transform(current) - center) / spread(values, center, floor);
  const trendDeviation = direction * (median(recent.map((point) => transform(point.value))) - trendCenter) / spread(windows, trendCenter, floor);
  // An unusually favorable value is ambiguous, not a recovery bonus.
  const unusual = Math.min(currentDeviation, trendDeviation) < -3;
  return { ...result, currentDeviation, trendDeviation, unusual,
    score: unusual ? undefined : clamp(100 - Math.max(0, currentDeviation - 1, trendDeviation - 1) * 25) };
}

/**
 * Explicit product heuristic, not a validated recovery percentage or prescription.
 * See PRD for constants, missingness, calendar windows and prospective-validation boundary.
 */
export function buildReadinessIndex(analysis: BioNightAnalysis | undefined, goal: unknown, now: number): BioReadinessIndex {
  const result: BioReadinessIndex = { policy: 'RECOVERY_CONTEXT_V1', calculatedAt: now, coverage: 'INSUFFICIENT', reasons: [],
    sleep: { observedDays: 0, ...(validSleepGoal(goal) ? { goalMinutes: goal } : {}) }, cardiac: {} };
  const latest = analysis?.latest;
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime()) || analysis?.policy !== 'SLEEP_MATCHED_V1'
    || analysis.status !== 'AVAILABLE' || !latest || !usableSleep(latest, now)) {
    result.reasons.push('NO_OBSERVATIONS'); return result;
  }
  result.date = latest.date; result.sourceName = latest.sourceName;
  if (now - latest.end > 36 * 60 * MINUTE) { result.reasons.push('STALE'); return result; }
  // Reject conflicting/duplicate primary dates instead of weighting repeated records twice.
  const episodes = analysis.episodes.filter((episode) => episode.sourceId === latest.sourceId && episode.primary
    && episode.date <= latest.date && usableSleep(episode, now));
  const counts = new Map<string, number>();
  episodes.forEach((episode) => counts.set(episode.date, (counts.get(episode.date) ?? 0) + 1));
  const unique = episodes.filter((episode) => counts.get(episode.date) === 1);
  if (!unique.some((episode) => episode.id === latest.id && episode.end === latest.end)) {
    result.reasons.push('NO_OBSERVATIONS'); return result;
  }
  const recentFrom = dateOffset(latest.end, -6);
  const recent = unique.filter((episode) => episode.date >= recentFrom);
  result.sleep.currentMinutes = latest.asleepMinutes; result.sleep.observedDays = recent.length;
  if (!validSleepGoal(goal)) result.reasons.push('SLEEP_GOAL');
  if (recent.length < 3) result.reasons.push('SLEEP_COVERAGE');
  if (validSleepGoal(goal) && recent.length >= 3) {
    const previous = recent.filter((episode) => episode.date !== latest.date);
    const attainment = previous.reduce((total, episode) => total + Math.min(1, episode.asleepMinutes / goal), 0) / previous.length;
    result.sleep.score = clamp(100 * (0.7 * Math.min(1, latest.asleepMinutes / goal) + 0.3 * attainment));
  }
  const pulse = signal(unique, latest, 'HEART_RATE');
  const rmssd = signal(unique, latest, 'HRV_RMSSD'), sdnn = signal(unique, latest, 'HRV_SDNN');
  // Prefer a mature native RMSSD series; an immature method never borrows SDNN history.
  const mature = (entry: ReadinessSignal) => entry.currentDeviation !== undefined;
  const hrv = mature(rmssd) ? rmssd : mature(sdnn) ? sdnn : rmssd.current !== undefined ? rmssd : sdnn;
  result.cardiac = { pulse, hrv };
  if (pulse.unusual || hrv.unusual) result.reasons.push('UNUSUAL_SIGNAL');
  if (!mature(pulse)) result.reasons.push('PULSE_COVERAGE');
  if (!mature(hrv)) result.reasons.push('HRV_COVERAGE');
  if (pulse.score !== undefined && hrv.score !== undefined) result.cardiac.score = Math.min(pulse.score, hrv.score);
  if (result.sleep.score === undefined || result.cardiac.score === undefined) return result;
  const sleep = result.sleep.score, cardiac = result.cardiac.score;
  result.score = roundScore(Math.min((sleep + cardiac) / 2, Math.min(sleep, cardiac) + 10));
  result.coverage = Math.min(pulse.baselineDays, hrv.baselineDays) >= 28
    && Math.min(pulse.recentDays, hrv.recentDays, recent.length) >= 5 ? 'ESTABLISHED' : 'LIMITED';
  return result;
}
