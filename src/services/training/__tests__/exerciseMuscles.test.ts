import { MuscleGroup, MovementVector, SetType } from '@/models';
import { primaryMusclesOf } from '../exerciseMuscles';
import { createCustomExercise } from '../customExercises';
import { appendPreviewExercises, previewVolumeBreakdownByMuscle } from '../previewEditing';
import { muscleSetVolume, totalWorkingSets } from '../sessionSummary';
import { partitionSwapCandidates, searchExercises } from '../exerciseSearch';
import { TrainingGoal } from '../volumePlan';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

const make = (patch: object = {}) => createCustomExercise({ name: 'Synthetic direct targets',
  recording: { measure: 'REPETITIONS', load: 'NONE' }, primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS],
  secondaryMuscles: [MuscleGroup.DELTS_FRONT], ...patch }, 'u', 'custom:u:targets', [], 1);
it('keeps legacy entries, unknown classification, and duplicate normalization explicit', () => {
  expect(primaryMusclesOf({ primaryMuscle: MuscleGroup.CHEST })).toEqual([MuscleGroup.CHEST]);
  expect(primaryMusclesOf({ primaryMuscle: MuscleGroup.UNCLASSIFIED })).toEqual([]);
  expect(primaryMusclesOf({ primaryMuscle: MuscleGroup.CHEST, primaryMuscles: [] })).toEqual([MuscleGroup.CHEST]);
  const ex = make({ primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS, MuscleGroup.CHEST] });
  expect(ex.primaryMuscles).toEqual([MuscleGroup.CHEST, MuscleGroup.TRICEPS]);
  expect(ex.primaryMuscle).toBe(MuscleGroup.CHEST);
  expect(primaryMusclesOf(ex)).toEqual(ex.primaryMuscles);
  expect(make({ primaryMuscles: [], secondaryMuscles: [] }).primaryMuscle).toBe(MuscleGroup.UNCLASSIFIED);
});
it.each([
  { primaryMuscles: ['INVALID'] }, { primaryMuscles: [MuscleGroup.UNCLASSIFIED] },
  { primaryMuscles: 'CHEST' }, { primaryMuscle: MuscleGroup.LATS },
  { secondaryMuscles: [MuscleGroup.TRICEPS] }, { primaryMuscles: [] },
])('rejects invalid or contradictory primary/secondary targets: %j', (patch) => expect(() => make(patch)).toThrow('invalidMuscles'));
it('attributes direct credit to each primary and never adds duplicate indirect credit or performed sets', () => {
  const ex = make(); const catalogue = new Map([[ex.id, ex]]);
  const sessions = appendPreviewExercises([{ index: 0, focus: 'FULL_BODY', estimatedWorkMinutes: 0, exercises: [] }],
    [{ sessionIndex: 0, exerciseId: ex.id }], catalogue, TrainingGoal.HYPERTROPHY);
  expect(sessions[0].exercises[0].exerciseSnapshot?.primaryMuscles).toEqual(ex.primaryMuscles);
  const breakdown = previewVolumeBreakdownByMuscle(sessions, new Map());
  expect(breakdown.find((row) => row.muscle === MuscleGroup.CHEST)).toMatchObject({ directSets: 3, indirectSets: 0 });
  expect(breakdown.find((row) => row.muscle === MuscleGroup.TRICEPS)).toMatchObject({ directSets: 3, indirectSets: 0 });
  const view = [{ exerciseId: ex.id, primaryMuscle: ex.primaryMuscle, primaryMuscles: ex.primaryMuscles,
    secondaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT, MuscleGroup.DELTS_FRONT],
    sets: [{ setType: SetType.WARMUP }, ...Array.from({ length: 3 }, () => ({ setType: SetType.NORMAL }))], targetRIR: 2, restSeconds: 60 }];
  expect(muscleSetVolume(view)).toEqual({ CHEST: 3, TRICEPS: 3, DELTS_FRONT: 1.5 });
  expect(totalWorkingSets(view)).toBe(3);
});
it('searches and groups swaps using any direct target, not only the legacy first target', () => {
  const ex = make({ secondaryMuscles: [] });
  const triceps = make({ primaryMuscles: [MuscleGroup.TRICEPS], secondaryMuscles: [] });
  expect(searchExercises('triceps', [ex], (muscle) => muscle)).toEqual([ex]);
  expect(partitionSwapCandidates(triceps, [ex]).related).toEqual([ex]);
});
it.each(Object.values(MovementVector))('has readable movement labels for %s in both form languages', (vector) => {
  for (const locale of [en, es]) {
    const value = (locale.custom.movements as Record<string, string>)[vector];
    expect(typeof value).toBe('string'); expect(value).not.toBe(vector); expect(value).not.toContain('_');
  }
});
