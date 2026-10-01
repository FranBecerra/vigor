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
  appendPreviewExercises,
  previewEditKey,
  previewVolumeByMuscle,
  previewVolumeBreakdownByMuscle,
  representativeSet,
  underfilledSessionIndexes,
  visibleVolumeComponents,
} from '@/services/training/previewEditing';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { TrainingGoal } from '@/services/training/volumePlan';

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
  it('adds unscored JM and Kaz manually with editable prescriptions and no fabricated load', () => {
    const catalogue = new Map(EXERCISE_CATALOGUE.map((e) => [e.id, e]));
    const result = appendPreviewExercises(sessions, ['guide-211', 'guide-210'].map((exerciseId) =>
      ({ sessionIndex: 0, exerciseId })), catalogue, TrainingGoal.HYPERTROPHY);
    expect(result[0].exercises).toHaveLength(3);
    for (const added of result[0].exercises.slice(1)) {
      expect(added.isEdited).toBe(true);
      expect(added.sets).toHaveLength(3);
      expect(added.sets.every((set) => set.targetRepsMin! <= set.targetReps && Number.isFinite(set.targetRIR))).toBe(true);
      expect(added.sets.every((set) => set.targetWeightKg === undefined)).toBe(true);
    }
    const volume = previewVolumeBreakdownByMuscle(result, catalogue);
    expect(volume.find((row) => row.muscle === MuscleGroup.TRICEPS)?.directSets).toBe(6);
  });
  it('persists rest changes with bounded seconds while ignoring non-finite input', () => {
    expect(applyPreviewEdits(sessions, { '0:0': { restSeconds: 180 } })[0].exercises[0].restSeconds).toBe(180);
    expect(applyPreviewEdits(sessions, { '0:0': { restSeconds: -1 } })[0].exercises[0].restSeconds).toBe(0);
    expect(applyPreviewEdits(sessions, { '0:0': { restSeconds: 1000 } })[0].exercises[0].restSeconds).toBe(600);
    expect(applyPreviewEdits(sessions, { '0:0': { restSeconds: NaN } })[0].exercises[0].restSeconds).toBeUndefined();
    expect(sessions[0].exercises[0].restSeconds).toBeUndefined();
  });
  it('rechecks underfilled sessions after manual set edits and ignores invalid floors', () => {
    const twelve = applyPreviewEdits(sessions, { '0:0': { sets: 12 } });
    expect(underfilledSessionIndexes(twelve, 12)).toEqual([]);
    expect(underfilledSessionIndexes(applyPreviewEdits(twelve, { '0:0': { sets: 11 } }), 12))
      .toEqual([0]);
    expect(underfilledSessionIndexes(sessions, 0)).toEqual([]);
    expect(underfilledSessionIndexes([], 12)).toEqual([]);
  });

  it('adds a chosen exercise with editable goal-specific sets and ignores missing or repeated IDs', () => {
    const chosen = EXERCISE_CATALOGUE.find((exercise) => exercise.id !== 'press')!;
    const catalogue = new Map([[chosen.id, chosen]]);
    const added = appendPreviewExercises(sessions, [
      { sessionIndex: 0, exerciseId: chosen.id },
      { sessionIndex: 0, exerciseId: chosen.id },
      { sessionIndex: 0, exerciseId: 'missing' },
      { sessionIndex: 8, exerciseId: chosen.id },
    ], catalogue, TrainingGoal.HYPERTROPHY);
    expect(added[0].exercises).toHaveLength(2);
    expect(added[0].exercises[1]).toMatchObject({
      exerciseId: chosen.id, order: 1, isEdited: true,
    });
    expect(added[0].exercises[1].sets).toHaveLength(3);
    expect(added[0].exercises[1].sets.every((set) => set.targetRepsMin! <= set.targetReps)).toBe(true);
    expect(sessions[0].exercises).toHaveLength(1);
    expect(applyPreviewEdits(added, { '0:1': { sets: 4 } })[0].exercises[1].sets).toHaveLength(4);
  });
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

  it('changes only the requested set RIR and recalculates its suggested load', () => {
    const loaded: PlannedSession[] = [{ ...sessions[0], exercises: [{
      ...sessions[0].exercises[0], sets: sessions[0].exercises[0].sets.map((set) => ({
        ...set, targetWeightKg: 120,
      })),
    }] }];
    const edited = applyPreviewEdits(loaded, { '0:0': { rirBySet: { 1: 0 } } });
    expect(edited[0].exercises[0].sets[0].targetRIR).toBe(2);
    expect(edited[0].exercises[0].sets[1].targetRIR).toBe(0);
    expect(edited[0].exercises[0].sets[1].targetWeightKg).toBeGreaterThan(120);
    expect(edited[0].exercises[0].manualRIRBySet).toEqual({ 1: 0 });
    expect(loaded[0].exercises[0].sets[1].targetRIR).toBe(1);
  });

  it('clears manual RIR for removed sets and updates a suggested load when reps change', () => {
    const loaded: PlannedSession[] = [{ ...sessions[0], exercises: [{
      ...sessions[0].exercises[0], manualRIRBySet: { 1: 0 },
      sets: sessions[0].exercises[0].sets.map((set) => ({ ...set, targetWeightKg: 120 })),
    }] }];
    const reduced = applyPreviewEdits(loaded, { '0:0': { sets: 1, targetReps: 10 } });
    expect(reduced[0].exercises[0].manualRIRBySet).toBeUndefined();
    expect(reduced[0].exercises[0].sets[0].targetWeightKg).toBeGreaterThan(120);
  });

  it('never carries a previous exercise load or RIR override into a swap', () => {
    const loaded: PlannedSession[] = [{ ...sessions[0], exercises: [{
      ...sessions[0].exercises[0], manualRIRBySet: { 1: 0 },
      sets: sessions[0].exercises[0].sets.map((set) => ({ ...set, targetWeightKg: 120 })),
    }] }];
    const swapped = applyPreviewEdits(loaded, { '0:0': { exerciseId: 'machine-press' } })
      [0].exercises[0];
    expect(swapped.exerciseId).toBe('machine-press');
    expect(swapped.sets.every((set) => set.targetWeightKg === undefined)).toBe(true);
    expect(swapped.manualRIRBySet).toBeUndefined();
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
    expect(previewVolumeBreakdownByMuscle(sessions, new Map([[press.id, press]]))
      .find((entry) => entry.muscle === MuscleGroup.BICEPS)).toMatchObject({
        directSets: 0, indirectSets: 1, sets: 1,
      });
    expect(previewVolumeByMuscle(sessions, new Map())).toEqual([]);
  });

  it('hides zero-valued direct or indirect breakdown labels', () => {
    expect(visibleVolumeComponents({ directSets: 3, indirectSets: 0 })).toEqual(['direct']);
    expect(visibleVolumeComponents({ directSets: 0, indirectSets: 1.5 })).toEqual(['indirect']);
    expect(visibleVolumeComponents({ directSets: 3, indirectSets: 1 })).toEqual(['direct', 'indirect']);
    expect(visibleVolumeComponents({ directSets: 0, indirectSets: 0 })).toEqual([]);
  });
});

describe('the heavy single under preview edits', () => {
  const withSingle: PlannedSession[] = [
    {
      index: 0,
      focus: 'LOWER',
      estimatedWorkMinutes: 20,
      exercises: [
        {
          exerciseId: 'squat',
          order: 0,
          isEdited: false,
          strengthRole: 'MAIN',
          restSeconds: 240,
          sets: [
            { setType: SetType.TOP_SINGLE, targetRepsMin: 1, targetReps: 1, targetRIR: 2 },
            { setType: SetType.NORMAL, targetRepsMin: 3, targetReps: 5, targetRIR: 3 },
            { setType: SetType.NORMAL, targetRepsMin: 3, targetReps: 5, targetRIR: 3 },
          ],
        },
      ],
    },
  ];

  it('describes an exercise by its last set, not by the single', () => {
    expect(representativeSet(withSingle[0].exercises[0].sets)?.targetReps).toBe(5);
    expect(representativeSet([])).toBeUndefined();
  });

  it('keeps the single fixed when the range or set count changes', () => {
    const [session] = applyPreviewEdits(withSingle, {
      [previewEditKey(0, 0)]: { sets: 4, targetRepsMin: 2, targetReps: 4 },
    });
    const sets = session.exercises[0].sets;
    expect(sets[0]).toEqual(withSingle[0].exercises[0].sets[0]);
    expect(sets).toHaveLength(4);
    sets.slice(1).forEach((set) => {
      expect(set.setType).toBe(SetType.NORMAL);
      expect(set.targetRepsMin).toBe(2);
      expect(set.targetReps).toBe(4);
    });
    expect(session.exercises[0].restSeconds).toBe(240);
  });
});
