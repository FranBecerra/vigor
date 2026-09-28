/** Runtime adapter from a persisted prescription to the live workout screen. */
import { SetType, type Exercise, type PlannedSession } from '@/models';
import type { SessionSetsByExercise } from './sessionMapper';

/**
 * A stable id is crucial: reopening a live session restores its exact rows
 * instead of creating a parallel workout document or losing an added set.
 */
export function plannedSessionDocumentId(
  mesocycleId: string,
  microcycleIndex: number,
  plannedSessionIndex: number,
): string {
  return `${mesocycleId}:m${microcycleIndex}:s${plannedSessionIndex}`;
}

/** The microcycle is represented by its deterministic plan identity. */
export function plannedMicrocycleDocumentId(mesocycleId: string, microcycleIndex: number): string {
  return `${mesocycleId}:m${microcycleIndex}`;
}

/** Resolves a session's catalogue references in prescription order. */
export function exercisesForPlannedSession(
  session: PlannedSession,
  exerciseById: ReadonlyMap<string, Exercise>,
): Exercise[] {
  return [...session.exercises]
    .sort((a, b) => a.order - b.order)
    .map((planned) => exerciseById.get(planned.exerciseId))
    .filter((exercise): exercise is Exercise => exercise !== undefined);
}

/** Builds the editable set state without fabricating a first-session load. */
export function initialSetsForPlannedSession(session: PlannedSession): SessionSetsByExercise {
  const state: SessionSetsByExercise = {};
  [...session.exercises]
    .sort((a, b) => a.order - b.order)
    .forEach((exercise) => {
      state[exercise.exerciseId] = exercise.sets.map((set, index) => ({
        id: `${session.index}:${exercise.order}:${index}`,
        setType: set.setType,
        targetWeight: set.targetWeightKg ?? 0,
        targetReps: set.targetReps,
        targetRIR: set.targetRIR,
        isAutoFilled: false,
        isCompleted: false,
      }));
    });
  return state;
}

/** The next working effort when an athlete adds a set in the live screen. */
export function addedSetTargetRIR(session: PlannedSession, exerciseId: string): number {
  const exercise = session.exercises.find((entry) => entry.exerciseId === exerciseId);
  const working = exercise?.sets.filter((set) => set.setType !== SetType.TOP_SINGLE) ?? [];
  return working.at(-1)?.targetRIR ?? 2;
}
