import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSessionPersistence } from '../useSessionPersistence';
import { SetType } from '@/models';
const { create, act } = require('react-test-renderer');
const mockGet = jest.fn();
const mockWrite = jest.fn();
const mockDiscard = jest.fn();
jest.mock('@/services/repositories', () => ({ workoutSessionRepository: {
  listByUser: (...args: unknown[]) => mockGet(...args).then((saved: unknown) => saved ? [saved] : []), createLocally: (...args: unknown[]) => mockWrite(...args),
  discardLocally: (...args: unknown[]) => mockDiscard(...args),
} }));
let result: ReturnType<typeof useSessionPersistence>;
const restore = jest.fn();
const sets = { hold: [{ id: 'one', setType: SetType.NORMAL, targetWeight: 0, targetReps: 0, targetRIR: 0,
  recording: { measure: 'SECONDS' as const, load: 'NONE' as const }, targetDurationSeconds: 30,
  actualDurationSeconds: 25, isAutoFilled: false, isCompleted: true }] };
const context = { sessionId: 'workout', userId: 'owner', mesocycleId: 'meso', microcycleId: 'micro', microcycleIndex: 0, performedAt: 1 };
function Probe() { result = useSessionPersistence({ context, exerciseOrder: ['hold'], setsByExercise: sets, onRestore: restore }); return null; }
beforeEach(() => {
  mockDiscard.mockResolvedValue(undefined);
  jest.clearAllMocks(); mockGet.mockResolvedValue(null); mockWrite.mockResolvedValue('pending');
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());
it('never overwrites an unread saved workout after a restore failure and allows a retry', async () => {
  mockGet.mockRejectedValueOnce(new Error('offline read failed'));
  let tree: any;
  await act(async () => { tree = create(<Probe />); });
  expect(result.restoreError).toBe(true); expect(result.hasRestored).toBe(false);
  await act(async () => { expect(await result.flush()).toBe(false); });
  expect(mockWrite).not.toHaveBeenCalled();
  mockGet.mockResolvedValueOnce({ id: 'workout', exercises: [], performedAt: 1 });
  await act(async () => result.retryRestore());
  expect(result.hasRestored).toBe(true); expect(result.restoreError).toBe(false);
  await act(async () => tree.unmount());
});
it('persists a started workout before the first completed set and restores its runtime', async () => {
  const emptySets = { hold: sets.hold.map((row) => ({ ...row, actualDurationSeconds: undefined, isCompleted: false })) };
  const runtime = { ...context, persistDraft: true, trainingGoal: 'HYPERTROPHY', sessionName: 'Upper',
    activeExerciseId: 'hold', restTimer: { startedAt: 50, durationSeconds: 120, anchorSetId: 'one' } };
  function StartedProbe() { result = useSessionPersistence({ context: runtime, exerciseOrder: ['hold'], setsByExercise: emptySets, onRestore: restore }); return null; }
  let tree: any;
  await act(async () => { tree = create(<StartedProbe />); });
  await act(async () => { expect(await result.flush()).toBe(true); });
  const saved = mockWrite.mock.calls.at(-1)[0];
  expect(saved).toMatchObject({ performedAt: 1, sessionName: 'Upper', activeExerciseId: 'hold', restTimer: runtime.restTimer,
    exercises: [{ sets: [{ completionState: 'PENDING' }] }] });
  await act(async () => tree.unmount());
  mockGet.mockResolvedValue(saved);
  await act(async () => { tree = create(<StartedProbe />); });
  expect(restore).toHaveBeenCalledWith(expect.any(Object), saved);
  await act(async () => tree.unmount());
});
it('allows offline completion and keeps completion on subsequent background or exit writes', async () => {
  let tree: any; let stateChange: ((state: AppStateStatus) => void) | undefined;
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    stateChange = listener; return { remove: jest.fn() };
  });
  await act(async () => { tree = create(<Probe />); });
  expect(result.hasRestored).toBe(true);
  await act(async () => { expect(await result.flush(200)).toBe(true); });
  expect(result.status).toBe('queued');
  expect(mockWrite.mock.calls[0][0]).toMatchObject({ completedAt: 200, exercises: [{ sets: [{ actualDurationSeconds: 25, completionState: 'DONE' }] }] });
  await act(async () => { stateChange!('background'); });
  expect(mockWrite.mock.calls[1][0].completedAt).toBe(200);
  await act(async () => tree.unmount());
  expect(mockWrite.mock.calls.at(-1)[0].completedAt).toBe(200);
  subscription.mockRestore();
});
it('ignores stale acknowledgments and surfaces a rejected current write', async () => {
  let tree: any;
  await act(async () => { tree = create(<Probe />); });
  await act(async () => { await result.flush(); });
  const oldSynced = mockWrite.mock.calls[0][1];
  await act(async () => { await result.flush(); });
  await act(async () => oldSynced());
  expect(result.status).toBe('queued');
  await act(async () => mockWrite.mock.calls[1][2](new Error('denied')));
  expect(result.status).toBe('error');
  await act(async () => tree.unmount());
});
it('does not report a cloud rejection during local acceptance as a successful save', async () => {
  mockWrite.mockImplementation(async (_data, _synced, rejected) => { rejected(new Error('denied')); return 'pending'; });
  let tree: any;
  await act(async () => { tree = create(<Probe />); });
  await act(async () => { expect(await result.flush()).toBe(false); });
  expect(result.status).toBe('error');
  await act(async () => tree.unmount());
});
it('discards a restored workout without resurrecting it on unmount and allows retry on failure', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  mockDiscard.mockRejectedValueOnce(Error('local failure'));
  await act(async () => { expect(await result.discard()).toBe(false); }); expect(result.status).toBe('error');
  await act(async () => { expect(await result.flush()).toBe(true); });
  await act(async () => { expect(await result.discard()).toBe(true); });
  expect(mockDiscard).toHaveBeenCalledWith(expect.objectContaining({ id: 'workout', userId: 'owner' }));
  const writes = mockWrite.mock.calls.length;
  await act(async () => { expect(await result.flush()).toBe(false); tree.unmount(); });
  expect(mockWrite).toHaveBeenCalledTimes(writes);
});
it('accepts an explicit note save with fresh text instead of the previous render context', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  await act(async () => { expect(await result.flush(undefined, { sessionNote: 'Today only', exerciseNotes: { hold: 'Seat 4' } })).toBe(true); });
  expect(mockWrite.mock.calls.at(-1)[0]).toMatchObject({ sessionNote: 'Today only', exercises: [{ notes: 'Seat 4' }] });
  await act(async () => tree.unmount());
  expect(mockWrite.mock.calls.at(-1)[0]).toMatchObject({ sessionNote: 'Today only', exercises: [{ notes: 'Seat 4' }] });
});
