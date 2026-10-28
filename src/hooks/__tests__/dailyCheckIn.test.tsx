import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDailyCheckIn } from '../useDailyCheckIn';
import { createDailyCheckIn, localCheckInDate } from '@/services/bio/dailyCheckIn';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner';
const mockWrite = jest.fn();
const mockListeners = new Map<string, { next: (snapshot: any) => void; error: () => void; stop: jest.Mock }>();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ doc: (_db: unknown, path: string) => path,
  onSnapshot: (path: string, _options: unknown, next: any, error: any) => { const stop = jest.fn(); mockListeners.set(path, { next, error, stop }); return stop; } }));
jest.mock('@/services/repositories/BaseRepository', () => ({ BaseRepository: class {
  path: string; constructor(path: string) { this.path = path; } createLocally(...args: unknown[]) { return mockWrite(this.path, ...args); }
} }));
const now = new Date(2026, 9, 26, 12).getTime();
let checkIn: ReturnType<typeof useDailyCheckIn>, appState: (status: AppStateStatus) => void;
function Probe() { checkIn = useDailyCheckIn(); return null; }
const publish = (entry?: any, pending = false) => mockListeners.get(`users/${mockUid}/dailyCheckIns/${checkIn.date}`)!.next({
  id: checkIn.date, exists: () => entry !== undefined, data: () => entry, metadata: { hasPendingWrites: pending },
});
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(now); mockUid = 'owner'; mockListeners.clear(); jest.clearAllMocks();
  mockWrite.mockReset().mockResolvedValue('pending');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    appState = handler; return { remove: jest.fn() };
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it('requires an explicitly saved partial answer, updates a single owned date and distinguishes queued/cloud-confirmed writes', async () => {
  const clear = jest.spyOn(global, 'clearInterval');
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(mockWrite).not.toHaveBeenCalled(); expect(checkIn.ready).toBe(false);
  await expect(checkIn.save({ energy: 'USUAL' })).rejects.toThrow('checkInUnavailable');
  await act(async () => publish());
  await act(async () => checkIn.save({ energy: 'USUAL' }));
  expect(mockWrite.mock.calls[0].slice(0, 2)).toEqual(['users/owner/dailyCheckIns', expect.objectContaining({ id: '2026-10-26', userId: 'owner', answers: { energy: 'USUAL' } })]);
  expect(checkIn.pending).toBe(true);
  await act(async () => mockWrite.mock.calls[0][2]()); expect(checkIn.pending).toBe(false);
  jest.setSystemTime(now + 1000);
  mockWrite.mockResolvedValueOnce('synced');
  await act(async () => checkIn.save({ sleep: 'WORSE', discomfort: 'PRESENT' }));
  expect(checkIn.pending).toBe(false); expect(checkIn.entry).toMatchObject({ id: '2026-10-26', createdAt: now, updatedAt: now + 1000 });
  mockWrite.mockImplementationOnce(async (_path, _entry, synced) => { synced(); return 'pending'; });
  await act(async () => checkIn.save({ recovery: 'BETTER' })); expect(checkIn.pending).toBe(false);
  await act(async () => tree.unmount()); expect(clear).toHaveBeenCalledTimes(1);
});
it('keeps a failed draft retriable, rejects corrupt/foreign records and does not claim a rejected write succeeded', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish());
  await expect(checkIn.save({})).rejects.toThrow('invalidCheckIn');
  mockWrite.mockRejectedValueOnce(Error('offline'));
  await act(async () => { await expect(checkIn.save({ energy: 'LOWER' })).rejects.toThrow('offline'); });
  expect(checkIn.entry).toBeUndefined();
  mockWrite.mockImplementationOnce(async (_path, _entry, _synced, rejected) => rejected(Error('denied')));
  await act(async () => { await expect(checkIn.save({ recovery: 'WORSE' })).rejects.toThrow('checkInSaveFailed'); });
  expect(checkIn.error).toBe(true); expect(checkIn.entry).toBeUndefined();
  await expect(checkIn.save({ sleep: 'USUAL' })).rejects.toThrow('checkInUnavailable');
  await act(async () => checkIn.reload()); await act(async () => publish());
  await act(async () => checkIn.save({ energy: 'USUAL' }));
  await act(async () => mockWrite.mock.calls.at(-1)[3](Error('late denial'))); expect(checkIn.error).toBe(true);
  await act(async () => publish(createDailyCheckIn('other', checkIn.date, { energy: 'HIGHER' }, now)));
  expect(checkIn.error).toBe(true); expect(checkIn.entry).toBeUndefined();
  await act(async () => mockListeners.get(`users/owner/dailyCheckIns/${checkIn.date}`)!.error());
  expect(checkIn.ready).toBe(true); expect(checkIn.error).toBe(true);
  await act(async () => tree.unmount());
});
it('hides private data at owner changes and ignores stale subscriptions and save closures, including an ABA account change', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  const entry = createDailyCheckIn('owner', checkIn.date, { recovery: 'WORSE' }, now);
  await act(async () => publish(entry)); const oldSave = checkIn.save;
  const listener = mockListeners.get(`users/owner/dailyCheckIns/${checkIn.date}`)!;
  mockUid = 'other'; await act(async () => tree.update(<Probe />));
  expect(checkIn.entry).toBeUndefined(); expect(listener.stop).toHaveBeenCalled();
  await act(async () => listener.next({ id: entry.id, exists: () => true, data: () => entry, metadata: { hasPendingWrites: false } }));
  expect(checkIn.entry).toBeUndefined(); await expect(oldSave({ energy: 'USUAL' })).rejects.toThrow();
  mockUid = 'owner'; await act(async () => tree.update(<Probe />)); await act(async () => publish());
  await expect(oldSave({ energy: 'USUAL' })).rejects.toThrow();
  mockUid = null; await act(async () => tree.update(<Probe />)); expect(checkIn.ready).toBe(true);
  await expect(checkIn.save({ energy: 'USUAL' })).rejects.toThrow(); await act(async () => tree.unmount());
});
it('serializes writes and prevents a pending completion or rejection from entering another account or an unmounted screen', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish());
  let resolve!: () => void;
  mockWrite.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
  const pending = checkIn.save({ energy: 'HIGHER' }).catch((error) => error.message);
  await expect(checkIn.save({ recovery: 'USUAL' })).rejects.toThrow('checkInUnavailable');
  mockUid = 'other'; await act(async () => tree.update(<Probe />));
  await act(async () => { mockWrite.mock.calls[0][2](); mockWrite.mock.calls[0][3](); resolve(); });
  expect(await pending).toBe('checkInSaveFailed'); expect(checkIn.entry).toBeUndefined(); expect(checkIn.error).toBe(false);
  await act(async () => publish());
  mockWrite.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
  const leaving = checkIn.save({ sleep: 'USUAL' }).catch((error) => error.message);
  await act(async () => tree.unmount()); await act(async () => resolve()); expect(await leaving).toBe('checkInSaveFailed');
});
it('rolls over at midnight or foreground resume and refuses to relabel yesterday’s answer as today’s', async () => {
  jest.setSystemTime(new Date(2026, 9, 26, 23, 59, 50));
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => publish());
  await act(async () => checkIn.save({ recovery: 'WORSE' })); const yesterdaySave = checkIn.save;
  jest.setSystemTime(new Date(2026, 9, 27, 0, 0, 1));
  await expect(yesterdaySave({ recovery: 'BETTER' })).rejects.toThrow('checkInUnavailable');
  await act(async () => jest.advanceTimersByTime(30000));
  expect(checkIn.date).toBe('2026-10-27'); expect(checkIn.entry).toBeUndefined();
  await act(async () => publish());
  await act(async () => appState('background')); expect(checkIn.date).toBe('2026-10-27');
  jest.setSystemTime(new Date(2026, 9, 28, 8)); await act(async () => appState('active'));
  expect(checkIn.date).toBe(localCheckInDate(Date.now())); expect(checkIn.ready).toBe(false);
  await act(async () => tree.unmount());
});
it('keeps a warm owned answer during retry and ignores an obsolete listener’s later failure', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  const entry = createDailyCheckIn('owner', checkIn.date, { recovery: 'USUAL' }, now);
  await act(async () => publish(entry, true));
  const listener = mockListeners.get(`users/owner/dailyCheckIns/${checkIn.date}`)!;
  await act(async () => checkIn.reload()); expect(checkIn.entry).toEqual(entry); expect(checkIn.ready).toBe(false);
  await act(async () => listener.error()); expect(checkIn.error).toBe(false);
  await act(async () => publish(entry)); expect(checkIn.pending).toBe(false); expect(checkIn.ready).toBe(true);
  await act(async () => tree.unmount());
});
