import { Equipment, ExerciseApparatus, ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { cleanImportedExerciseNotes, createExerciseOverride, exerciseEditInput, mergeExerciseOverrides, validExerciseOverride } from '../exerciseEditing';
import { createCustomExercise } from '../customExercises';
import variants from '@/data/manual-exercise-variants.json';
const base = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'press-banca')!;
const input = () => exerciseEditInput(base);
it('keeps catalogue identity, provenance and history-independent base data while editing every exposed parameter', () => {
  const changed = { ...input(), name: 'Personal press', recording: { measure: 'SECONDS' as const, load: 'NONE' as const },
    primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS], secondaryMuscles: [MuscleGroup.DELTS_FRONT], equipment: Equipment.MACHINE,
    movementVectors: [MovementVector.PUSH_HORIZONTAL, MovementVector.ELBOW_EXTENSION], profile: ExerciseProfile.COMPOUND_SECONDARY,
    notes: 'My execution description', referenceUrl: 'https://example.com/press', laterality: 'PER_SIDE' as const,
    requiredApparatus: [ExerciseApparatus.SEAT, ExerciseApparatus.SEAT], criteria: { ...base.criteria!, stabilityCost: 5 as const } };
  const saved = createExerciseOverride(base, changed, 'owner', 10); const previous = JSON.stringify(base);
  expect(validExerciseOverride(saved, 'owner')).toBe(true); expect(validExerciseOverride(saved, 'other')).toBe(false);
  const view = mergeExerciseOverrides([base], [saved], 'owner')[0];
  expect(view).toMatchObject({ id: base.id, isCustom: false, isPersonalized: true, name: 'Personal press', notes: changed.notes,
    primaryMuscle: MuscleGroup.CHEST, primaryMuscles: changed.primaryMuscles, movementVectors: changed.movementVectors,
    criteria: changed.criteria, requiredApparatus: [ExerciseApparatus.SEAT], recording: changed.recording, laterality: 'PER_SIDE' });
  expect(JSON.stringify(base)).toBe(previous); expect(view.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
  expect(mergeExerciseOverrides([base], [saved], 'other')[0]).toBe(base);
  expect(mergeExerciseOverrides([base], [saved], null)[0]).toBe(base);
});
it('supports clearing descriptions/references/ratings without assigning fabricated automatic criteria', () => {
  const saved = createExerciseOverride(base, { ...input(), notes: '', referenceUrl: '', criteria: null }, 'owner', 1);
  expect(mergeExerciseOverrides([base], [saved], 'owner')[0]).toMatchObject({ notes: '', referenceUrl: '', criteria: undefined, generationTier: ExerciseGenerationTier.MANUAL_ONLY });
  const absent = createExerciseOverride(base, { ...input(), criteria: undefined, notes: undefined, referenceUrl: undefined, requiredApparatus: undefined }, 'owner', 0);
  expect(absent.changes).toMatchObject({ criteria: null, notes: '', referenceUrl: '' });
  expect(absent.changes).not.toHaveProperty('requiredApparatus');
  const unknown = { ...base, requiredApparatus: undefined };
  expect(exerciseEditInput(unknown)).not.toHaveProperty('requiredApparatus');
  expect(exerciseEditInput({ ...base, requiredApparatus: [ExerciseApparatus.SEAT] }).requiredApparatus).toEqual([ExerciseApparatus.SEAT]);
  expect(mergeExerciseOverrides([unknown], [createExerciseOverride(unknown, exerciseEditInput(unknown), 'owner', 1)], 'owner')[0].requiredApparatus).toBeUndefined();
});
it('retains ordinary automatic eligibility for fully classified, single-target personal ratings', () => {
  const changes = { ...input(), primaryMuscles: undefined, primaryMuscle: base.primaryMuscle,
    movementVectors: undefined, movementVector: base.movementVector };
  const saved = createExerciseOverride(base, changes, 'owner', 1);
  expect(mergeExerciseOverrides([base], [saved], 'owner')[0].generationTier).toBe(base.generationTier);
});
it.each([
  { primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS], secondaryMuscles: [] },
  { movementVectors: [MovementVector.PUSH_HORIZONTAL, MovementVector.ELBOW_EXTENSION] },
  { recording: { measure: 'SECONDS', load: 'TOTAL_KG' } }, { recording: { measure: 'REPETITIONS', load: 'LEVEL' } },
])('does not feed unsupported multi-target/pattern or nonstandard units into the automatic selector %#', (patch) => {
  const saved = createExerciseOverride(base, { ...input(), ...patch } as any, 'owner', 1);
  expect(mergeExerciseOverrides([base], [saved], 'owner')[0].generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
});
it.each(['primaryMuscles', 'profile', 'movementVectors', 'equipment'])('keeps incomplete personal classification manual-only: %s', (key) => {
  const value = key === 'primaryMuscles' || key === 'movementVectors' ? [] : key === 'profile' ? ExerciseProfile.UNCLASSIFIED : Equipment.UNSPECIFIED;
  const saved = createExerciseOverride(base, { ...input(), ...(key === 'primaryMuscles' ? { secondaryMuscles: [] } : {}), [key]: value }, 'owner', 1);
  expect(mergeExerciseOverrides([base], [saved], 'owner')[0].generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
});
it('does not promote rated customs or manual catalogue variants into automatic selection', () => {
  const custom = createCustomExercise({ name: 'My hold', recording: { measure: 'SECONDS', load: 'NONE' } }, 'owner', 'custom:owner:a', [], 1);
  const manual = EXERCISE_CATALOGUE.find((exercise) => exercise.id === variants.exercises[0].id)!;
  for (const exercise of [custom, manual]) {
    const saved = createExerciseOverride(exercise, { ...exerciseEditInput(exercise), criteria: base.criteria }, 'owner', 1);
    expect(mergeExerciseOverrides([exercise], [saved], 'owner')[0].generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
  }
  expect(() => createExerciseOverride(custom, exerciseEditInput(custom), 'other', 1)).toThrow('invalidIdentity');
  expect(exerciseEditInput(custom)).toMatchObject({ primaryMuscles: [], movementVectors: [], criteria: null, laterality: 'BILATERAL' });
});
it.each([null, {}, { ...input(), criteria: {} }, { ...input(), criteria: { ...base.criteria, stabilityCost: 0 } },
  { ...input(), criteria: { ...base.criteria, systemicFatigueCost: 6 } }, { ...input(), criteria: { ...base.criteria, loadProgressability: 2.5 } },
  { ...input(), criteria: { ...base.criteria, rangeOfMotion: NaN } }, { ...input(), criteria: 'bad' },
  { ...input(), requiredApparatus: ['bad'] }, { ...input(), requiredApparatus: 3 }, { ...input(), recording: undefined }])('rejects malformed editable metadata %#', (changes) => {
  expect(() => createExerciseOverride(base, changes as any, 'owner', 1)).toThrow();
  const invalid = { id: base.id, ownerId: 'owner', changes, updatedAt: 1 } as any;
  expect(validExerciseOverride(invalid, 'owner')).toBe(false);
  expect(mergeExerciseOverrides([base], [invalid], 'owner')[0]).toBe(base);
});
it.each([['', 1], ['owner', NaN], ['owner', -1]])('rejects missing owners and invalid timestamps', (owner, now) => {
  expect(() => createExerciseOverride(base, input(), owner as string, now as number)).toThrow();
});
it('rejects missing identities and preserves only a specifically identified legacy annotation cleanup', () => {
  expect(() => createExerciseOverride({ ...base, id: '' }, input(), 'owner', 1)).toThrow();
  expect(validExerciseOverride(null as any, 'owner')).toBe(false);
  expect(cleanImportedExerciseNotes()).toBe('');
  for (const exercise of variants.exercises) expect(cleanImportedExerciseNotes(`${exercise.notes}\nSource: Micro 1.html / Original exercise\nHammer Strength, seat 4`)).toBe('Hammer Strength, seat 4');
  expect(cleanImportedExerciseNotes('My note: no efficacy rating is assigned.\nSource: My own spreadsheet / notes')).toContain('My own spreadsheet');
});
