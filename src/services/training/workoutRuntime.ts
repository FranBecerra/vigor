import type { WorkoutSession } from '@/models';

export function timestampMillis(value: WorkoutSession['performedAt']): number {
  return typeof value === 'number' ? value : value.seconds * 1000 + value.nanoseconds / 1e6;
}

/** Wall-clock time also survives suspension and app relaunch. */
export function workoutElapsedSeconds(startedAt: number, now: number, completedAt?: number): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt ?? now)) return 0;
  return Math.max(0, Math.floor(((completedAt ?? now) - startedAt) / 1000));
}

export function formatWorkoutTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}

/** Legacy drafts can still resume by resolving their routine's goal. */
export function latestUnfinishedWorkout(sessions: readonly WorkoutSession[]): WorkoutSession | null {
  return [...sessions].filter((session) => session.completedAt === undefined && session.exercises.length > 0
    && !!session.mesocycleId && Number.isInteger(session.microcycleIndex) && session.microcycleIndex >= 0
    && Number.isInteger(session.plannedSessionIndex) && session.plannedSessionIndex! >= 0)
    .sort((a, b) => timestampMillis(b.performedAt) - timestampMillis(a.performedAt))[0] ?? null;
}

/** Move the dragged item, rather than swapping it with its neighbour. */
export function moveWorkoutExercise<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= items.length || to < 0 || to >= items.length) return result;
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
