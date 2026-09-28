import { ExerciseProfile, Equipment, MovementVector, MuscleGroup, SetType, type PlannedSession } from '@/models';
import {
  addedSetTargetRIR,
  exercisesForPlannedSession,
  initialSetsForPlannedSession,
  plannedMicrocycleDocumentId,
  plannedSessionDocumentId,
} from '@/services/training/plannedSessionRuntime';

const planned: PlannedSession = {
  index: 2, focus: 'PUSH', estimatedWorkMinutes: 30,
  exercises: [{ exerciseId: 'bench', order: 0, isEdited: false, sets: [
    { setType: SetType.NORMAL, targetReps: 8, targetRIR: 2, targetWeightKg: 82.5 },
    { setType: SetType.NORMAL, targetReps: 8, targetRIR: 1, targetWeightKg: 82.5 },
  ] }],
};

describe('planned session runtime adapter', () => {
  it('creates stable identities and editable prescribed sets', () => {
    expect(plannedSessionDocumentId('m1', 3, 2)).toBe('m1:m3:s2');
    expect(plannedMicrocycleDocumentId('m1', 3)).toBe('m1:m3');
    const sets = initialSetsForPlannedSession(planned).bench;
    expect(sets[0]).toMatchObject({ id: '2:0:0', targetWeight: 82.5, targetRIR: 2, isCompleted: false });
    expect(addedSetTargetRIR(planned, 'bench')).toBe(1);
  });

  it('preserves planned order and drops an unknown catalogue id', () => {
    const exercise = { id: 'bench', name: 'Bench', primaryMuscle: MuscleGroup.CHEST,
      secondaryMuscles: [], movementVector: MovementVector.PUSH_HORIZONTAL,
      profile: ExerciseProfile.COMPOUND_PRIMARY, equipment: Equipment.BARBELL, isCustom: false };
    expect(exercisesForPlannedSession(planned, new Map([['bench', exercise]])).map((item) => item.id)).toEqual(['bench']);
    expect(exercisesForPlannedSession(planned, new Map()).length).toBe(0);
  });
});
