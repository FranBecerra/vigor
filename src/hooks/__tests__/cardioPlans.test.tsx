import React from 'react';
import { useCardioPlans } from '../useCardioPlans';
import { saveCardioProposal } from '@/services/cardio/savedCardioPlan';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; const mockSave = jest.fn(), mockArchive = jest.fn();
const mockListeners = new Map<string, { next: (snapshot: any) => void; error: () => void; stop: jest.Mock }>();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path,
  onSnapshot: (path: string, _options: unknown, next: any, error: any) => { const stop = jest.fn(); mockListeners.set(path, { next, error, stop }); return stop; } }));
jest.mock('@/services/cardio/cardioPlanRepository', () => ({ cardioPlanPath: (uid: string) => `users/${uid}/cardioPlans`, CardioPlanRepository: class {
  newId() { return 'new'; } save(...args: unknown[]) { return mockSave(...args); } archive(...args: unknown[]) { return mockArchive(...args); }
} }));
const now = Date.UTC(2026, 9, 29);
const plan = saveCardioProposal('p', 'owner', 'Base', { modalities: ['CYCLING'], profile: { schemaVersion: 1, modalities: {} }, cycleDays: 10,
  availableDays: [0, 3, 6], sessions: 2, cardioMinutes: 60, sessionMinutes: 30, maxActiveDays: 4, allowDoubles: false, strength: [] }, null, now);
let plans: ReturnType<typeof useCardioPlans>;
function Probe() { plans = useCardioPlans(); return null; }
const publish = (entries: any[] = [], pending = false) => mockListeners.get(`users/${mockUid}/cardioPlans`)!.next({ docs: entries.map(value => ({ id: value.id, data: () => value })), metadata: { hasPendingWrites: pending } });
beforeEach(() => { mockUid = 'owner'; jest.clearAllMocks(); mockListeners.clear(); mockSave.mockReset().mockResolvedValue(plan); mockArchive.mockReset().mockResolvedValue({ ...plan, archivedAt: now + 1 }); });
it('subscribes without writing, exposes pending versus synced, restores immutable proposals and archives explicitly', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(mockSave).not.toHaveBeenCalled(); expect(plans.ready).toBe(false);
  await expect(plans.save(plan)).rejects.toThrow(); await act(async () => publish()); expect(plans.newId()).toBe('new');
  await act(async () => plans.save(plan)); expect(plans.entries).toEqual([plan]);
  await act(async () => publish([plan], true)); expect(plans.pending).toBe(true);
  await act(async () => publish([plan])); expect(plans.pending).toBe(false);
  await act(async () => plans.archive(plan)); expect(plans.entries).toEqual([]); await act(async () => tree.unmount());
});
it('filters malformed/foreign/archived data, sorts ties and retains visible records on retry while blocking uncertain writes', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  const a = { ...plan, id: 'a' }, b = { ...plan, id: 'b' }, later = { ...plan, id: 'later', createdAt: now + 1 };
  await act(async () => publish([b, { ...plan, userId: 'other' }, { ...plan, archivedAt: now }, a, later]));
  expect(plans.entries.map(p => p.id)).toEqual(['later', 'a', 'b']); expect(plans.error).toBe(true);
  await expect(plans.save(plan)).rejects.toThrow(); const old = mockListeners.get('users/owner/cardioPlans')!;
  await act(async () => plans.reload()); expect(plans.entries).toHaveLength(3); expect(plans.ready).toBe(false);
  await act(async () => old.error()); expect(plans.error).toBe(false);
  await act(async () => publish([plan])); await act(async () => mockListeners.get('users/owner/cardioPlans')!.error()); expect(plans.error).toBe(true);
  await act(async () => tree.unmount());
});
it('isolates account changes, ABA ownership and late listener callbacks, including sign-out', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish([plan]));
  const oldSave = plans.save, listener = mockListeners.get('users/owner/cardioPlans')!;
  mockUid = 'other'; await act(async () => tree.update(<Probe />)); expect(plans.entries).toEqual([]); expect(listener.stop).toHaveBeenCalled();
  await act(async () => listener.next({ docs: [{ id: plan.id, data: () => plan }], metadata: {} })); expect(plans.entries).toEqual([]);
  await expect(oldSave(plan)).rejects.toThrow(); mockUid = 'owner'; await act(async () => tree.update(<Probe />)); await act(async () => publish());
  await expect(oldSave(plan)).rejects.toThrow(); mockUid = null; await act(async () => tree.update(<Probe />));
  expect(plans.ready).toBe(true); expect(plans.newId()).toBe(''); await expect(plans.save(plan)).rejects.toThrow(); await act(async () => tree.unmount());
});
it('serializes writes and ignores completions or rejection callbacks after retry/unmount', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish());
  let done!: (value: any) => void; mockSave.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
  const first = plans.save(plan).catch(e => e.message); await expect(plans.save(plan)).rejects.toThrow('cardioUnavailable');
  const current = mockSave.mock.calls[0][1], reject = mockSave.mock.calls[0][2]; expect(current()).toBe(true);
  await act(async () => plans.reload()); await act(async () => publish()); expect(current()).toBe(false);
  await act(async () => { reject(); done(plan); }); expect(await first).toBe('staleCardioOwner'); expect(plans.entries).toEqual([]); expect(plans.error).toBe(false);
  await act(async () => plans.save(plan)); await act(async () => mockSave.mock.calls.at(-1)[2]()); expect(plans.error).toBe(true);
  await act(async () => publish()); expect(plans.error).toBe(true);
  await act(async () => plans.reload()); await act(async () => publish());
  mockSave.mockImplementationOnce(() => new Promise(resolve => { done = resolve; })); const leaving = plans.save(plan).catch(e => e.message);
  await act(async () => tree.unmount()); await act(async () => done(plan)); expect(await leaving).toBe('staleCardioOwner');
});
