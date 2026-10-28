import { SetType, type WorkoutSession } from '@/models';
import { editWorkoutHistory } from '../historyEditing';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { reviseSessionFeedback } from '../sessionFeedback';

const row = { id: 'set', setType: SetType.NORMAL, targetWeight: 30, targetReps: 10, targetRIR: 2, isAutoFilled: false,
  completionState: 'DONE' as const, actualWeight: 30, actualReps: 10, actualRIR: 2 };
const original: WorkoutSession = { id: 'workout', userId: 'owner', sessionName: 'Upper', mesocycleId: 'meso', microcycleId: 'micro', microcycleIndex: 0,
  performedAt: 1000, completedAt: 5000, exercises: [{ id: 'entry', exerciseId: EXERCISE_CATALOGUE[0].id, exerciseSnapshot: EXERCISE_CATALOGUE[0], order: 0, sets: [row], isSwap: false }] };
const draft = () => JSON.parse(JSON.stringify(original));
it('edits optional whole-session effort independently of set RIR, keeps its provenance and permits clearing it', () => {
  const first = editWorkoutHistory(original, 'owner', { ...draft(), sessionEffort: 8 }, 6000);
  expect(first.sessionFeedback).toEqual({ scale: 'VIGOR_SESSION_EFFORT_1_10_V1', effort: 8, recordedAt: 6000, timing: 'HISTORY_EDIT' });
  expect(first.exercises[0].sets[0].actualRIR).toBe(2);
  expect(editWorkoutHistory(first, 'owner', draft(), 7000).sessionFeedback).toEqual(first.sessionFeedback);
  expect(editWorkoutHistory(first, 'owner', { ...draft(), sessionEffort: null }, 7000).sessionFeedback).toMatchObject({ effort: null,
    revisions: [{ effort: 8, recordedAt: 6000, timing: 'HISTORY_EDIT' }] });
  expect(editWorkoutHistory(original, 'owner', { ...draft(), sessionEffort: null }, 7000)).not.toHaveProperty('sessionFeedback');
  expect(() => editWorkoutHistory(original, 'owner', { ...draft(), sessionEffort: 0 }, 7000)).toThrow();
  const atFinish = { ...original, sessionFeedback: reviseSessionFeedback(undefined, 7, 5000, 'AT_FINISH') };
  expect(editWorkoutHistory(atFinish, 'owner', { ...draft(), sessionEffort: 6 }, 7000).sessionFeedback?.revisions?.[0].timing).toBe('AT_FINISH');
});
it('rejects malformed collection payloads and preserves a legacy empty session label', () => {
  for (const exercises of [null, Array.from({ length: 101 }, () => original.exercises[0])]) expect(() => editWorkoutHistory(original, 'owner', { ...draft(), exercises }, 6000)).toThrow('invalidHistoryExercises');
  expect(editWorkoutHistory({ ...original, sessionName: undefined }, 'owner', { ...draft(), sessionName: '' }, 6000).sessionName).toBe('');
});
it('normalizes failure to RIR zero and keeps advanced subsegments separate from main and partial reps', () => {
  const input = draft(); input.exercises[0].sets[0].setType = SetType.FAILURE;
  expect(editWorkoutHistory(original, 'owner', input, 6000).exercises[0].sets[0].actualRIR).toBe(0);
  input.exercises[0].sets[0] = { ...row, setType: SetType.DROP_SET, actualPartialReps: 2, extensions: [{ weight: 20, reps: 4 }, { weight: 10, reps: 3 }] };
  expect(editWorkoutHistory(original, 'owner', input, 6000).exercises[0].sets[0]).toMatchObject({ actualReps: 10, actualPartialReps: 2, extensions: [{ weight: 20, reps: 4 }, { weight: 10, reps: 3 }] });
});
it('corrects execution only, preserving dates, identity, snapshot, progression and prescriptions', () => {
  const input = draft(); input.sessionName = ' Corrected '; input.sessionNote = ' Felt good ';
  input.exercises[0].sets[0] = { ...row, actualWeight: 35, actualPartialReps: 2, targetWeight: 999, targetReps: 999, targetRIR: 0, recording: { measure: 'SECONDS', load: 'NONE' } };
  const result = editWorkoutHistory(original, 'owner', input, 6000);
  expect(result).toMatchObject({ id: 'workout', performedAt: 1000, completedAt: 5000, editedAt: 6000, sessionName: 'Corrected', sessionNote: 'Felt good' });
  expect(result.exercises[0].sets[0]).toMatchObject({ targetWeight: 30, targetReps: 10, targetRIR: 2, actualWeight: 35, actualPartialReps: 2 });
  expect(result.exercises[0].sets[0].recording?.measure).not.toBe('SECONDS');
  expect(original.exercises[0].sets[0].actualWeight).toBe(30);
});
it('supports removing and adding sets and warmup correction without changing the routine', () => {
  const input = draft(); input.exercises[0].sets = [{ ...row, id: 'new', setType: SetType.WARMUP }];
  const result = editWorkoutHistory(original, 'owner', input, 6000);
  expect(result.exercises[0].sets).toHaveLength(1); expect(result.exercises[0].sets[0]).toMatchObject({ id: 'new', setType: SetType.WARMUP, targetReps: 10 });
  expect(editWorkoutHistory(original, 'owner', { ...input, exercises: [] }, 6000).exercises).toEqual([]);
});
it.each(['', 'other'])('rejects wrong ownership: %s', (owner) => expect(() => editWorkoutHistory(original, owner, draft(), 6000)).toThrow());
it.each([{ completedAt: undefined }, { discardedAt: 6000 }])('rejects incomplete/discarded records', (patch) => expect(() => editWorkoutHistory({ ...original, ...patch }, 'owner', draft(), 6000)).toThrow());
it.each([NaN, Infinity, 0])('rejects invalid edit time %s', (now) => expect(() => editWorkoutHistory(original, 'owner', draft(), now)).toThrow());
it.each([{ actualReps: -1 }, { actualReps: 0 }, { actualReps: 1.5 }, { actualReps: 1000 }, { actualWeight: NaN }, { actualWeight: Infinity }, { actualWeight: -1 },
  { actualRIR: 6 }, { actualRIR: Infinity }, { actualPartialReps: -1 }, { actualDurationSeconds: 3601 }, { actualLoadLevel: -1 }, { extensions: [{ reps: -2 }] },
  { id: '' }, { completionState: 'INVALID' }, { setType: 'INVALID' }])('rejects invalid set actuals %j', (patch) => {
  const input = draft(); Object.assign(input.exercises[0].sets[0], patch);
  expect(() => editWorkoutHistory(original, 'owner', input, 6000)).toThrow();
});
it('rejects injected exercises, duplicate identities and oversized text', () => {
  const input = draft(); input.exercises.push(input.exercises[0]);
  expect(() => editWorkoutHistory(original, 'owner', input, 6000)).toThrow();
  input.exercises = [{ ...input.exercises[0], exerciseId: 'different' }];
  expect(() => editWorkoutHistory(original, 'owner', input, 6000)).toThrow();
  expect(() => editWorkoutHistory(original, 'owner', { ...draft(), sessionName: 'x'.repeat(101) }, 6000)).toThrow();
  expect(() => editWorkoutHistory(original, 'owner', { ...draft(), sessionName: 'a\nb' }, 6000)).toThrow();
  input.exercises = draft().exercises; input.exercises[0].sets.push(input.exercises[0].sets[0]);
  expect(() => editWorkoutHistory(original, 'owner', input, 6000)).toThrow();
});
it('validates timed, level and no-load records using the preserved recording convention', () => {
  for (const load of ['NONE', 'LEVEL'] as const) {
    const timed = { ...original, exercises: [{ ...original.exercises[0], exerciseSnapshot: { ...EXERCISE_CATALOGUE[0], recording: { measure: 'SECONDS' as const, load } } }] };
    const input = JSON.parse(JSON.stringify(timed)); input.exercises[0].sets[0].actualDurationSeconds = 30; input.exercises[0].sets[0].actualLoadLevel = 3;
    expect(editWorkoutHistory(timed, 'owner', input, 6000).exercises[0].sets[0].actualDurationSeconds).toBe(30);
    delete input.exercises[0].sets[0].actualDurationSeconds; expect(() => editWorkoutHistory(timed, 'owner', input, 6000)).toThrow();
  }
});
