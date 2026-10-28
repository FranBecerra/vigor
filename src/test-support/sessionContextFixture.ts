/** Synthetic strength context only; never reads or writes an athlete account. */
import { SetType, type Exercise, type Routine, type WorkoutSession } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import type { BioSessionInputs } from '@/services/bio/sessionContext';
import { MuscleGroup } from '@/models';
import { READINESS_FIXTURE_NOW } from './readinessFixture';

export const CONTEXT_UPPER = EXERCISE_CATALOGUE.find((exercise) => exercise.primaryMuscle === MuscleGroup.CHEST)!;
export const CONTEXT_LOWER = EXERCISE_CATALOGUE.find((exercise) => exercise.primaryMuscle === MuscleGroup.QUADS)!;
export function contextWorkout(exercise: Exercise = CONTEXT_UPPER, patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return { id: 'synthetic-workout', userId: 'synthetic', mesocycleId: 'other-plan', microcycleId: 'm0', microcycleIndex: 0,
    plannedSessionIndex: 0, performedAt: READINESS_FIXTURE_NOW - 2 * 3600000, completedAt: READINESS_FIXTURE_NOW - 3600000,
    exercises: [{ id: 'entry', exerciseId: exercise.id, exerciseSnapshot: exercise, order: 0, isSwap: false,
      sets: [{ id: 'main', setType: SetType.NORMAL, targetWeight: 40, targetReps: 10, targetRIR: 2, isAutoFilled: false,
        actualWeight: 40, actualReps: 10, actualRIR: 2, actualRIRSource: 'ATHLETE', completionState: 'DONE' }] }], ...patch };
}
export function sessionContextFixture(): BioSessionInputs {
  const routine: Routine = { id: 'synthetic-routine', userId: 'synthetic', name: 'Synthetic program', icon: 'dumbbell', accentColor: '#a5e900',
    isActive: true, activeMesocycleId: 'synthetic-plan', createdAt: 1, updatedAt: 1,
    generation: { goal: 'HYPERTROPHY', experienceLevel: 'INTERMEDIATE', split: 'UPPER_LOWER', sessionsPerMicrocycle: 2,
      minutesPerSession: 60, availableEquipment: [], priorityRegions: [], deprioritizedRegions: [], vetoedExerciseIds: [], seed: 1 } };
  return { owner: 'synthetic', routines: [routine], plans: [{ id: 'synthetic-plan', userId: 'synthetic', routineId: routine.id,
    status: 'ACTIVE', currentMicrocycleIndex: 0, projectedMicrocycles: 2, sessionsPerMicrocycle: 2, prescriptionMode: 'MANUAL',
    startedAt: 1, updatedAt: 1, targetVolumePerGroup: {}, plannedSessions: [CONTEXT_UPPER, CONTEXT_LOWER].map((exercise, index) => ({
      index, name: index === 0 ? 'Synthetic Upper' : 'Synthetic Lower', focus: index === 0 ? 'UPPER' : 'LOWER', estimatedWorkMinutes: 30,
      exercises: [{ exerciseId: exercise.id, order: 0, isEdited: false, sets: [0, 1].map(() => ({ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 })) }],
    })) }], history: [], reviews: [], reviewsAvailable: true, catalogue: new Map([CONTEXT_UPPER, CONTEXT_LOWER].map((exercise) => [exercise.id, exercise])),
    labels: { focus: (focus) => focus, goal: (goal) => goal }, now: READINESS_FIXTURE_NOW };
}
