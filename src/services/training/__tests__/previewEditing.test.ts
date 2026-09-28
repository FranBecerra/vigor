import {
  Equipment,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  SetType,
  type Exercise,
  type PlannedSession,
} from '@/models';
import {
  applyPreviewEdits,
  previewEditKey,
  previewVolumeByMuscle,
} from '@/services/training/previewEditing';

const sessions: PlannedSession[] = [
  {
    index: 0,
    focus: 'PUSH',
    estimatedWorkMinutes: 20,
    exercises: [
      {
        exerciseId: 'press',
        order: 0,
        isEdited: false,
        sets: [
          { setType: SetType.NORMAL, targetRepsMin: 8, targetReps: 12, targetRIR: 2 },
          { setType: SetType.NORMAL, targetRepsMin: 8, targetReps: 12, targetRIR: 1 },
        ],
      },
    ],
  },
];

describe('previewEditing', () => {
  it('uses a stable session/order key', () => {
    expect(previewEditKey(2, 4)).toBe('2:4');
  });

  it('changes exercise, set count and rep range without mutating the base plan', () => {
    const edited = applyPreviewEdits(sessions, {
      '0:0': { exerciseId: 'machine-press', sets: 3, targetRepsMin: 10, targetReps: 15 },
    });

    expect(edited[0].exercises[0]).toMatchObject({
      exerciseId: 'machine-press',
      isEdited: true,
    });
    expect(edited[0].exercises[0].sets).toHaveLength(3);
    expect(edited[0].exercises[0].sets[2]).toMatchObject({
      targetRepsMin: 10,
      targetReps: 15,
    });
    expect(sessions[0].exercises[0].sets).toHaveLength(2);
  });

  it('leaves untouched exercises referentially unchanged', () => {
    const edited = applyPreviewEdits(sessions, {});
    expect(edited[0].exercises[0]).toBe(sessions[0].exercises[0]);
  });

  it('supports a set-only edit and an empty legacy exercise safely', () => {
    const empty: PlannedSession = {
      ...sessions[0],
      index: 1,
      exercises: [{ ...sessions[0].exercises[0], exerciseId: 'empty', sets: [] }],
    };
    const edited = applyPreviewEdits([sessions[0], empty], {
      '0:0': { sets: 1 },
      '1:0': { exerciseId: 'replacement' },
    });
    expect(edited[0].exercises[0].sets).toHaveLength(1);
    expect(edited[1].exercises[0].sets).toEqual([]);
    expect(edited[1].exercises[0].exerciseId).toBe('replacement');
  });

  it('summarises direct and secondary volume after edits', () => {
    const press: Exercise = {
      id: 'press',
      name: 'Press',
      primaryMuscle: MuscleGroup.CHEST,
      secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.BICEPS],
      movementVector: MovementVector.PUSH_HORIZONTAL,
      profile: ExerciseProfile.COMPOUND_PRIMARY,
      equipment: Equipment.BARBELL,
      criteria: {
        stretchedPositionLoading: 3,
        rangeOfMotion: 3,
        resistanceProfileMatch: 3,
        stabilityCost: 3,
        loadProgressability: 3,
        systemicFatigueCost: 3,
      },
      isCustom: false,
    };
    expect(previewVolumeByMuscle(sessions, new Map([[press.id, press]]))).toEqual([
      { muscle: MuscleGroup.CHEST, sets: 2 },
      { muscle: MuscleGroup.BICEPS, sets: 1 },
      { muscle: MuscleGroup.TRICEPS, sets: 1 },
    ]);
    expect(previewVolumeByMuscle(sessions, new Map())).toEqual([]);
  });
});
