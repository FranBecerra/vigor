import { SetType, type Mesocycle, type PlannedSession, type WorkoutSession } from '@/models';
import { sessionsForMicrocycle, sessionProgressionProposal, sessionKey } from './mesocycleEditing';
import { isSetCompleted } from './sessionMapper';
import { hasSessionRIRChanges, type ProgressionStep } from './rirReplanning';

/** Explicit review only: achieved load/repetitions never become future targets. */
export function historyProgressionProposal(mesocycle: Mesocycle, goal: string, workout: WorkoutSession,
  history: readonly WorkoutSession[]): ProgressionStep[] {
  if (workout.userId !== mesocycle.userId || workout.mesocycleId !== mesocycle.id || workout.completedAt === undefined
    || workout.discardedAt !== undefined || !Number.isInteger(workout.microcycleIndex) || workout.microcycleIndex < 0
    || !Number.isInteger(workout.plannedSessionIndex) || workout.plannedSessionIndex! < 0) throw Error('invalidHistoryProgression');
  const base = sessionsForMicrocycle(mesocycle, goal, workout.microcycleIndex).find(s => s.index === workout.plannedSessionIndex);
  if (!base) throw Error('invalidHistoryProgression');
  const edited: PlannedSession = { ...base, exercises: base.exercises.map(exercise => {
    const recorded = workout.exercises.find(entry => entry.exerciseId === exercise.exerciseId)?.sets
      .filter(set => set.setType !== SetType.WARMUP && set.setType !== SetType.TOP_SINGLE) ?? [];
    let ordinal = 0;
    return { ...exercise, sets: exercise.sets.map(set => {
      if (set.setType === SetType.WARMUP || set.setType === SetType.TOP_SINGLE) return { ...set };
      const actual = recorded[ordinal++];
      if (set.targetDurationSeconds !== undefined) return { ...set };
      return actual && isSetCompleted(actual) && actual.recording?.measure !== 'SECONDS' && typeof actual.actualRIR === 'number'
        && Number.isInteger(actual.actualRIR) && actual.actualRIR >= 0 && actual.actualRIR <= 5
        ? { ...set, targetRIR: set.setType === SetType.FAILURE ? 0 : actual.actualRIR } : { ...set };
    }) };
  }) };
  if (!hasSessionRIRChanges(base, edited)) return [];
  const locked = history.filter(s => s.userId === workout.userId && s.mesocycleId === workout.mesocycleId
    && s.plannedSessionIndex === workout.plannedSessionIndex && s.discardedAt === undefined
    && (s.completedAt !== undefined || s.exercises.some(entry => entry.sets.some(isSetCompleted)))).map(s => s.microcycleIndex);
  const earliest = Math.max(workout.microcycleIndex + 1, mesocycle.currentMicrocycleIndex);
  return sessionProgressionProposal(mesocycle, goal, workout.microcycleIndex, edited, locked)
    .filter(step => step.index >= earliest);
}

/** Bounded effort overrides; keep all other session revisions and completed history unchanged. */
export function historyProgressionPatch(mesocycle: Mesocycle, steps: readonly ProgressionStep[]) {
  return { sessionOverrides: { ...mesocycle.sessionOverrides,
    ...Object.fromEntries(steps.map(step => [sessionKey(step.index, step.session.index), step.session])) } };
}
