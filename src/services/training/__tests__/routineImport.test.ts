import source from '@/data/imports/2026-10-micro-1.json';
import variants from '@/data/manual-exercise-variants.json';
import { EXERCISE_CATALOGUE, criteriaOf, parseExercise } from '../exerciseCatalogue';
import { importAuthoredMicrocycle } from '../routineImport';
import { manualRoutineDocuments } from '../manualRoutine';
import { sessionsForMicrocycle } from '../mesocycleEditing';
import { searchExercises } from '../exerciseSearch';
import { exercisesForPlannedSession } from '../plannedSessionRuntime';
import { TrainingGoal } from '../volumePlan';
import { ExerciseGenerationTier, MuscleGroup, MovementVector } from '@/models';

const catalogue = new Map(EXERCISE_CATALOGUE.map((entry) => [entry.id, entry]));
const clone = () => JSON.parse(JSON.stringify(source)) as typeof source;
it('imports all 25 authored exercises in their exact session/order with the corrected 71 sets', () => {
  const before = JSON.stringify(source); const sessions = importAuthoredMicrocycle(source, catalogue);
  expect(sessions.map((session) => session.name)).toEqual(['Upper #1', 'Lower #1', 'Pull', 'Push']);
  expect(sessions.map((session) => session.exercises.length)).toEqual([7, 6, 6, 6]);
  expect(sessions.map((session) => session.exercises.reduce((sum, entry) => sum + entry.sets.length, 0))).toEqual([20, 16, 18, 17]);
  sessions.forEach((session, i) => session.exercises.forEach((entry, j) => {
    const expected = source.sessions[i].exercises[j];
    expect(entry.order).toBe(j); expect(entry.exerciseId).toBe(expected.exerciseId);
    expect(entry.sets.map((set) => set.targetRIR)).toEqual(expected.rir);
    expect(entry.sets.every((set) => set.targetRepsMin === expected.min && set.targetReps === expected.max)).toBe(true);
    expect(entry.restSeconds).toBeUndefined(); expect(entry.sets.every((set) => set.targetWeightKg === undefined)).toBe(true);
    expect(entry.manualRIRBySet).toBeUndefined();
  }));
  expect(sessions[0].exercises[4].sets.map((set) => set.targetRIR)).toEqual([2, 2]);
  expect(JSON.stringify(source)).toBe(before);
});
it('uses snapshots so an already-installed catalogue can resolve every exercise without a phone update', () => {
  const sessions = importAuthoredMicrocycle(source, catalogue);
  for (const session of sessions) expect(exercisesForPlannedSession(session, new Map()).map((entry) => entry.id))
    .toEqual(session.exercises.map((entry) => entry.exerciseId));
  expect(sessions[2].exercises[0].exerciseSnapshot?.notes).toContain('Hammer Strength');
});
it('preserves M1 exactly and opts into the existing effort progression and deload rather than locking future RIRs', () => {
  const sessions = importAuthoredMicrocycle(source, catalogue);
  const documents = manualRoutineDocuments({ userId: 'u', routineId: 'r', name: source.name, goal: TrainingGoal.HYPERTROPHY,
    microcycles: 6, sessions, catalogue, now: 1, active: false, accentColor: '#9BE317', automaticProgression: true });
  expect(documents.routine.isActive).toBe(false);
  expect(documents.routine.generation?.creationMode).toBe('MANUAL');
  expect(documents.mesocycle.prescriptionMode).toBe('AUTOMATIC');
  expect(sessionsForMicrocycle(documents.mesocycle, TrainingGoal.HYPERTROPHY, 0)).toEqual(sessions);
  const projection = Array.from({ length: 6 }, (_, index) => sessionsForMicrocycle(documents.mesocycle, TrainingGoal.HYPERTROPHY, index));
  expect(projection.map((days) => days.reduce((sum, day) => sum + day.exercises.reduce((inner, ex) => inner + ex.sets.length, 0), 0)))
    .toEqual([71, 71, 71, 71, 71, 45]);
  expect(projection[1][0].exercises[0].sets.map((set) => set.targetRIR)).not.toEqual(sessions[0].exercises[0].sets.map((set) => set.targetRIR));
  expect(projection[4][0].exercises[4].sets.map((set) => set.targetRIR)).toEqual([1, 1]);
  expect(projection[4][0].exercises[5].sets.map((set) => set.targetRIR)).toEqual([1, 1, 0]);
  expect(projection[5][0].exercises[0].sets.every((set) => set.targetRIR === 4)).toBe(true);
});
it('finds the mapped execution for every original English name, including aliases and plural forms', () => {
  for (const session of source.sessions) for (const entry of session.exercises) {
    expect(searchExercises(entry.sourceName, EXERCISE_CATALOGUE, (muscle) => muscle).map((exercise) => exercise.id)).toContain(entry.exerciseId);
  }
});
it('keeps added variants unscored and manual-only, with explicit unilateral leg extensions and retained renamed IDs', () => {
  for (const variant of variants.exercises) {
    const exercise = catalogue.get(variant.id)!;
    expect(exercise.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
    expect(exercise.criteria).toBeUndefined(); expect(() => criteriaOf(exercise)).toThrow();
  }
  expect(catalogue.get('extension-cuadriceps-unilateral')).toMatchObject({ laterality: 'PER_SIDE', primaryMuscle: MuscleGroup.QUADS, movementVector: MovementVector.KNEE_EXTENSION });
  expect(catalogue.get('guide-102')?.name).toBe('Jalón al pecho con agarre ancho');
  expect(catalogue.get('guide-122')?.name).toBe('Remo bajo en máquina (espalda media)');
  expect(searchExercises('jalon al pecho focus espalda alta', EXERCISE_CATALOGUE, m => m).map(e => e.id)).toContain('guide-102');
});
it.each(['notes', 'laterality'])('rejects malformed optional catalogue metadata: %s', (key) => {
  expect(() => parseExercise({ ...variants.exercises[0], [key]: key === 'notes' ? 42 : 'UNKNOWN' })).toThrow();
});
it('rejects missing entries, duplicates, empty sessions, invalid ranges and invalid RIRs', () => {
  expect(() => importAuthoredMicrocycle(source, new Map())).toThrow('invalidExercise');
  const bad = clone(); bad.sessions[0].exercises.push(bad.sessions[0].exercises[0]);
  expect(() => importAuthoredMicrocycle(bad, catalogue)).toThrow('invalidExercise');
  for (const change of [(data: typeof source) => { data.sessions = []; },
    (data: typeof source) => { data.sessions[0].exercises = []; },
    (data: typeof source) => { data.sessions[0].focus = 'UNKNOWN'; },
    (data: typeof source) => { data.sessions[0].exercises[0].min = 100; },
    (data: typeof source) => { data.sessions[0].exercises[0].rir = [NaN]; },
    (data: typeof source) => { data.sessions[0].exercises[0].rir = []; }]) {
    const changed = clone(); change(changed); expect(() => importAuthoredMicrocycle(changed, catalogue)).toThrow();
  }
});
