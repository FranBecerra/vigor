import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSessionPersistence } from '../useSessionPersistence';
import { SetType } from '@/models';
const { create, act } = require('react-test-renderer');
const mockGet = jest.fn();
const mockWrite = jest.fn();
jest.mock('@/services/repositories', () => ({ workoutSessionRepository: {
  get: (...args: unknown[]) => mockGet(...args), createLocally: (...args: unknown[]) => mockWrite(...args),
} }));
let result: ReturnType<typeof useSessionPersistence>;
const restore = jest.fn();
const sets = { hold: [{ id: 'one', setType: SetType.NORMAL, targetWeight: 0, targetReps: 0, targetRIR: 0,
  recording: { measure: 'SECONDS' as const, load: 'NONE' as const }, targetDurationSeconds: 30,
  actualDurationSeconds: 25, isAutoFilled: false, isCompleted: true }] };
const context = { sessionId: 'workout', userId: 'owner', mesocycleId: 'meso', microcycleId: 'micro', microcycleIndex: 0, performedAt: 1 };
function Probe() { result = useSessionPersistence({ context, exerciseOrder: ['hold'], setsByExercise: sets, onRestore: restore }); return null; }
beforeEach(() => {
  jest.clearAllMocks(); mockGet.mockResolvedValue(null); mockWrite.mockResolvedValue('pending');
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());
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
