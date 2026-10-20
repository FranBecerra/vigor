import { Equipment, MuscleGroup, type Exercise } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { appendPreviewExercises, applyPreviewEdits } from '../previewEditing';
import { manualRoutineDocuments, resizeManualSessions } from '../manualRoutine';
import { sessionsForMicrocycle, withSessionOverride } from '../mesocycleEditing';
import { createCustomExercise } from '../customExercises';
import { TrainingGoal } from '../volumePlan';
import { equipmentCategory, filterExercisePicker, EXERCISE_EQUIPMENT_FILTERS } from '../exerciseFilters';
import { toRoutineView } from '../routineView';

const exercise = EXERCISE_CATALOGUE[0];
const catalogue = new Map([[exercise.id, exercise]]);
const sessions = () => appendPreviewExercises(resizeManualSessions([], 2), [0, 1].map((sessionIndex) => ({ sessionIndex, exerciseId: exercise.id })), catalogue, TrainingGoal.HYPERTROPHY);
const input = () => ({ userId: 'u', routineId: 'r', name: ' Manual plan ', goal: TrainingGoal.HYPERTROPHY,
  microcycles: 6, sessions: sessions(), catalogue, now: 1, active: true, accentColor: '#aaa' });
it('starts empty and preserves existing session objects when expanding', () => {
  const first = resizeManualSessions([], 1); expect(first[0].exercises).toEqual([]);
  const next = resizeManualSessions(first, 3); expect(next[0]).toBe(first[0]); expect(next.map((session) => session.index)).toEqual([0, 1, 2]);
});
it.each([0, 8, NaN, 1.5])('rejects an invalid session count: %s', (value) => expect(() => resizeManualSessions([], value)).toThrow());
it('persists a real manual prescription without calling the generator or inventing a recoverable target', () => {
  const initial = input(); const before = JSON.stringify(initial.sessions);
  const { routine, mesocycle } = manualRoutineDocuments(initial);
  expect(routine).toMatchObject({ name: 'Manual plan', activeMesocycleId: mesocycle.id, generation: { creationMode: 'MANUAL', split: 'MANUAL', experienceLevel: 'UNSPECIFIED' } });
  expect(mesocycle).toMatchObject({ prescriptionMode: 'MANUAL', sessionsPerMicrocycle: 2, projectedMicrocycles: 6 });
  expect(mesocycle.targetVolumePerGroup[exercise.primaryMuscle]).toBeGreaterThanOrEqual(6);
  for (let index = 0; index < 6; index++) expect(sessionsForMicrocycle(mesocycle, routine.generation.goal, index)).toEqual(mesocycle.plannedSessions);
  expect(JSON.stringify(initial.sessions)).toBe(before);
  const view = toRoutineView(routine, mesocycle, catalogue, { goal: (value) => value, focus: (value) => value });
  expect(view!.microcycles.every((microcycle) => !microcycle.isDeload)).toBe(true);
  const resolved = sessionsForMicrocycle(mesocycle, routine.generation.goal, 3); resolved[0].exercises[0].sets[0].targetRIR = 0;
  expect(mesocycle.plannedSessions![0].exercises[0].sets[0].targetRIR).not.toBe(0);
  const edited = { ...mesocycle.plannedSessions![0], name: 'Changed for M3' };
  const patch = withSessionOverride(mesocycle, 2, edited);
  expect(sessionsForMicrocycle({ ...mesocycle, sessionOverrides: patch }, routine.generation.goal, 2)[0].name).toBe('Changed for M3');
});
it.each([{ name: '' }, { userId: '' }, { now: NaN }, { microcycles: 0 }, { microcycles: 13 }, { goal: 'INVALID' }, { sessions: [] },
  { sessions: resizeManualSessions([], 2) }])('rejects invalid documents: %j', (patch) => expect(() => manualRoutineDocuments({ ...input(), ...patch } as never)).toThrow());
it.each([
  { order: -1 }, { order: 0.5 }, { restSeconds: -1 }, { restSeconds: 3601 }, { restSeconds: NaN },
  { sets: [] }, { set: { targetReps: 0 } }, { set: { targetRepsMin: 20, targetReps: 10 } },
  { set: { targetReps: 101 } }, { set: { targetRIR: -1 } }, { set: { targetRIR: 6 } },
  { set: { targetRIR: 1.5 } }, { set: { targetWeightKg: -1 } }, { set: { targetWeightKg: Infinity } },
  { set: { setType: 'INVALID' } },
])('rejects invalid manual dose fields: %j', ({ set, ...patch }) => {
  const list = sessions(); const entry = list[0].exercises[0];
  Object.assign(entry, patch);
  if (set) Object.assign(entry.sets[0], set);
  expect(() => manualRoutineDocuments({ ...input(), sessions: list })).toThrow('invalidPrescription');
});
it('rejects duplicate exercises within a day, bad prescriptions, missing references and foreign custom snapshots', () => {
  const duplicate = sessions(); duplicate[0].exercises.push(duplicate[0].exercises[0]);
  expect(() => manualRoutineDocuments({ ...input(), sessions: duplicate })).toThrow('duplicateExercise');
  const bad = sessions(); bad[0].exercises[0].sets[0].targetRIR = NaN;
  expect(() => manualRoutineDocuments({ ...input(), sessions: bad })).toThrow('invalidPrescription');
  expect(() => manualRoutineDocuments({ ...input(), catalogue: new Map() })).toThrow('invalidExercise');
  const custom = createCustomExercise({ name: 'Hold', recording: { measure: 'SECONDS', load: 'NONE' } }, 'foreign', 'custom:foreign:hold', [], 1);
  const timed = appendPreviewExercises(resizeManualSessions([], 1), [{ sessionIndex: 0, exerciseId: custom.id }], new Map([[custom.id, custom]]), TrainingGoal.HYPERTROPHY);
  expect(() => manualRoutineDocuments({ ...input(), sessions: timed })).toThrow('invalidExercise');
  const owned = { ...custom, id: 'custom:u:hold', ownerId: 'u' };
  const own = appendPreviewExercises(resizeManualSessions([], 1), [{ sessionIndex: 0, exerciseId: owned.id }], new Map([[owned.id, owned]]), TrainingGoal.HYPERTROPHY);
  const edited = applyPreviewEdits(own, { '0:0': { targetReps: 45 } });
  expect(manualRoutineDocuments({ ...input(), sessions: edited }).mesocycle.plannedSessions![0].exercises[0].sets[0].targetDurationSeconds).toBe(45);
});
it.each(Object.values(Equipment))('puts %s in exactly one material category without inventing equipment', (equipment) => {
  const ex = { ...exercise, equipment };
  expect(EXERCISE_EQUIPMENT_FILTERS.filter((category) => category !== 'ALL' && filterExercisePicker([ex], null, category).length)).toHaveLength(1);
  expect(filterExercisePicker([ex], null, equipmentCategory(equipment))).toEqual([ex]);
});
it('intersects filters, uses co-primary targets, excludes archived data, and does not match indirect muscles', () => {
  const ex: Exercise = { ...exercise, equipment: Equipment.MACHINE, primaryMuscle: MuscleGroup.CHEST,
    primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS], secondaryMuscles: [MuscleGroup.DELTS_FRONT] };
  expect(filterExercisePicker([ex], MuscleGroup.TRICEPS, 'MACHINES')).toEqual([ex]);
  expect(filterExercisePicker([ex], MuscleGroup.DELTS_FRONT, 'MACHINES')).toEqual([]);
  expect(filterExercisePicker([ex], null, 'FREE_WEIGHTS')).toEqual([]);
  expect(filterExercisePicker([{ ...ex, archivedAt: 1 }], null, 'ALL')).toEqual([]);
  expect(filterExercisePicker([{ ...ex, primaryMuscle: MuscleGroup.UNCLASSIFIED, primaryMuscles: [] }], MuscleGroup.UNCLASSIFIED, 'ALL')).toHaveLength(1);
});
