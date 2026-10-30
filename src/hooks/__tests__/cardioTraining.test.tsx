import React from 'react';
import { useCardioBlocks, useCardioWorkouts } from '../useCardioTraining';
import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '@/test-support/cardioFixture';
import { startCardioWorkout } from '@/services/cardio/cardioWorkout';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; const mockSave = jest.fn();
const mockListeners = new Map<string, { next: (snapshot: any) => void; error: () => void; stop: jest.Mock }>();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path,
  onSnapshot: (path: string, _options: unknown, next: any, error: any) => { const stop = jest.fn(); mockListeners.set(path, { next, error, stop }); return stop; } }));
jest.mock('@/services/cardio/cardioTrainingRepository', () => ({ cardioTrainingPath: (uid: string, name: string) => `users/${uid}/${name}`, CardioTrainingRepository: class {
  newId() { return 'new'; } save(...args: unknown[]) { return mockSave(...args); }
} }));
const block = cardioFixture(); let blocks: ReturnType<typeof useCardioBlocks>, workouts: ReturnType<typeof useCardioWorkouts>;
function Probe() { blocks = useCardioBlocks(); workouts = useCardioWorkouts(); return null; }
const publish = (entries: any[] = [], name = 'cardioBlocks', pending = false) => mockListeners.get(`users/${mockUid}/${name}`)!.next({ docs: entries.map(value => ({ id: value.id, data: () => value })), metadata: { hasPendingWrites: pending } });
beforeEach(() => { mockUid = 'owner'; jest.clearAllMocks(); mockListeners.clear(); mockSave.mockReset().mockResolvedValue(block); });
it('subscribes to separate private records, validates both schemas and writes only explicit actions', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(mockSave).not.toHaveBeenCalled(); expect(blocks.ready).toBe(false);
  await expect(blocks.save(block, null)).rejects.toThrow(); await act(async () => publish()); expect(blocks.newId()).toBe('new');
  await act(async () => blocks.save(block, null)); expect(blocks.entries).toEqual([block]);
  const run = startCardioWorkout(block, block.slots[0].id, now, 'run'); await act(async () => publish([run], 'cardioWorkouts', true));
  expect(workouts.entries).toEqual([run]); expect(workouts.pending).toBe(true);
  await act(async () => publish([run], 'cardioWorkouts')); expect(workouts.pending).toBe(false);
  await act(async () => publish([run, { ...run, userId: 'foreign' }], 'cardioWorkouts')); expect(workouts.error).toBe(true);
  await act(async () => tree.unmount());
});
it('sorts ties, retains warm records on retry, blocks uncertain writes and latches delayed rejection', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  await act(async () => publish([{ ...block, id: 'b' }, { ...block, id: 'a' }, { ...block, id: 'later', updatedAt: now + 1 }]));
  expect(blocks.entries.map(b => b.id)).toEqual(['later', 'a', 'b']); const old = mockListeners.get('users/owner/cardioBlocks')!;
  mockSave.mockResolvedValueOnce({ ...block, id: 'b' }); await act(async () => blocks.save({ ...block, id: 'b' }, null));
  expect(blocks.entries.map(b => b.id)).toEqual(['later', 'a', 'b']);
  await act(async () => blocks.reload()); expect(blocks.entries).toHaveLength(3); expect(blocks.ready).toBe(false);
  await act(async () => old.error()); expect(blocks.error).toBe(false); await act(async () => publish());
  await act(async () => blocks.save(block, null)); await act(async () => mockSave.mock.calls.at(-1)[3]()); expect(blocks.error).toBe(true);
  await act(async () => publish()); expect(blocks.error).toBe(true); await expect(blocks.save(block, null)).rejects.toThrow();
  await act(async () => blocks.reload()); await act(async () => publish()); expect(blocks.error).toBe(false);
  await act(async () => mockListeners.get('users/owner/cardioBlocks')!.error()); expect(blocks.error).toBe(true); await act(async () => tree.unmount());
});
it('isolates account/ABA changes and late callbacks, including sign-out', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish([block]));
  const save = blocks.save, listener = mockListeners.get('users/owner/cardioBlocks')!;
  mockUid = 'other'; await act(async () => tree.update(<Probe />)); expect(blocks.entries).toEqual([]); expect(listener.stop).toHaveBeenCalled();
  await act(async () => listener.next({ docs: [{ id: block.id, data: () => block }], metadata: {} })); expect(blocks.entries).toEqual([]);
  await expect(save(block, null)).rejects.toThrow(); mockUid = 'owner'; await act(async () => tree.update(<Probe />)); await act(async () => publish()); await expect(save(block, null)).rejects.toThrow();
  mockUid = null; await act(async () => tree.update(<Probe />)); expect(blocks.ready).toBe(true); expect(blocks.newId()).toBe(''); await expect(blocks.save(block, null)).rejects.toThrow(); await act(async () => tree.unmount());
});
it('serializes writes and suppresses old retries/unmounted completions', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish());
  let done!: (value: any) => void; mockSave.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
  const pending = blocks.save(block, null).catch(e => e.message); await expect(blocks.save(block, null)).rejects.toThrow();
  const current = mockSave.mock.calls[0][2], reject = mockSave.mock.calls[0][3]; expect(current()).toBe(true);
  await act(async () => blocks.reload()); await act(async () => publish()); expect(current()).toBe(false);
  await act(async () => { reject(); done(block); }); expect(await pending).toBe('staleCardioOwner'); expect(blocks.error).toBe(false);
  mockSave.mockImplementationOnce(() => new Promise(resolve => { done = resolve; })); const leaving = blocks.save(block, null).catch(e => e.message);
  await act(async () => tree.unmount()); await act(async () => done(block)); expect(await leaving).toBe('staleCardioOwner');
});
