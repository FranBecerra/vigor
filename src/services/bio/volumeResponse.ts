import { MuscleGroup, type Exercise, type Mesocycle, type WorkoutSession } from '@/models';
import type { MicrocycleReview } from '@/models/microcycleReview';
import { primaryMusclesOf } from '@/services/training/exerciseMuscles';
import { bioPerformanceSeries, ownedBioWorkouts } from './observations';
import { buildBioCycles, validMicrocycleReview } from './microcycleReview';
import { localCheckInDate } from './dailyCheckIn';

export type BioDoseReason = 'INSUFFICIENT' | 'DISCOMFORT' | 'FEASIBILITY' | 'REPEATED_LOCAL_RECOVERY'
  | 'RECORDED_PROGRESS' | 'LOWER_OBSERVATIONS' | 'UNCHANGED_OBSERVATIONS' | 'MIXED_OBSERVATIONS';
export interface BioDoseReview {
  muscle: MuscleGroup;
  reason: BioDoseReason;
  action: 'KEEP_COLLECTING' | 'MAINTAIN' | 'REVIEW';
  cycleIndexes: number[];
  exerciseIds: string[];
  observations: number;
}

/**
 * Review support for sustainable progress. Never proposes a numeric dose or rewrites a plan.
 * Six same-context observations is a reporting safeguard, not a validated plateau threshold.
 */
export function reviewVolumeResponse(owner: string, plan: Mesocycle, history: readonly WorkoutSession[],
  reviews: readonly MicrocycleReview[], catalogue: ReadonlyMap<string, Exercise>, now: number): BioDoseReview[] {
  if (!owner || plan.userId !== owner || !Number.isFinite(now)) return [];
  const cycles = buildBioCycles(owner, [plan], ownedBioWorkouts(owner, history, now), now).filter((cycle) => cycle.closed).sort((a, b) => b.index - a.index).slice(0, 2);
  const latest = cycles[0];
  if (!latest) return [];
  const feedback = cycles.map((cycle) => reviews.find((review) => validMicrocycleReview(review, owner)
    && review.id === cycle.id && review.status === 'SUBMITTED' && review.updatedAt <= now
    && review.observedFrom === cycle.observedFrom && review.observedTo === cycle.observedTo));
  const work = cycles.flatMap((cycle) => cycle.workouts);
  const performance = bioPerformanceSeries(owner, work, catalogue, now);
  const muscles = new Set<MuscleGroup>();
  for (const session of work) for (const entry of session.exercises) {
    const exercise = entry.exerciseSnapshot ?? catalogue.get(entry.exerciseId);
    if (exercise) for (const muscle of primaryMusclesOf(exercise)) if (muscle !== MuscleGroup.UNCLASSIFIED) muscles.add(muscle);
  }
  return [...muscles].sort().map((muscle) => {
    const relevant = performance.filter((series) => series.exercise && primaryMusclesOf(series.exercise).includes(muscle));
    const base = { muscle, cycleIndexes: cycles.map((cycle) => cycle.index), exerciseIds: [...new Set(relevant.map((series) => series.exerciseId))].sort(),
      observations: relevant.filter((series) => series.comparableEffort).reduce((sum, series) => sum + series.points.length, 0) };
    const decision = (reason: BioDoseReason, action: BioDoseReview['action']): BioDoseReview => ({ ...base, reason, action });
    const current = feedback[0]?.answers;
    if (current?.discomfort === 'PRESENT' && (!current.discomfortMuscles?.length || current.discomfortMuscles.includes(muscle))) return decision('DISCOMFORT', 'REVIEW');
    if (current?.sustainability === 'NO' || current?.sustainability === 'TIGHT' || current?.context?.includes('TIME')) return decision('FEASIBILITY', 'REVIEW');
    const consecutive = cycles.length === 2 && cycles[0].index === cycles[1].index + 1;
    if (consecutive && feedback.every((review) => review?.answers.unrecoveredMuscles?.includes(muscle))) return decision('REPEATED_LOCAL_RECOVERY', 'REVIEW');
    // An absent local answer, a skipped slot or an open/missing occurrence is not good tolerance.
    const tolerable = consecutive && cycles.every((cycle) => cycle.skippedSlots === 0)
      && feedback.every((review) => review?.answers.recovery !== undefined && review.answers.recovery !== 'WORSE'
        && review.answers.sustainability === 'YES' && review.answers.discomfort === 'NONE'
        && review.answers.unrecoveredMuscles !== undefined && !review.answers.unrecoveredMuscles.includes(muscle)
        && !review.answers.context?.length);
    if (!tolerable) return decision('INSUFFICIENT', 'KEEP_COLLECTING');
    const eligible = relevant.filter((series) => series.comparableEffort && series.points.length >= 6
      && new Set(series.points.slice(-6).map((point) => localCheckInDate(point.at))).size === 6
      && cycles.every((cycle) => series.points.slice(-6).some((point) => cycle.workouts.some((workout) => workout.id === point.workoutId))));
    if (!eligible.length) return decision('INSUFFICIENT', 'KEEP_COLLECTING');
    const directions = eligible.map((series) => {
      const six = series.points.slice(-6), old = six.slice(0, 3), recent = six.slice(3);
      if (Math.min(...recent.map((point) => point.estimate)) > Math.max(...old.map((point) => point.estimate))) return 'UP';
      if (Math.max(...recent.map((point) => point.estimate)) < Math.min(...old.map((point) => point.estimate))) return 'DOWN';
      if (six.every((point) => point.weight === six[0].weight && point.reps === six[0].reps)) return 'UNCHANGED';
      return 'MIXED';
    });
    // One worsening exercise keeps a progressing exercise from hiding a local issue.
    if (directions.includes('DOWN')) return decision('LOWER_OBSERVATIONS', 'REVIEW');
    if (directions.includes('UP')) return decision('RECORDED_PROGRESS', 'MAINTAIN');
    if (directions.every((direction) => direction === 'UNCHANGED')) return decision('UNCHANGED_OBSERVATIONS', 'REVIEW');
    return decision('MIXED_OBSERVATIONS', 'KEEP_COLLECTING');
  });
}
