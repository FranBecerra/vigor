/**
 * Derives conservative, exercise-specific e1RM estimates from completed history.
 *
 * A planned load must be based on work the athlete actually completed, never on a
 * target they merely saw in a prescription. Epley is only used for 1–12 reps:
 * beyond that range its extrapolation is too noisy to turn into a kg suggestion.
 */
import { SetType, type WorkoutSession } from '@/models';
import { epleyE1RM } from '@/services/analytics/e1rm';

const MAX_E1RM_REPS = 12;

function isUsableAttempt(weight: unknown, reps: unknown): boolean {
  return (
    typeof weight === 'number' &&
    Number.isFinite(weight) &&
    weight > 0 &&
    typeof reps === 'number' &&
    Number.isInteger(reps) &&
    reps >= 1 &&
    reps <= MAX_E1RM_REPS
  );
}

/**
 * Best observed Epley estimate per exercise across completed sessions.
 *
 * Warm-ups and partially logged sessions are deliberately excluded. A map is
 * returned rather than a plain object so callers cannot accidentally accept an
 * inherited key as an exercise id.
 */
export function e1RMByExerciseFromHistory(
  sessions: readonly WorkoutSession[],
): ReadonlyMap<string, number> {
  const estimates = new Map<string, number>();

  sessions.forEach((session) => {
    if (session.completedAt === undefined) return;
    session.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        if (set.setType === SetType.WARMUP) return;
        if (!isUsableAttempt(set.actualWeight, set.actualReps)) return;
        const estimate = epleyE1RM(set.actualWeight as number, set.actualReps as number);
        const previous = estimates.get(exercise.exerciseId);
        if (previous === undefined || estimate > previous) {
          estimates.set(exercise.exerciseId, estimate);
        }
      });
    });
  });

  return estimates;
}
