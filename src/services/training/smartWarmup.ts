import { ExerciseProfile, MuscleGroup, SetType, type Exercise, type WorkoutSession } from '@/models';
import { primaryMusclesOf } from './exerciseMuscles';
import { exerciseHistoryReadiness } from './historyReadiness';
import { isSetCompleted, type SessionSetState } from './sessionMapper';

export const WARMUP_TEMPLATE = [{ percent: 40, reps: 8 }, { percent: 55, reps: 5 }, { percent: 70, reps: 3 }] as const;

/** Offer once per first compound primary target, never for incompatible load units. */
export function canSuggestWarmup(exercises: readonly Exercise[], index: number, sets: readonly SessionSetState[]): boolean {
  const exercise = exercises[index];
  if (!exercise || exercise.profile === ExerciseProfile.ISOLATION || exercise.profile === ExerciseProfile.UNCLASSIFIED
    || (exercise.recording && (exercise.recording.measure !== 'REPETITIONS' || !['TOTAL_KG', 'PER_HAND_KG'].includes(exercise.recording.load)))
    || sets.some((set) => set.setType === SetType.WARMUP || set.isCompleted)) return false;
  const earlier = new Set(exercises.slice(0, index).filter((item) => item.profile === ExerciseProfile.COMPOUND_PRIMARY || item.profile === ExerciseProfile.COMPOUND_SECONDARY).flatMap(primaryMusclesOf));
  return primaryMusclesOf(exercise).some((muscle) => muscle !== MuscleGroup.UNCLASSIFIED && !earlier.has(muscle));
}

/** Reuse the recent-observation policy, excluding discarded/pending sets and foreign load conventions. */
export function warmupReference(exercise: Exercise, history: readonly WorkoutSession[], now: number): number | undefined {
  if (exercise.recording?.load === 'PER_HAND_KG') return undefined;
  const compatible = history.filter((session) => session.discardedAt === undefined).map((session) => ({ ...session,
    exercises: session.exercises.filter((entry) => entry.exerciseId === exercise.id
      && (!entry.exerciseSnapshot?.recording || entry.exerciseSnapshot.recording.measure === 'REPETITIONS' && entry.exerciseSnapshot.recording.load === 'TOTAL_KG'))
      .map((entry) => ({ ...entry, sets: entry.sets.filter(isSetCompleted) })) }));
  return exerciseHistoryReadiness(compatible, now).find((entry) => entry.exerciseId === exercise.id)?.estimate;
}

/** Editable coaching defaults, not a validated individual optimal warmup protocol. */
export function smartWarmup(referenceRM: number, increment: number, workingLoad: number | undefined,
  steps: readonly { percent: number; reps: number }[] = WARMUP_TEMPLATE): { percent: number; weight: number; reps: number }[] {
  if (!Number.isFinite(referenceRM) || referenceRM <= 0 || referenceRM > 10000 || !Number.isFinite(increment) || increment <= 0 || increment > 100
    || !steps.length || steps.length > 6 || steps.some((step, i) => !Number.isFinite(step.percent) || step.percent <= 0 || step.percent > 80
      || !Number.isInteger(step.reps) || step.reps < 1 || step.reps > 15 || i > 0 && step.percent <= steps[i - 1].percent)) return [];
  const cap = workingLoad !== undefined && Number.isFinite(workingLoad) && workingLoad > 0 ? workingLoad * 0.9 : referenceRM * 0.8;
  const result: { percent: number; weight: number; reps: number }[] = [];
  for (const step of steps) {
    const weight = Number((Math.floor(Math.min(referenceRM * step.percent / 100, cap) / increment + 1e-9) * increment).toFixed(3));
    if (weight > 0 && (!result.length || weight > result[result.length - 1].weight)) result.push({ percent: step.percent, weight, reps: step.reps });
  }
  return result;
}
