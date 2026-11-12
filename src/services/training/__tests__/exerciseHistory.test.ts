import { SetType, type WorkoutSession, type WorkoutSet } from '@/models';
import { exerciseHistory } from '../exerciseHistory';

const row = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({ id: 'set', setType: SetType.NORMAL,
  targetReps: 99, targetWeight: 999, targetRIR: 4, actualReps: 10, actualWeight: 75, actualRIR: 2,
  completionState: 'DONE', isAutoFilled: false, ...patch });
const workout = (patch: Partial<WorkoutSession> = {}): WorkoutSession => ({ id: 'one', userId: 'u',
  mesocycleId: 'm', microcycleId: 'mi', microcycleIndex: 0, performedAt: 1000, completedAt: 2000,
  sessionName: 'Upper', exercises: [{ id: 'entry', exerciseId: 'press', order: 0, isSwap: false, sets: [row()] }], ...patch });
const select = (history: WorkoutSession[], current?: string) => exerciseHistory('u', 'press', history, new Map(), 10000, current);

it('shows saved actuals newest first across sessions and routines without mutating records', () => {
  const older = workout(); const newer = workout({ id: 'two', performedAt: 3000, completedAt: 4000,
    sessionName: 'Full body', mesocycleId: 'other', microcycleIndex: 8 });
  const result = select([older, newer]);
  expect(result.map(entry => [entry.id, entry.sessionName])).toEqual([['two', 'Full body'], ['one', 'Upper']]);
  expect(result[0].exercises[0].sets[0]).toMatchObject({ weight: 75, quantity: 10, rir: 2 });
  expect(newer.exercises[0].sets[0].targetWeight).toBe(999);
  expect(select([older, newer], 'two').map(entry => entry.id)).toEqual(['one']);
});

it('uses latest corrections and excludes discarded, unfinished, foreign and future records', () => {
  const base = workout();
  expect(select([base, workout({ editedAt: 5000, sessionName: 'Corrected' })])[0].sessionName).toBe('Corrected');
  expect(select([base, workout({ editedAt: 5000, discardedAt: 5000 })])).toEqual([]);
  expect(select([workout({ userId: 'other' }), workout({ completedAt: undefined }),
    workout({ completedAt: 11000 }), workout({ performedAt: NaN }), workout({ exercises: [] })])).toEqual([]);
  expect(exerciseHistory('', 'press', [base], new Map(), 10000)).toEqual([]);
  expect(exerciseHistory('u', '', [base], new Map(), 10000)).toEqual([]);
  expect(exerciseHistory('u', 'press', [base], new Map(), NaN)).toEqual([]);
});

it('keeps completed warmups, partials and advanced segments but never pending or invalid actuals', () => {
  const input = workout(); input.exercises[0].sets = [row({ id: 'warmup', setType: SetType.WARMUP }),
    row({ id: 'drop', setType: SetType.DROP_SET, actualRIR: null, actualPartialReps: 3, extensions: [{ weight: 60, reps: 5 }] }),
    row({ id: 'pending', completionState: 'PENDING' }), row({ id: 'invalid', actualReps: 0 })];
  const exercise = select([input])[0].exercises[0];
  expect(exercise.completed).toBe(1);
  expect(exercise.sets.map(set => set.id)).toEqual(['warmup', 'drop']);
  expect(exercise.sets[1]).toMatchObject({ rir: null, partialReps: 3, extensions: [{ weight: 60, reps: 5 }] });
  input.exercises[0].sets = [row({ completionState: 'PENDING' })]; expect(select([input])).toEqual([]);
});

it('supports custom time/level records and timestamp objects without a catalogue entry', () => {
  const input = workout({ performedAt: { seconds: 1, nanoseconds: 0 }, completedAt: { seconds: 2, nanoseconds: 0 } });
  input.exercises[0].sets = [row({ recording: { measure: 'SECONDS', load: 'LEVEL' }, actualLoadLevel: 4, actualDurationSeconds: 30 })];
  expect(select([input])[0]).toMatchObject({ at: 1000, exercises: [{ sets: [{ seconds: true, weight: 4, quantity: 30 }] }] });
});
