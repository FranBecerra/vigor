import type { Exercise, WorkoutSet } from '@/models';
import { recordingOf } from './customExercises';

/** Field names retain units: seconds and ordinal levels never become repetitions/kg. */
export function customCompletionPatch(exercise: Exercise, set: WorkoutSet & { isCompleted: boolean }): Partial<WorkoutSet> & { isCompleted: boolean } {
  if (set.isCompleted) return { isCompleted: false, completionState: 'PENDING' as const };
  const mode = recordingOf(exercise);
  const actual = mode.measure === 'SECONDS' ? set.actualDurationSeconds ?? set.targetDurationSeconds
    : set.actualReps ?? set.targetReps;
  const load = mode.load === 'LEVEL' ? set.actualLoadLevel ?? set.targetLoadLevel : set.actualWeight ?? set.targetWeight;
  if (actual === undefined || !Number.isFinite(actual) || actual <= 0 || !Number.isInteger(actual)
    || actual > (mode.measure === 'SECONDS' ? 3600 : 999)
    || (mode.load !== 'NONE' && (load === undefined || !Number.isFinite(load) || load < 0 || load > 10000))) throw new Error('invalidActual');
  return { recording: mode, isCompleted: true, completionState: 'DONE' as const,
    ...(mode.measure === 'SECONDS' ? { actualDurationSeconds: actual } : { actualReps: actual }),
    ...(mode.load === 'NONE' ? {} : mode.load === 'LEVEL' ? { actualLoadLevel: load } : { actualWeight: load }) };
}
