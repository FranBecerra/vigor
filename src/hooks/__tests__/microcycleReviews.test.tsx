import React from 'react';
import { MicrocycleReviewsProvider, useMicrocycleReviews } from '../useMicrocycleReviews';
import { buildBioCycles, createMicrocycleReview } from '@/services/bio/microcycleReview';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner';
const mockWrite = jest.fn(), mockGet = jest.fn(), mockHistory = jest.fn();
const mockListeners = new Map<string, { next: (snapshot: any) => void; error: () => void; stop: jest.Mock }>();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path,
  onSnapshot: (path: string, next: any, error: any) => { const stop = jest.fn(); mockListeners.set(path, { next, error, stop }); return stop; } }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: { get: (...args: any[]) => mockGet(...args) }, workoutSessionRepository: { listByUser: (...args: any[]) => mockHistory(...args) } }));
jest.mock('@/services/repositories/BaseRepository', () => ({ BaseRepository: class {
  path: string; constructor(path: string) { this.path = path; } createLocally(...args: unknown[]) { return mockWrite(this.path, ...args); }
} }));
const plan: any = { id: 'plan', userId: 'owner', prescriptionMode: 'MANUAL', currentMicrocycleIndex: 0, plannedSessions: [{ index: 0, exercises: [] }], skippedSessions: { '0:0': 10 } };
const cycle = buildBioCycles('owner', [plan], [], 100)[0];
const snapshot = (entries: any[]) => ({ docs: entries.map(({ id, ...data }) => ({ id, data: () => data })) });
let reviews: ReturnType<typeof useMicrocycleReviews>;
function Probe() { reviews = useMicrocycleReviews(); return null; }
const Tree = () => <MicrocycleReviewsProvider><Probe /></MicrocycleReviewsProvider>;
const publish = (entries: any[] = []) => mockListeners.get(`users/${mockUid}/microcycleReviews`)!.next(snapshot(entries));
beforeEach(() => {
  mockUid = 'owner'; mockListeners.clear(); jest.clearAllMocks(); mockWrite.mockReset().mockResolvedValue('pending');
  mockGet.mockResolvedValue(plan); mockHistory.mockResolvedValue([]);
});
it('loads private feedback and persists reviewed, fresh, owned intentions without changing a plan', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); });
  expect(reviews.ready).toBe(false); await expect(reviews.save(cycle, { recovery: 'USUAL' })).rejects.toThrow('reviewsUnavailable');
  await act(async () => publish());
  await act(async () => reviews.save(cycle, { recovery: 'USUAL' }));
  expect(reviews.entries[0].answers).toEqual({ recovery: 'USUAL' });
  expect(mockWrite.mock.calls[0][0]).toBe('users/owner/microcycleReviews');
  expect(mockWrite.mock.calls[0][1]).toMatchObject({ id: 'plan:m0', userId: 'owner', questionnaireVersion: 1, status: 'SUBMITTED' });
  expect(mockGet).toHaveBeenCalledWith('plan'); expect(mockHistory).toHaveBeenCalledWith('owner');
  await act(async () => reviews.save(cycle, { recovery: 'BETTER' }));
  expect(reviews.entries).toHaveLength(1); expect(reviews.entries[0].answers.recovery).toBe('BETTER');
  await act(async () => tree.unmount());
});
it('retains dismissal across remounts, supports later completion and rejects malformed/foreign documents', async () => {
  const dismissed = createMicrocycleReview('owner', cycle, {}, 'DISMISSED', undefined, 100);
  let tree: any; await act(async () => { tree = create(<Tree />); }); await act(async () => publish([dismissed]));
  expect(reviews.entries[0].status).toBe('DISMISSED');
  await act(async () => reviews.save(cycle, { sustainability: 'YES' })); expect(reviews.entries[0].status).toBe('SUBMITTED');
  await act(async () => publish([{ ...dismissed, userId: 'other' }, { id: 'broken' }]));
  expect(reviews.error).toBe(true); expect(reviews.entries).toEqual([]);
  await expect(reviews.save(cycle, {})).rejects.toThrow('reviewsUnavailable');
  await act(async () => tree.unmount());
});
it('rejects reopened cycles, missing or foreign plans and write/read failures without publishing feedback', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); }); await act(async () => publish());
  for (const next of [null, { ...plan, userId: 'other' }, { ...plan, skippedSessions: {} }]) {
    mockGet.mockResolvedValueOnce(next);
    await act(async () => { await expect(reviews.save(cycle, { recovery: 'USUAL' })).rejects.toThrow(); });
  }
  mockHistory.mockRejectedValueOnce(Error('offline'));
  await act(async () => { await expect(reviews.save(cycle, { recovery: 'USUAL' })).rejects.toThrow('offline'); });
  mockWrite.mockRejectedValueOnce(Error('failed write'));
  await act(async () => { await expect(reviews.save(cycle, { recovery: 'USUAL' })).rejects.toThrow('failed write'); });
  expect(reviews.entries).toEqual([]);
  mockWrite.mockImplementationOnce(async (_path, _entry, _synced, rejected) => rejected(Error('denied')));
  await act(async () => { await expect(reviews.save(cycle, {}, 'DISMISSED')).rejects.toThrow('reviewSaveFailed'); });
  expect(reviews.error).toBe(true); expect(reviews.entries).toEqual([]);
  await act(async () => publish()); await act(async () => reviews.save(cycle, {}, 'DISMISSED'));
  await act(async () => mockWrite.mock.calls.at(-1)[3](Error('late cloud denial'))); expect(reviews.error).toBe(true);
  await act(async () => mockListeners.get('users/owner/microcycleReviews')!.error()); expect(reviews.ready).toBe(true);
  await act(async () => tree.unmount());
});
it('isolates account changes immediately and ignores stale reads, listeners and old save closures', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); });
  await act(async () => publish([createMicrocycleReview('owner', cycle, { recovery: 'WORSE' }, 'SUBMITTED', undefined, 100)]));
  const oldSave = reviews.save, listener = mockListeners.get('users/owner/microcycleReviews')!;
  mockUid = 'other'; await act(async () => tree.update(<Tree />));
  expect(listener.stop).toHaveBeenCalled(); expect(reviews.entries).toEqual([]);
  await expect(oldSave(cycle, {})).rejects.toThrow();
  await act(async () => listener.next(snapshot([createMicrocycleReview('owner', cycle, {}, 'DISMISSED', undefined, 100)])));
  expect(reviews.entries).toEqual([]);
  mockUid = null; await act(async () => tree.update(<Tree />)); expect(reviews.ready).toBe(true);
  await expect(reviews.save(cycle, {})).rejects.toThrow();
  await act(async () => tree.unmount());
});
it('serializes writes and does not leak a pending operation into another account', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); }); await act(async () => publish());
  let release!: () => void;
  mockWrite.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  let pending!: Promise<unknown>;
  await act(async () => { pending = reviews.save(cycle, { recovery: 'USUAL' }).catch((error) => error.message); });
  await expect(reviews.save(cycle, { recovery: 'BETTER' })).rejects.toThrow('reviewsUnavailable');
  mockUid = 'other'; await act(async () => tree.update(<Tree />));
  await act(async () => release()); expect(await pending).toBe('reviewSaveFailed'); expect(reviews.entries).toEqual([]);
  await act(async () => tree.unmount());
});
it('rejects a plan read that returns after the account changed, before any write', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); }); await act(async () => publish());
  let resolve!: (value: unknown) => void; mockGet.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const pending = reviews.save(cycle, { recovery: 'USUAL' }).catch((error) => error.message);
  mockUid = 'other'; await act(async () => tree.update(<Tree />)); await act(async () => resolve(plan));
  expect(await pending).toBe('reviewsUnavailable'); expect(mockWrite).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
