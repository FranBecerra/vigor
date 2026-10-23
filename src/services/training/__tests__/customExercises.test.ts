import { Equipment, ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup, SetType, type WorkoutSession } from '@/models';
import { createCustomExercise, mergeExerciseCatalogue, normalizedExerciseName, recordingOf, supportsEstimatedMax, usesCustomRecording } from '../customExercises';
import { customCompletionPatch } from '../customRecording';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { appendPreviewExercises, applyPreviewEdits, previewVolumeBreakdownByMuscle } from '../previewEditing';
import { TrainingGoal, buildVolumePlan, REGION_OF_MUSCLE } from '../volumePlan';
import { selectExercises } from '../exerciseSelection';
import { initialSetsForPlannedSession, exercisesForPlannedSession } from '../plannedSessionRuntime';
import { isSetCompleted, isSessionEmpty, toWorkoutSession, toSessionSetsByExercise } from '../sessionMapper';
import { e1RMByExerciseFromHistory } from '../e1rmHistory';
import { prescriptionForMicrocycle } from '../microcyclePrescription';
import { averageTargetRIR } from '../sessionProgression';

it('routes edited builtin recording units through custom controls and preserves them through microcycles', () => {
  const original = EXERCISE_CATALOGUE[0];
  expect(usesCustomRecording(original)).toBe(false);
  expect(usesCustomRecording({ isCustom: true })).toBe(false);
  expect(usesCustomRecording({ isCustom: false, recording: { measure: 'REPETITIONS', load: 'LEVEL' } })).toBe(true);
  const edited = { ...original, isPersonalized: true, recording: { measure: 'SECONDS' as const, load: 'NONE' as const } };
  expect(usesCustomRecording(edited)).toBe(true);
  const map = new Map([[edited.id, edited]]);
  const base = { index: 0, focus: 'UPPER' as const, estimatedWorkMinutes: 0, exercises: [] };
  const added = appendPreviewExercises([base], [{ sessionIndex: 0, exerciseId: edited.id }], map, TrainingGoal.HYPERTROPHY);
  expect(added[0].exercises[0].exerciseSnapshot).toEqual(edited);
  expect(initialSetsForPlannedSession(added[0])[edited.id][0]).toMatchObject({ recording: edited.recording, targetDurationSeconds: 30, targetReps: 0 });
  for (const goal of [TrainingGoal.HYPERTROPHY, TrainingGoal.STRENGTH]) for (const index of [0, 3, 5]) {
    expect(prescriptionForMicrocycle(added, goal, index, 6)[0].exercises[0].sets).toEqual(added[0].exercises[0].sets);
  }
  const other = { ...base, exercises: [{ exerciseId: 'old', order: 0, isEdited: false, sets: [{ setType: SetType.NORMAL, targetReps: 8, targetRIR: 2 }] }] };
  const swapped = applyPreviewEdits([other], { '0:0': { exerciseId: edited.id } }, map);
  expect(swapped[0].exercises[0].exerciseSnapshot).toEqual(edited);
});
import { isValidCustomExercise } from '../customExercises';

const input = { name: '  Elbow   hold ', recording: { measure: 'SECONDS', load: 'NONE' } } as const;
const custom = () => createCustomExercise(input, 'owner', 'custom:owner:a', [], 1);
it('stores multiple patterns without mutating input and retains the first for legacy consumers', () => {
  const patterns = [MovementVector.PUSH_HORIZONTAL, MovementVector.ELBOW_EXTENSION, MovementVector.PUSH_HORIZONTAL];
  const ex = createCustomExercise({ ...input, movementVectors: patterns }, 'owner', 'custom:owner:patterns', [], 1);
  expect(ex.movementVectors).toEqual([MovementVector.PUSH_HORIZONTAL, MovementVector.ELBOW_EXTENSION]);
  expect(ex.movementVector).toBe(MovementVector.PUSH_HORIZONTAL);
  expect(isValidCustomExercise(ex, 'owner')).toBe(true);
  expect(patterns).toHaveLength(3);
  expect(createCustomExercise({ ...input, movementVectors: [] }, 'owner', 'custom:owner:empty', [], 1).movementVector).toBe(MovementVector.UNCLASSIFIED);
});
it.each([{ movementVectors: ['UNKNOWN'] }, { movementVectors: null }, { movementVectors: [MovementVector.UNCLASSIFIED] },
  { movementVectors: [MovementVector.PUSH_HORIZONTAL], movementVector: MovementVector.ELBOW_EXTENSION }])('rejects inconsistent patterns %j', (patch) => {
  expect(() => createCustomExercise({ ...input, ...patch } as never, 'owner', 'custom:owner:a', [], 1)).toThrow('invalidClassification');
});
it('rejects malformed stored custom documents instead of inventing metadata', () => {
  expect(isValidCustomExercise(custom(), 'owner')).toBe(true);
  for (const patch of [{ name: undefined }, { recording: undefined }, { createdAt: undefined },
    { updatedAt: NaN }, { archivedAt: -1 }, { secondaryMuscles: ['NOT_A_MUSCLE'] }]) {
    expect(mergeExerciseCatalogue([], [{ ...custom(), ...patch } as never], 'owner')).toEqual([]);
  }
});
it.each([TrainingGoal.HYPERTROPHY, TrainingGoal.STRENGTH])('never automatically progresses or deloads a manual custom prescription (%s)', (goal) => {
  const ex = custom();
  const sessions = appendPreviewExercises([{ index: 0, focus: 'FULL_BODY', exercises: [], estimatedWorkMinutes: 0 }],
    [{ sessionIndex: 0, exerciseId: ex.id }], new Map([[ex.id, ex]]), goal);
  for (let index = 0; index < 6; index++) {
    expect(prescriptionForMicrocycle(sessions, goal, index, 6)[0].exercises).toEqual(sessions[0].exercises);
  }
});
it('preserves units when swapping repetitions, seconds, and back, without an impossible minimum range', () => {
  const ex = custom();
  const builtin = EXERCISE_CATALOGUE[0];
  const catalogue = new Map([[ex.id, ex], [builtin.id, builtin]]);
  const sessions = [{ index: 0, focus: 'FULL_BODY' as const, estimatedWorkMinutes: 40, exercises: [{
    exerciseId: builtin.id, order: 0, isEdited: false,
    sets: [{ setType: SetType.NORMAL, targetReps: 5, targetRIR: 2, targetWeightKg: 80 }],
  }] }];
  const unchangedRange = applyPreviewEdits(sessions, { '0:0': { exerciseId: EXERCISE_CATALOGUE[1].id } }, catalogue);
  expect(unchangedRange[0].exercises[0].sets[0]).toEqual({ setType: SetType.NORMAL, targetReps: 5, targetRIR: 2 });
  const seconds = applyPreviewEdits(sessions, { '0:0': { exerciseId: ex.id } }, catalogue);
  expect(seconds[0].exercises[0]).toMatchObject({ exerciseSnapshot: ex, sets: [{ targetDurationSeconds: 30, targetReps: 0 }] });
  expect(seconds[0].exercises[0].sets[0].targetWeightKg).toBeUndefined();
  const back = applyPreviewEdits(seconds, { '0:0': { exerciseId: builtin.id } }, catalogue);
  expect(back[0].exercises[0].exerciseSnapshot).toBeUndefined();
  expect(back[0].exercises[0].sets[0]).toMatchObject({ targetReps: 12, targetRepsMin: 8 });
  expect(back[0].exercises[0].sets[0].targetDurationSeconds).toBeUndefined();
});
it('does not manufacture a RIR average or completion from time prescriptions or forged flags', () => {
  expect(averageTargetRIR([{ isTimed: true, exerciseId: 'hold', primaryMuscle: MuscleGroup.UNCLASSIFIED,
    secondaryMuscles: [], sets: [{ setType: SetType.NORMAL, targetRIR: 5 }], restSeconds: 0, targetRIR: 5 }])).toBe(0);
  expect(isSetCompleted({ completionState: 'DONE', recording: { measure: 'SECONDS', load: 'NONE' } } as never)).toBe(false);
});
it('creates an explicitly unclassified, unscored, manual private exercise', () => {
  const exercise = custom();
  expect(exercise.name).toBe('Elbow hold');
  expect(exercise).toMatchObject({ isCustom: true, ownerId: 'owner', primaryMuscle: MuscleGroup.UNCLASSIFIED,
    profile: ExerciseProfile.UNCLASSIFIED, equipment: Equipment.UNSPECIFIED, generationTier: ExerciseGenerationTier.MANUAL_ONLY });
  expect(exercise.criteria).toBeUndefined();
  expect(REGION_OF_MUSCLE[exercise.primaryMuscle]).toBeUndefined();
});
it('records optional details and copies muscle arrays', () => {
  const secondary = [MuscleGroup.TRICEPS, MuscleGroup.TRICEPS];
  const result = createCustomExercise({ ...input, primaryMuscle: MuscleGroup.CHEST, secondaryMuscles: secondary,
    notes: ' cue ', referenceUrl: ' https://example.org/demo ', laterality: 'PER_SIDE' }, 'owner', 'custom:owner:b', [], 2);
  expect(result.secondaryMuscles).toEqual([MuscleGroup.TRICEPS]);
  expect(result.notes).toBe('cue'); expect(result.referenceUrl).toBe('https://example.org/demo');
  expect(secondary).toHaveLength(2);
});
it('normalizes names, rejects active duplicates, but permits a replacement for archived or foreign names', () => {
  expect(normalizedExerciseName(' ＨＯＬＤ  ')).toBe('hold');
  expect(() => createCustomExercise(input, 'owner', 'custom:owner:b', [custom()], 2)).toThrow('duplicateName');
  expect(() => createCustomExercise(input, 'owner', 'custom:owner:b', [{ ...custom(), archivedAt: 2 }], 2)).not.toThrow();
  expect(() => createCustomExercise(input, 'owner', 'custom:owner:b', [{ ...custom(), ownerId: 'other' }], 2)).not.toThrow();
});
it.each([
  { name: '' }, { name: 'a'.repeat(121) }, { recording: { measure: 'DISTANCE', load: 'NONE' } },
  { recording: { measure: 'SECONDS', load: 'INVALID' } }, { primaryMuscle: 'INVALID' },
  { secondaryMuscles: [MuscleGroup.CHEST] }, { primaryMuscle: MuscleGroup.CHEST, secondaryMuscles: [MuscleGroup.CHEST] },
  { primaryMuscle: MuscleGroup.CHEST, secondaryMuscles: ['INVALID'] },
  { equipment: 'INVALID' }, { movementVector: 'INVALID' }, { profile: 'INVALID' },
  { notes: 'a'.repeat(2001) }, { referenceUrl: 'javascript:alert(1)' }, { referenceUrl: 'https://x/' + 'a'.repeat(1000) }, { laterality: 'INVALID' },
])('rejects invalid input: %j', (patch) => {
  expect(() => createCustomExercise({ ...input, ...patch } as never, 'owner', 'custom:owner:a', [], 1)).toThrow();
});
it.each([['', 'custom::a', 1], ['owner', 'global-id', 1], ['owner', 'custom:owner:a', NaN], ['owner', 'custom:owner:a', -1]] as const)
  ('rejects invalid identity/time', (owner, id, now) => expect(() => createCustomExercise(input, owner, id, [], now)).toThrow());
it('merges only private identities, retains archived references, and never imports ratings or automatic eligibility', () => {
  const builtin = EXERCISE_CATALOGUE[0];
  const ex = custom();
  const merged = mergeExerciseCatalogue([builtin], [ex, ex, { ...ex, id: builtin.id }, { ...ex, ownerId: 'other' },
    { ...ex, id: 'custom:owner:archived', archivedAt: 2, criteria: builtin.criteria, generationTier: ExerciseGenerationTier.STANDARD }], 'owner');
  expect(merged).toHaveLength(3);
  expect(merged[2].archivedAt).toBe(2); expect(merged[2].criteria).toBeUndefined();
  expect(merged[2].generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
  expect(mergeExerciseCatalogue([builtin], [ex], null)).toEqual([builtin]);
  const selected = selectExercises({ catalogue: merged, volumePlan: buildVolumePlan({ level: 'INTERMEDIATE', goal: TrainingGoal.HYPERTROPHY } as never), seed: 1 });
  expect(selected.selected.every((entry) => !entry.exercise.isCustom)).toBe(true);
});
it('preserves units and snapshots through add, editing, execution, persistence, archival and e1RM exclusion', () => {
  const ex = custom();
  const catalogue = new Map([[ex.id, ex]]);
  const sessions = appendPreviewExercises([{ index: 0, focus: 'FULL_BODY', exercises: [], estimatedWorkMinutes: 0 }],
    [{ sessionIndex: 0, exerciseId: ex.id }], catalogue, TrainingGoal.HYPERTROPHY);
  const edited = applyPreviewEdits(sessions, { '0:0': { targetReps: 45 } }, catalogue);
  expect(edited[0].exercises[0].sets[0]).toMatchObject({ targetDurationSeconds: 45, targetReps: 0 });
  expect(previewVolumeBreakdownByMuscle(edited, catalogue)).toEqual([]);
  expect(exercisesForPlannedSession(edited[0], new Map())[0].name).toBe(ex.name);
  const state = initialSetsForPlannedSession(edited[0]);
  const set = state[ex.id][0];
  Object.assign(set, customCompletionPatch(ex, set));
  expect(set.actualDurationSeconds).toBe(45); expect(set.actualReps).toBeUndefined();
  expect(isSetCompleted(set)).toBe(true); expect(isSessionEmpty(state)).toBe(false);
  const saved = toWorkoutSession({ sessionId: 's', userId: 'owner', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0,
    performedAt: 1, completedAt: 2, exerciseSnapshots: { [ex.id]: ex } }, [ex.id], state);
  expect(saved.exercises[0].exerciseSnapshot?.name).toBe('Elbow hold');
  const restored = toSessionSetsByExercise(saved);
  expect(restored[ex.id][0].isCompleted).toBe(true);
  Object.assign(restored[ex.id][0], customCompletionPatch(ex, restored[ex.id][0]));
  const pending = toWorkoutSession({ sessionId: 's', userId: 'owner', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0, performedAt: 1 }, [ex.id], restored);
  expect(toSessionSetsByExercise(pending)[ex.id][0].isCompleted).toBe(false);
  expect(e1RMByExerciseFromHistory([saved]).size).toBe(0);
});
it('does not reinterpret levels or assisted/custom work as an estimated maximum', () => {
  const ex = { ...custom(), recording: { measure: 'REPETITIONS', load: 'LEVEL' } as const };
  const set = { id: 's', setType: SetType.NORMAL, targetWeight: 0, targetReps: 10, targetRIR: 3, targetLoadLevel: 4, isAutoFilled: false, isCompleted: false };
  const patch = customCompletionPatch(ex, set);
  expect(patch).toMatchObject({ actualReps: 10, actualLoadLevel: 4 }); expect(patch.actualWeight).toBeUndefined();
  expect(supportsEstimatedMax(ex)).toBe(false);
  expect(supportsEstimatedMax(EXERCISE_CATALOGUE[0])).toBe(true);
  expect(recordingOf({})).toEqual({ measure: 'REPETITIONS', load: 'TOTAL_KG' });
  expect(() => customCompletionPatch(ex, { ...set, targetReps: 0 })).toThrow();
  expect(() => customCompletionPatch(ex, { ...set, targetLoadLevel: undefined })).toThrow();
});
