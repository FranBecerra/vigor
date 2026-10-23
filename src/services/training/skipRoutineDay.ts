import type { Mesocycle, WorkoutSession } from '@/models';
import { sessionKey } from './mesocycleEditing';

/** Skip credit belongs to a prescription slot, never a fabricated completed workout. */
export function skipRoutineDay(meso: Mesocycle, owner: string, microcycle: number, sessionIndex: number,
  history: readonly WorkoutSession[], now: number) {
  if (meso.userId !== owner || !Number.isInteger(microcycle) || microcycle < meso.currentMicrocycleIndex
    || !Number.isInteger(sessionIndex) || !(meso.plannedSessions ?? []).some((session) => session.index === sessionIndex)
    || !Number.isFinite(now) || now <= 0
    || history.some((workout) => workout.userId === owner && workout.mesocycleId === meso.id
      && workout.microcycleIndex === microcycle && workout.plannedSessionIndex === sessionIndex
      && workout.completedAt !== undefined && workout.discardedAt === undefined)) throw Error('invalidRoutineSkip');
  return { skippedSessions: { ...meso.skippedSessions, [sessionKey(microcycle, sessionIndex)]: now } };
}
