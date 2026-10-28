import { SetType, type Exercise, type WorkoutSession, type WorkoutSet } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { previousPerformance, applyPreviousPerformance, type PerformanceContext } from '../previousPerformance';
import type { SessionSetState } from '../sessionMapper';
const exercise = EXERCISE_CATALOGUE[0];
const context: PerformanceContext = { userId: 'owner', sessionId: 'current', mesocycleId: 'm', plannedSessionIndex: 0, performedAt: 1000 };
const row = (id = 'set', patch: Partial<SessionSetState> = {}): SessionSetState => ({ id, setType: SetType.NORMAL,
  targetWeight: 0, targetReps: 10, targetRIR: 2, isCompleted: false, isAutoFilled: false, ...patch });
const done = (weight: number, patch: Partial<WorkoutSet> = {}): WorkoutSet => ({ ...row(), actualWeight: weight, actualReps: 8, actualRIR: 1, completionState: 'DONE', ...patch });
const session = (id: string, at: number, sets = [done(20)], patch: Partial<WorkoutSession> = {}): WorkoutSession => ({ id, userId: 'owner', mesocycleId: 'm', microcycleId: 'micro',
  microcycleIndex: 0, plannedSessionIndex: 0, performedAt: at, completedAt: at + 1,
  exercises: [{ id: exercise.id, exerciseId: exercise.id, order: 0, isSwap: false, sets }], ...patch });
const hydrate = (history: WorkoutSession[], rows = [row()], item: Exercise = exercise, protectedLoads = new Set<string>()) =>
  applyPreviousPerformance({ [item.id]: rows }, previousPerformance([item], history, context), protectedLoads)[item.id];

it('prefers the previous execution of this prescribed session, otherwise falls back across sessions and mesocycles', () => {
  const same = session('same', 10, [done(20), done(17.5)]);
  const other = session('other', 100, [done(30)], { plannedSessionIndex: 1 });
  expect(hydrate([other, same], [row('a'), row('b')]).map((set) => set.targetWeight)).toEqual([20, 17.5]);
  expect(hydrate([other])[0]).toMatchObject({ previous: { weight: 30, reps: 8, rir: 1 }, targetWeight: 30, targetReps: 10, targetRIR: 2, isCompleted: false });
  expect(hydrate([session('new-meso', 200, [done(40)], { mesocycleId: 'older-plan' })])[0].targetWeight).toBe(40);
  expect(previousPerformance([exercise], [other, same], { ...context, plannedSessionIndex: undefined }).get(exercise.id)!.working[0]!.weight).toBe(30);
  expect(hydrate([session('unrelated', 500, [done(60)], { exercises: [] }), same])[0].targetWeight).toBe(20);
});
it('ignores unfinished, discarded, future, current, foreign-owner and malformed records', () => {
  const base = session('valid', 10);
  const invalid = [session('draft', 100, undefined, { completedAt: undefined }), session('discard', 100, undefined, { discardedAt: 300 }),
    session('future', 1100), session('current', 100), session('foreign', 100, undefined, { userId: 'other' }),
    session('bad-date', 100, undefined, { performedAt: NaN }), session('bad-complete', 100, undefined, { completedAt: NaN }),
    session('bad-structure', 100, undefined, { performedAt: null as any }), session('empty', 100, [])];
  expect(hydrate(invalid)[0].previous).toBeUndefined();
  expect(hydrate([...invalid, base])[0].targetWeight).toBe(20);
  expect(hydrate([session('stamp', 10, [done(25)], { performedAt: { seconds: 0, nanoseconds: 100000000 }, completedAt: { seconds: 0, nanoseconds: 200000000 } })])[0].targetWeight).toBe(25);
});
it('keeps set ordinals and warmups/top singles separate without inventing previous rows', () => {
  const history = [session('last', 10, [done(5, { setType: SetType.WARMUP }), done(50, { setType: SetType.TOP_SINGLE, actualReps: 1 }),
    done(20), done(25, { completionState: 'PENDING' }), done(17.5)])];
  const rows = [row('w', { setType: SetType.WARMUP }), row('s', { setType: SetType.TOP_SINGLE }), row('a'), row('b'), row('c'), row('extra')];
  const next = hydrate(history, rows);
  expect(next.map((set) => set.previous?.weight)).toEqual([5, 50, 20, undefined, 17.5, undefined]);
  expect(next.at(-1)!.targetWeight).toBe(17.5);
  expect(next[3].previous).toBeUndefined();
  expect(hydrate([session('partial', 100, [done(30, { completionState: 'PENDING' })]), session('earlier', 10)])[0].targetWeight).toBe(20);
});
it('does not replace actuals, corrections, protected drafts, fatigue suggestions or explicit loads', () => {
  const rows = [row('actual', { actualWeight: 35 }), row('done', { isCompleted: true, actualWeight: 40, actualReps: 10 }), row('protected'),
    row('explicit', { targetWeight: 60 }), row('correction', { completionWasRecorded: true }), row('fatigue', { isAutoFilled: true })];
  const next = hydrate([session('last', 10)], rows, exercise, new Set(['protected']));
  expect(next.map((set) => set.targetWeight)).toEqual([0, 0, 0, 60, 0, 0]);
  expect(next[0].actualWeight).toBe(35); expect(next[1].isCompleted).toBe(true);
  const baselines = previousPerformance([exercise], [session('last', 10)], context);
  const first = applyPreviousPerformance({ [exercise.id]: [row()] }, baselines);
  expect(applyPreviousPerformance(first, baselines)).toBe(first);
  const unknown = { other: [row()] }; expect(applyPreviousPerformance(unknown, baselines)).toBe(unknown);
});
it.each(['NONE', 'LEVEL', 'PER_HAND_KG', 'ASSISTANCE_KG'] as const)('uses compatible %s recording without changing its units', (load) => {
  const recording = { measure: 'SECONDS' as const, load }; const custom = { ...exercise, recording };
  const historical = session('timed', 10, [done(20, { recording, actualDurationSeconds: 30, actualLoadLevel: 3, actualRIR: undefined })]);
  const rows = hydrate([historical], [row('current', { recording, targetLoadLevel: 0, targetDurationSeconds: 45 })], custom);
  expect(rows[0].previous).toMatchObject({ weight: load === 'LEVEL' ? 3 : load === 'NONE' ? 0 : 20, reps: 30, rir: null });
  expect(rows[0].targetDurationSeconds).toBe(45);
  if (load === 'LEVEL') expect(rows[0].targetLoadLevel).toBe(3);
  expect(hydrate([session('incompatible', 100)], [row('current', { recording })], custom)[0].previous).toBeUndefined();
});
it('rejects invalid loads and effort, honors snapshots, and orders equal dates deterministically', () => {
  const invalid = [done(Infinity), done(10001), done(-1), done(20, { actualReps: 0 }), done(20, { actualReps: NaN })];
  expect(hydrate([session('bad', 100, invalid)])[0].previous).toBeUndefined();
  expect(hydrate([session('rir', 100, [done(0, { actualRIR: NaN })])])[0].previous!.rir).toBeNull();
  expect(hydrate([session('rir', 100, [done(0, { actualRIR: 6 })])])[0].previous!.rir).toBeNull();
  const a = session('a', 100, [done(25)]), b = session('b', 100, [done(30)]);
  expect(hydrate([b, a])[0].targetWeight).toBe(25);
  const recording = { measure: 'REPETITIONS' as const, load: 'LEVEL' as const };
  const custom = { ...exercise, recording }; const snap = session('snapshot', 100, [done(20, { actualLoadLevel: 4 })]);
  snap.exercises[0].exerciseSnapshot = custom;
  expect(hydrate([snap], [row('level', { recording })], custom)[0].targetLoadLevel).toBe(4);
  expect(hydrate([session('previous', 100, [done(20)])], [row('stale', { previous: { weight: 30, reps: 6, rir: 2 } })])[0].previous!.weight).toBe(20);
});
