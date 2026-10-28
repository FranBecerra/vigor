import React from 'react';
import { useSportActivities } from '../useSportActivities';
import { saveSportDraft } from '@/services/cardio/sportActivities';
import type { SportActivityDraft } from '@/models/sportActivity';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; const mockSave = jest.fn(), mockDiscard = jest.fn();
const mockListeners = new Map<string, { next: (snapshot: any) => void; error: () => void; stop: jest.Mock }>();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path,
  onSnapshot: (path: string, _options: unknown, next: any, error: any) => { const stop = jest.fn(); mockListeners.set(path, { next, error, stop }); return stop; } }));
jest.mock('@/services/cardio/sportActivityRepository', () => ({ sportActivityPath: (uid: string) => `users/${uid}/sportActivities`, SportActivityRepository: class {
  newId() { return 'new-id'; } save(...args: unknown[]) { return mockSave(...args); } discard(...args: unknown[]) { return mockDiscard(...args); }
} }));
const now = Date.UTC(2026, 9, 28, 12);
const draft: SportActivityDraft = { sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'RECORD', startAt: now - 3600000, durationMinutes: 60, timeZone: 'UTC', effort: null };
const entry = saveSportDraft('record', 'owner', draft, now);
let sports: ReturnType<typeof useSportActivities>;
function Probe() { sports = useSportActivities(); return null; }
const publish = (entries: any[] = []) => mockListeners.get(`users/${mockUid}/sportActivities`)!.next({ docs: entries.map((value) => ({ id: value.id, data: () => value })) });
beforeEach(() => { mockUid = 'owner'; jest.clearAllMocks(); mockListeners.clear(); mockSave.mockReset().mockResolvedValue(entry); mockDiscard.mockReset().mockResolvedValue({ ...entry, discardedAt: now + 1, revision: 2 }); });
it('subscribes privately, never writes on mount, queues explicit records, and removes a discarded entry', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(mockSave).not.toHaveBeenCalled(); expect(sports.ready).toBe(false);
  await expect(sports.save('record', null, draft)).rejects.toThrow('sportsUnavailable');
  await act(async () => publish()); expect(sports.newId()).toBe('new-id');
  await act(async () => sports.save('record', null, draft)); expect(sports.entries).toEqual([entry]);
  expect(mockSave).toHaveBeenCalledWith('record', null, draft, expect.any(Number), expect.any(Function), expect.any(Function));
  await act(async () => sports.discard(entry)); expect(sports.entries).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('filters corrupt/foreign records, hides discarded entries and retains warm entries during retry', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  await act(async () => publish([entry, { ...entry, id: 'discarded', discardedAt: now }, { ...entry, userId: 'other' }]));
  expect(sports.entries).toEqual([entry]); expect(sports.error).toBe(true);
  const old = mockListeners.get('users/owner/sportActivities')!;
  await act(async () => sports.reload()); expect(sports.entries).toEqual([entry]); expect(sports.ready).toBe(false);
  await act(async () => old.error()); expect(sports.error).toBe(false);
  await act(async () => publish([entry])); expect(sports.ready).toBe(true);
  await act(async () => mockListeners.get('users/owner/sportActivities')!.error()); expect(sports.error).toBe(true);
  await act(async () => tree.unmount());
});
it('prevents old and ABA account closures or late callbacks from exposing another owner’s data', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish([entry])); const oldSave = sports.save;
  const listener = mockListeners.get('users/owner/sportActivities')!;
  mockUid = 'other'; await act(async () => tree.update(<Probe />)); expect(sports.entries).toEqual([]); expect(listener.stop).toHaveBeenCalled();
  await act(async () => listener.next({ docs: [{ id: entry.id, data: () => entry }] })); expect(sports.entries).toEqual([]);
  await expect(oldSave('record', null, draft)).rejects.toThrow();
  mockUid = 'owner'; await act(async () => tree.update(<Probe />)); await act(async () => publish());
  await expect(oldSave('record', null, draft)).rejects.toThrow();
  mockUid = null; await act(async () => tree.update(<Probe />)); expect(sports.ready).toBe(true); expect(sports.newId()).toBe('');
  await expect(sports.save('record', null, draft)).rejects.toThrow(); await act(async () => tree.unmount());
});
it('serializes writes and ignores pending/rejected writes after owner change, retry or unmount', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish());
  let resolve!: (value: any) => void; mockSave.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const pending = sports.save('record', null, draft).catch((error) => error.message);
  await expect(sports.save('record', null, draft)).rejects.toThrow('sportsUnavailable');
  const reject = mockSave.mock.calls[0][5]; const current = mockSave.mock.calls[0][4]; expect(current()).toBe(true);
  await act(async () => sports.reload()); await act(async () => publish()); expect(current()).toBe(false);
  await act(async () => { reject(); resolve(entry); }); expect(await pending).toBe('staleSportOwner'); expect(sports.entries).toEqual([]); expect(sports.error).toBe(false);
  mockSave.mockResolvedValueOnce(entry); await act(async () => sports.save('record', null, draft));
  await act(async () => mockSave.mock.calls.at(-1)[5]()); expect(sports.error).toBe(true);
  await act(async () => sports.reload()); await act(async () => publish());
  mockSave.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const leaving = sports.save('record', null, draft).catch((error) => error.message);
  await act(async () => tree.unmount()); await act(async () => resolve(entry)); expect(await leaving).toBe('staleSportOwner');
});
it('sorts snapshots and optimistic saves deterministically and blocks writes while synchronization is uncertain', async () => {
  const a = { ...entry, id: 'a' }, b = { ...entry, id: 'b' };
  const later = saveSportDraft('later', 'owner', { ...draft, startAt: draft.startAt + 1000, durationMinutes: 30 }, now);
  let tree: any; await act(async () => { tree = create(<Probe />); });
  await act(async () => publish([b, later, a])); expect(sports.entries.map((item) => item.id)).toEqual(['later', 'a', 'b']);
  mockSave.mockResolvedValueOnce({ ...a, revision: 2 });
  await act(async () => sports.save('a', a, draft)); expect(sports.entries.map((item) => item.id)).toEqual(['later', 'a', 'b']);
  await act(async () => mockListeners.get('users/owner/sportActivities')!.error());
  await expect(sports.save('new', null, draft)).rejects.toThrow('sportsUnavailable');
  await act(async () => tree.unmount());
});
