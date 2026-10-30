import { reviewCardioHealth } from './cardioHealthReview';

/** A device-memory proposal only; never serialize this review into an account or plan. */
export interface CardioStartContext {
  modality: 'RUNNING' | 'CYCLING';
  representative?: boolean;
  response: 'UNKNOWN' | 'RECOVERED' | 'DIFFICULT' | 'DISCOMFORT';
  comfortableMinutes?: number;
  cycleDays: number;
  maxSessions: number;
  maxSessionMinutes: number;
  totalMinutes: number;
}
export type CardioStartIssue = 'INVALID_CONTEXT' | 'STALE_REVIEW' | 'REVIEW_REQUIRED' | 'LIMITED_HISTORY'
  | 'CONTEXT_REQUIRED' | 'REVIEW_TOLERANCE' | 'DISCOMFORT' | 'INSUFFICIENT_HISTORY' | 'TIME_TOO_LOW';
export type CardioStartResult = { policy: 'OBSERVED_EASY_START_POC_V1'; state: CardioStartIssue } | {
  policy: 'OBSERVED_EASY_START_POC_V1'; state: 'READY'; modality: 'RUNNING' | 'CYCLING'; cycleDays: number;
  sessions: number; sessionMinutes: number; totalMinutes: number;
  observedSessions: number; representedWeeks: number; typicalMinutes: number; weeklySessions: number; weeklyMinutes: number;
  cappedBy: Array<'COMFORT' | 'SESSION_TIME' | 'SESSION_COUNT' | 'TOTAL_TIME' | 'OBSERVED_VOLUME'>;
};
const DAY = 86400000;
const integer = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

/**
 * Four elapsed seven-day observation bins, not calendar weeks or training microcycles.
 * Minimum observations/recency and medians are transparent product conventions, not
 * validated fitness/injury thresholds. Never infer intensity from Health activity labels.
 */
export function proposeCardioStartingPoint(raw: unknown, observedAt: number, now: number, context: CardioStartContext,
  sourceId?: string, excludedIds: readonly string[] = []): CardioStartResult {
  const issue = (state: CardioStartIssue): CardioStartResult => ({ policy: 'OBSERVED_EASY_START_POC_V1', state });
  if (!context || !['RUNNING', 'CYCLING'].includes(context.modality)
    || !['UNKNOWN', 'RECOVERED', 'DIFFICULT', 'DISCOMFORT'].includes(context.response)
    || context.representative !== undefined && typeof context.representative !== 'boolean'
    || context.comfortableMinutes !== undefined && !integer(context.comfortableMinutes, 1, 600)
    || !integer(context.cycleDays, 7, 31) || !integer(context.maxSessions, 0, 14)
    || !integer(context.maxSessionMinutes, 0, 600) || !integer(context.totalMinutes, 0, 1440)) return issue('INVALID_CONTEXT');
  if (!Number.isFinite(now) || !Number.isFinite(observedAt) || observedAt > now || now - observedAt > DAY) return issue('STALE_REVIEW');
  let review: ReturnType<typeof reviewCardioHealth>;
  try { review = reviewCardioHealth(raw, observedAt, sourceId, excludedIds); }
  catch { return issue('REVIEW_REQUIRED'); }
  // Symptoms take precedence over apparently favorable recorded volume.
  if (context.response === 'DISCOMFORT') return issue('DISCOMFORT');
  if (context.response === 'DIFFICULT') return issue('REVIEW_TOLERANCE');
  if (!review.canConfirm) return issue('REVIEW_REQUIRED');
  const start = observedAt - 28 * DAY;
  const data = raw as { earliestAllowedStart?: number };
  if (data.earliestAllowedStart !== undefined && data.earliestAllowedStart > start) return issue('LIMITED_HISTORY');
  if (context.representative !== true || context.response !== 'RECOVERED' || context.comfortableMinutes === undefined) return issue('CONTEXT_REQUIRED');
  const workouts = review.rows.filter(w => w.kind === context.modality && w.start >= start
    && !w.manuallyEntered && !w.mixedActivities && !review.excludedIds.includes(w.id) && !review.overlappingIds.includes(w.id));
  const counts = [0, 0, 0, 0], minutes = [0, 0, 0, 0];
  for (const w of workouts) {
    const bin = Math.min(3, Math.floor((w.start - start) / (7 * DAY)));
    counts[bin]++; minutes[bin] += w.durationSeconds / 60;
  }
  const representedWeeks = counts.filter(count => count > 0).length;
  if (workouts.length < 4 || representedWeeks < 3 || Math.max(...workouts.map(w => w.end)) < observedAt - 10 * DAY) return issue('INSUFFICIENT_HISTORY');
  const weeklySessions = median(counts), weeklyMinutes = median(minutes);
  const typicalMinutes = median(workouts.map(w => w.durationSeconds / 60));
  const observedSessions = Math.floor(weeklySessions * context.cycleDays / 7);
  const sessions = Math.min(context.maxSessions, observedSessions);
  if (sessions < 1) return issue('TIME_TOO_LOW');
  // Use recorded active time as a conservative ceiling for the *whole* proposed
  // session, including its warm-up/cool-down. No pace/distance conversion or growth.
  const limits = [typicalMinutes, context.comfortableMinutes, context.maxSessionMinutes,
    context.totalMinutes / sessions, weeklyMinutes * context.cycleDays / 7 / sessions];
  const sessionMinutes = Math.floor(Math.min(...limits));
  if (sessionMinutes < 1) return issue('TIME_TOO_LOW');
  const cappedBy: Extract<CardioStartResult, { state: 'READY' }>['cappedBy'] = [];
  if (context.comfortableMinutes < typicalMinutes) cappedBy.push('COMFORT');
  if (context.maxSessionMinutes < typicalMinutes) cappedBy.push('SESSION_TIME');
  if (context.maxSessions < observedSessions) cappedBy.push('SESSION_COUNT');
  if (context.totalMinutes / sessions < typicalMinutes) cappedBy.push('TOTAL_TIME');
  if (weeklyMinutes * context.cycleDays / 7 / sessions < typicalMinutes) cappedBy.push('OBSERVED_VOLUME');
  return { policy: 'OBSERVED_EASY_START_POC_V1', state: 'READY', modality: context.modality, cycleDays: context.cycleDays,
    sessions, sessionMinutes, totalMinutes: sessions * sessionMinutes, observedSessions: workouts.length,
    representedWeeks, typicalMinutes, weeklySessions, weeklyMinutes, cappedBy };
}
