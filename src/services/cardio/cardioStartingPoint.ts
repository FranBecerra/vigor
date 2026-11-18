import { reviewCardioHealth } from './cardioHealthReview';
import type { CardioHealthWorkout } from '@/models/cardioHealth';

/** A device-memory proposal only; never serialize this review into an account or plan. */
export interface CardioStartContext {
  modality: 'RUNNING' | 'CYCLING';
  representative?: boolean;
  inferFromHistory?: boolean;
  assessMonthlyCapacity?: boolean;
  response: 'UNKNOWN' | 'RECOVERED' | 'DIFFICULT' | 'DISCOMFORT';
  comfortableMinutes?: number;
  cycleDays: number;
  maxSessions: number;
  maxSessionMinutes: number;
  totalMinutes: number;
}
export type CardioStartIssue = 'INVALID_CONTEXT' | 'STALE_REVIEW' | 'REVIEW_REQUIRED' | 'LIMITED_HISTORY'
  | 'CONTEXT_REQUIRED' | 'REVIEW_TOLERANCE' | 'DISCOMFORT' | 'INSUFFICIENT_HISTORY' | 'TIME_TOO_LOW';
export type StartPolicy = 'OBSERVED_EASY_START_POC_V1' | 'OBSERVED_REPEATABLE_START_V2'
  | 'OBSERVED_MONTHLY_CAPACITY_V3' | 'OBSERVED_MONTHLY_REPARTITION_V3';
export type CardioStartResult = { policy: StartPolicy; state: CardioStartIssue } | {
  policy: StartPolicy; state: 'READY'; modality: 'RUNNING' | 'CYCLING'; cycleDays: number;
  sessions: number; sessionMinutes: number; totalMinutes: number;
  comfortableMinutes: number; usedZones?: true; observedSessions: number; representedWeeks: number; typicalMinutes: number; weeklySessions: number; weeklyMinutes: number;
  cappedBy: Array<'COMFORT' | 'SESSION_TIME' | 'SESSION_COUNT' | 'TOTAL_TIME' | 'OBSERVED_VOLUME'>;
};
const DAY = 86400000;
const MAX_FRAGMENT_GAP_MS = 2 * 60_000;
const MAX_SESSION_GAPS_MS = 5 * 60_000;
const integer = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

/** Infer recording interruptions for planning only. The original history stays intact. */
function groupRecordingFragments(workouts: readonly CardioHealthWorkout[], infer: boolean) {
  const sessions: Array<{ start: number; end: number; durationSeconds: number; sourceId: string; gaps: number; measured: number; lowerZones: number; effort?: number }> = [];
  for (const workout of [...workouts].sort((a, b) => a.start - b.start)) {
    const measured = workout.heartRateZoneSeconds?.reduce((sum, value) => sum + value, 0) ?? 0;
    const lowerZones = (workout.heartRateZoneSeconds?.[0] ?? 0) + (workout.heartRateZoneSeconds?.[1] ?? 0);
    const previous = sessions.at(-1);
    const gap = previous ? workout.start - previous.end : Infinity;
    if (previous && previous.sourceId === workout.sourceId && gap >= 0 && gap <= (infer ? 4 * 60_000 : MAX_FRAGMENT_GAP_MS)
      && previous.gaps + gap <= (infer ? 8 * 60_000 : MAX_SESSION_GAPS_MS)) {
      previous.end = workout.end;
      previous.durationSeconds += workout.durationSeconds;
      previous.gaps += gap;
      previous.measured += measured; previous.lowerZones += lowerZones;
      previous.effort = previous.effort === undefined || workout.sessionEffort === undefined
        ? undefined : Math.max(previous.effort, workout.sessionEffort);
    } else {
      const { start, end, durationSeconds, sourceId } = workout;
      sessions.push({ start, end, durationSeconds, sourceId, gaps: 0, measured, lowerZones, effort: workout.sessionEffort });
    }
  }
  return sessions;
}

/**
 * Four elapsed seven-day observation bins, not calendar weeks or training microcycles.
 * Minimum observations/recency and medians are transparent product conventions, not
 * validated fitness/injury thresholds. Never infer intensity from Health activity labels.
 */
export function proposeCardioStartingPoint(raw: unknown, observedAt: number, now: number, context: CardioStartContext,
  sourceId?: string, excludedIds: readonly string[] = []): CardioStartResult {
  const infer = context?.inferFromHistory === true;
  const monthly = infer && context?.assessMonthlyCapacity === true;
  const policy = monthly ? 'OBSERVED_MONTHLY_CAPACITY_V3' : infer ? 'OBSERVED_REPEATABLE_START_V2' : 'OBSERVED_EASY_START_POC_V1';
  const issue = (state: CardioStartIssue): CardioStartResult => ({ policy, state });
  if (!context || !['RUNNING', 'CYCLING'].includes(context.modality)
    || !['UNKNOWN', 'RECOVERED', 'DIFFICULT', 'DISCOMFORT'].includes(context.response)
    || context.assessMonthlyCapacity !== undefined && typeof context.assessMonthlyCapacity !== 'boolean'
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
  if (!infer && (context.representative !== true || context.response !== 'RECOVERED' || context.comfortableMinutes === undefined)) return issue('CONTEXT_REQUIRED');
  const eligible = groupRecordingFragments(review.rows.filter(w => w.kind === context.modality
    && !w.manuallyEntered && !w.mixedActivities && !review.excludedIds.includes(w.id) && !review.overlappingIds.includes(w.id)), infer);
  const workouts = eligible.filter(w => w.start >= start);
  const counts = [0, 0, 0, 0], minutes = [0, 0, 0, 0];
  for (const w of workouts) {
    const bin = Math.min(3, Math.floor((w.start - start) / (7 * DAY)));
    counts[bin]++; minutes[bin] += w.durationSeconds / 60;
  }
  const representedWeeks = counts.filter(count => count > 0).length;
  if (workouts.length < 4 || representedWeeks < 3 || Math.max(...workouts.map(w => w.end)) < observedAt - 10 * DAY) return issue('INSUFFICIENT_HISTORY');
  const weeklySessions = median(counts);
  const weeklyMinutes = median(infer && !monthly ? minutes.filter((_, i) => counts[i] > 0) : minutes);
  const durations = workouts.map(w => w.durationSeconds / 60);
  // A long outing can anchor duration only when repeated at least a day apart.
  const ordered = (infer ? eligible : workouts).filter(w => w.start >= observedAt - 42 * DAY).sort((a, b) => b.durationSeconds - a.durationSeconds);
  const repeat = (candidates: typeof ordered) => candidates.find((w, i) =>
    candidates.slice(0, i).some(other => Math.abs(w.start - other.start) >= DAY && Math.max(w.start, other.start) >= start));
  const easyRepeat = infer ? repeat(ordered.filter(w => w.measured >= w.durationSeconds * 0.8 && w.lowerZones >= w.measured * 0.75)) : undefined;
  const repeated = easyRepeat ?? repeat(ordered);
  const measuredEasy = (w: typeof workouts[number]) =>
    w.measured >= w.durationSeconds * 0.8 && w.lowerZones >= w.measured * 0.75;
  const easyMonth = workouts.filter(w => w.effort !== undefined ? w.effort <= 4 : measuredEasy(w));
  const repeatedEasy = repeat(easyMonth);
  const typicalMinutes = monthly && repeatedEasy ? median(easyMonth.map(w => w.durationSeconds / 60))
    : infer && !monthly && repeated ? repeated.durationSeconds / 60 : median(durations);
  const comfortableMinutes = infer ? Math.max(1, Math.min(600, Math.floor(typicalMinutes))) : context.comfortableMinutes!;
  const observedSessions = Math.floor(weeklySessions * context.cycleDays / 7);
  // Repartition a familiar dose across two opportunities without increasing weekly time.
  // Explicit low effort or adequate time in low zones is evidence of easy exposure, not a fitness ceiling.
  const repartition = monthly && weeklySessions === 1 && (repeatedEasy || context.response === 'RECOVERED')
    && !workouts.some(w => w.effort !== undefined && w.effort >= 6)
    && Math.min(context.maxSessions, Math.round(2 * context.cycleDays / 7)) > observedSessions;
  const sessions = Math.min(context.maxSessions, repartition ? Math.round(2 * context.cycleDays / 7) : observedSessions);
  if (sessions < 1) return issue('TIME_TOO_LOW');
  // Use recorded active time as a conservative ceiling for the *whole* proposed
  // session, including its warm-up/cool-down. No pace/distance conversion or growth.
  const limits = [typicalMinutes, comfortableMinutes, context.maxSessionMinutes,
    context.totalMinutes / sessions, weeklyMinutes * context.cycleDays / 7 / sessions];
  const sessionMinutes = Math.floor(Math.min(...limits));
  if (sessionMinutes < 1) return issue('TIME_TOO_LOW');
  const cappedBy: Extract<CardioStartResult, { state: 'READY' }>['cappedBy'] = [];
  if (!infer && comfortableMinutes < typicalMinutes) cappedBy.push('COMFORT');
  if (context.maxSessionMinutes < typicalMinutes) cappedBy.push('SESSION_TIME');
  if (context.maxSessions < observedSessions) cappedBy.push('SESSION_COUNT');
  if (context.totalMinutes / sessions < typicalMinutes) cappedBy.push('TOTAL_TIME');
  if (weeklyMinutes * context.cycleDays / 7 / sessions < typicalMinutes) cappedBy.push('OBSERVED_VOLUME');
  return { policy: repartition ? 'OBSERVED_MONTHLY_REPARTITION_V3' : policy, comfortableMinutes,
    ...((monthly ? repeatedEasy && easyMonth.every(measuredEasy) : easyRepeat) ? { usedZones: true as const } : {}), state: 'READY', modality: context.modality, cycleDays: context.cycleDays,
    sessions, sessionMinutes, totalMinutes: sessions * sessionMinutes, observedSessions: workouts.length,
    representedWeeks, typicalMinutes, weeklySessions, weeklyMinutes, cappedBy };
}
