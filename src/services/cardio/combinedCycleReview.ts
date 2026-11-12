import { SetType } from '@/models';
import type { RoutineView, SessionExerciseView } from '@/services/training/routineView';
import { strengthPlacements, type CardioStrengthPlacement } from './cardioPreview';

/** Resolve only a compatible placement. A saved calendar fingerprint is not an immutable exercise snapshot. */
export function matchingStrengthSession(placement: CardioStrengthPlacement, routine?: RoutineView) {
  const cycle = routine?.microcycles[routine.currentMicrocycleIndex];
  if (!routine || !cycle) return null;
  const match = strengthPlacements(routine, true).sessions.find(s => s.id === placement.id);
  if (!match || match.name !== placement.name || match.estimatedMinutes !== placement.estimatedMinutes
    || match.lowerBodyDemand !== placement.lowerBodyDemand) return null;
  return cycle.sessions.find(s => `${routine.id}:${s.plannedSessionIndex}` === placement.id)!;
}

/** Collapse only consecutive identical prescriptions; mixed reps/RIR/types stay visible. */
export function groupedReviewSets(exercise: Pick<SessionExerciseView, 'sets' | 'repRange'>) {
  const result: { count: number; reps: string; rir: number | undefined; type: SetType }[] = [];
  for (const set of exercise.sets) {
    const reps = set.targetDurationSeconds !== undefined ? `${set.targetDurationSeconds}s`
      : set.targetReps === undefined ? exercise.repRange
      : set.targetRepsMin !== undefined && set.targetRepsMin < set.targetReps ? `${set.targetRepsMin}–${set.targetReps}` : String(set.targetReps);
    const rir = set.setType === SetType.WARMUP || set.targetDurationSeconds !== undefined ? undefined : set.targetRIR;
    const last = result[result.length - 1];
    if (last && last.reps === reps && last.rir === rir && last.type === set.setType) last.count++;
    else result.push({ count: 1, reps, rir, type: set.setType });
  }
  return result;
}
