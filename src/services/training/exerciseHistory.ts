import type { Exercise, WorkoutSession } from '@/models';
import { ownedBioWorkouts } from '@/services/bio/observations';
import { workoutHistoryDetails } from './workoutHistory';
import { timestampMillis } from './workoutRuntime';

/** Read saved actuals across routines; latest corrections and discards take precedence. */
export function exerciseHistory(owner: string, exerciseId: string, history: readonly WorkoutSession[],
  catalogue: ReadonlyMap<string, Exercise>, now: number, currentWorkoutId?: string) {
  if (!exerciseId) return [];
  return ownedBioWorkouts(owner, history, now).filter(session => session.id !== currentWorkoutId)
    .flatMap(session => {
      const matching = session.exercises.filter(entry => entry.exerciseId === exerciseId);
      if (!matching.length) return [];
      const exercises = workoutHistoryDetails({ ...session, exercises: matching }, catalogue).exercises
        .map(entry => ({ ...entry, sets: entry.sets.filter(set => set.done) }))
        .filter(entry => entry.sets.length > 0);
      return exercises.length ? [{ id: session.id, at: timestampMillis(session.performedAt),
        sessionName: session.sessionName ?? '', exercises }] : [];
    }).sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}
