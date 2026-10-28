import { MuscleGroup, type Exercise, type Mesocycle, type WorkoutSession } from '@/models';
import type { MicrocycleReview, MicrocycleReviewAnswers } from '@/models/microcycleReview';
import { sessionsForMicrocycle } from '../training/mesocycleEditing';
import { workoutHistoryDetails } from '../training/workoutHistory';

export const REVIEW_MUSCLES = Object.values(MuscleGroup).filter((muscle) => muscle !== MuscleGroup.UNCLASSIFIED);
export const REVIEW_CONTEXT = ['SLEEP', 'STRESS', 'ILLNESS', 'NUTRITION', 'OTHER_ACTIVITY', 'TIME'] as const;
const validIndex = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
const validId = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 300 && !/[\u0000-\u001f/]/.test(value);

function millis(value: unknown): number | null {
  if (validTime(value)) return value;
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value
    && validTime(value.seconds) && validTime(value.nanoseconds) && value.nanoseconds < 1e9) {
    const result = value.seconds * 1000 + value.nanoseconds / 1e6;
    return validTime(result) ? result : null;
  }
  return null;
}

export interface BioCycle {
  id: string;
  mesocycleId: string;
  index: number;
  closed: boolean;
  completedSlots: number;
  skippedSlots: number;
  plannedSlots: number;
  workouts: WorkoutSession[];
  observedFrom: number | null;
  observedTo: number | null;
}

export function microcycleReviewId(mesocycleId: string, index: number): string {
  if (!validId(mesocycleId) || !validIndex(index)) throw Error('invalidReviewIdentity');
  return `${encodeURIComponent(mesocycleId)}:m${index}`;
}

/** Resolve completion from actual records and explicit skips, never rest checks. */
export function buildBioCycles(owner: string, plans: readonly Mesocycle[], history: readonly WorkoutSession[], now: number): BioCycle[] {
  if (!validId(owner) || !validTime(now)) return [];
  const records = new Map<string, WorkoutSession>();
  for (const workout of history) {
    const start = millis(workout.performedAt), end = millis(workout.completedAt);
    if (workout.userId !== owner || !validId(workout.id) || workout.discardedAt !== undefined
      || !validIndex(workout.microcycleIndex) || start === null || end === null || end < start || end > now) continue;
    const previous = records.get(workout.id);
    if (!previous || (millis(workout.editedAt) ?? end) > (millis(previous.editedAt) ?? millis(previous.completedAt)!)) records.set(workout.id, workout);
  }
  const cycles: BioCycle[] = [];
  const seenPlans = new Set<string>();
  for (const plan of plans) {
    if (plan.userId !== owner || !validId(plan.id) || seenPlans.has(plan.id)) continue;
    seenPlans.add(plan.id);
    const workouts = [...records.values()].filter((record) => record.mesocycleId === plan.id);
    const indices = new Set(workouts.map((record) => record.microcycleIndex));
    if (validIndex(plan.currentMicrocycleIndex)) indices.add(plan.currentMicrocycleIndex);
    for (const key of Object.keys(plan.skippedSessions ?? {})) {
      const match = /^(\d+):\d+$/.exec(key);
      if (match && validIndex(Number(match[1]))) indices.add(Number(match[1]));
    }
    for (const index of indices) {
      const planned = sessionsForMicrocycle(plan, 'HYPERTROPHY', index);
      const slots = new Set(planned.map((session) => session.index).filter(validIndex));
      const actual = workouts.filter((workout) => workout.microcycleIndex === index);
      const completed = new Set(actual.map((workout) => workout.plannedSessionIndex).filter((slot): slot is number => validIndex(slot) && slots.has(slot)));
      const skips = [...slots].filter((slot) => {
        const time = plan.skippedSessions?.[`${index}:${slot}`];
        return !completed.has(slot) && validTime(time) && time <= now;
      });
      const observations = actual.flatMap((workout) => [millis(workout.performedAt)!, millis(workout.completedAt)!]);
      observations.push(...skips.map((slot) => plan.skippedSessions![`${index}:${slot}`]));
      cycles.push({ id: microcycleReviewId(plan.id, index), mesocycleId: plan.id, index,
        closed: slots.size > 0 && completed.size + skips.length === slots.size,
        completedSlots: completed.size, skippedSlots: skips.length, plannedSlots: slots.size, workouts: actual,
        observedFrom: observations.length ? Math.min(...observations) : null,
        observedTo: observations.length ? Math.max(...observations) : null });
    }
  }
  return cycles.sort((a, b) => (b.observedTo ?? -1) - (a.observedTo ?? -1) || a.id.localeCompare(b.id));
}

/** Validate persisted/draft values without inferring any missing answer. */
export function normalizeReviewAnswers(input: MicrocycleReviewAnswers): MicrocycleReviewAnswers {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('invalidReviewAnswers');
  const result: MicrocycleReviewAnswers = {};
  for (const [key, options] of [
    ['recovery', ['WORSE', 'USUAL', 'BETTER']], ['discomfort', ['NONE', 'PRESENT']], ['sustainability', ['YES', 'TIGHT', 'NO']],
  ] as const) {
    const value = input[key];
    if (value !== undefined) {
      if (!(options as readonly unknown[]).includes(value)) throw Error('invalidReviewAnswers');
      Object.assign(result, { [key]: value });
    }
  }
  for (const key of ['unrecoveredMuscles', 'discomfortMuscles', 'context'] as const) {
    const values = input[key];
    if (values === undefined) continue;
    const allowed = key === 'context' ? REVIEW_CONTEXT : REVIEW_MUSCLES;
    if (!Array.isArray(values) || values.some((value) => !(allowed as readonly unknown[]).includes(value))) throw Error('invalidReviewAnswers');
    Object.assign(result, { [key]: [...new Set<string>(values)].sort() });
  }
  if (result.discomfort !== 'PRESENT') delete result.discomfortMuscles;
  return result;
}

export function createMicrocycleReview(owner: string, cycle: BioCycle, answers: MicrocycleReviewAnswers,
  status: MicrocycleReview['status'], previous: MicrocycleReview | undefined, now: number): MicrocycleReview {
  const id = microcycleReviewId(cycle.mesocycleId, cycle.index);
  if (!validId(owner) || cycle.id !== id || !cycle.closed || cycle.observedFrom === null || cycle.observedTo === null
    || !validTime(cycle.observedFrom) || !validTime(cycle.observedTo) || cycle.observedTo < cycle.observedFrom
    || !validTime(now) || cycle.observedTo > now || !['SUBMITTED', 'DISMISSED'].includes(status)) throw Error('reviewUnavailable');
  if (previous && (!validMicrocycleReview(previous, owner) || previous.id !== id || previous.updatedAt > now)) throw Error('staleReview');
  if (previous?.status === 'SUBMITTED' && status === 'DISMISSED') throw Error('reviewAlreadySubmitted');
  const normalized = status === 'DISMISSED' ? {} : normalizeReviewAnswers(answers);
  if (status === 'SUBMITTED' && !['recovery', 'unrecoveredMuscles', 'discomfort', 'sustainability'].some((key) => key in normalized)) throw Error('emptyReview');
  return { id, userId: owner, mesocycleId: cycle.mesocycleId, microcycleIndex: cycle.index,
    questionnaireVersion: 1, status, answers: normalized, observedFrom: cycle.observedFrom,
    observedTo: cycle.observedTo, createdAt: previous?.createdAt ?? now, updatedAt: now };
}

export function validMicrocycleReview(value: unknown, owner: string): value is MicrocycleReview {
  try {
    const review = value as MicrocycleReview;
    return review.userId === owner && validId(owner) && review.id === microcycleReviewId(review.mesocycleId, review.microcycleIndex)
      && review.questionnaireVersion === 1 && ['SUBMITTED', 'DISMISSED'].includes(review.status)
      && validTime(review.createdAt) && validTime(review.updatedAt) && review.createdAt <= review.updatedAt
      && validTime(review.observedFrom) && validTime(review.observedTo) && review.observedFrom <= review.observedTo
      && review.observedTo <= review.updatedAt
      && Object.keys(review.answers).length === Object.keys(normalizeReviewAnswers(review.answers)).length
      && Object.entries(review.answers).every(([key, answer]) => JSON.stringify(answer) === JSON.stringify(normalizeReviewAnswers(review.answers)[key as keyof MicrocycleReviewAnswers]))
      && (review.status === 'DISMISSED' ? Object.keys(review.answers).length === 0
        : ['recovery', 'unrecoveredMuscles', 'discomfort', 'sustainability'].some((key) => key in review.answers));
  } catch { return false; }
}

/** Descriptive exposure only; no effort inference, growth claim or recovery score. */
export function bioCycleExposure(cycle: BioCycle, catalogue: ReadonlyMap<string, Exercise>) {
  const details = cycle.workouts.map((workout) => workoutHistoryDetails(workout, catalogue));
  const totalSeconds = details.reduce((sum, detail) => sum + (detail.durationSeconds ?? 0), 0);
  return { workouts: details.length, workingSets: details.reduce((sum, detail) => sum + detail.working, 0),
    minutes: Math.round(totalSeconds / 60) };
}
