import React from 'react';
import { TrainingNotesProvider, useTrainingNotes } from '../useTrainingNotes';
import { createTrainingNote } from '@/services/training/trainingNotes';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; const mockWrite = jest.fn();
const mockListeners = new Map<string, { next: (snapshot: any) => void; error: () => void; stop: jest.Mock }>();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path,
  onSnapshot: (path: string, next: any, error: any) => { const stop = jest.fn(); mockListeners.set(path, { next, error, stop }); return stop; } }));
jest.mock('@/services/repositories/BaseRepository', () => ({ BaseRepository: class {
  path: string; constructor(mockPath: string) { this.path = mockPath; } createLocally(...args: unknown[]) { return mockWrite(this.path, ...args); }
} }));
let notes: ReturnType<typeof useTrainingNotes>; function Probe() { notes = useTrainingNotes(); return null; }
const Tree = () => <TrainingNotesProvider><Probe /></TrainingNotesProvider>;
const snapshot = (entries: any[]) => ({ docs: entries.map(({ id, ...data }) => ({ id, data: () => data })) });
beforeEach(() => { mockUid = 'owner'; mockListeners.clear(); mockWrite.mockReset().mockResolvedValue('pending'); });
it('loads owned notes, saves explicit local intentions and clears only the chosen identity', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); }); expect(notes.ready).toBe(false);
  await expect(notes.save('EXERCISE', 'press', 'Too early')).rejects.toThrow('notesUnavailable');
  await act(async () => mockListeners.get('users/owner/trainingNotes')!.next(snapshot([createTrainingNote('owner', 'MESOCYCLE', 'meso', 'Block', 1)])));
  expect(notes.get('MESOCYCLE', 'meso')).toBe('Block'); expect(notes.get('EXERCISE', '')).toBe('');
  expect(notes.get('EXERCISE', 'invalid/id')).toBe('');
  await act(async () => notes.save('EXERCISE', 'press', 'Seat 4')); expect(notes.get('EXERCISE', 'press')).toBe('Seat 4');
  expect(mockWrite.mock.calls[0][0]).toBe('users/owner/trainingNotes');
  await act(async () => notes.save('EXERCISE', 'press', '')); expect(notes.get('EXERCISE', 'press')).toBe('');
  expect(notes.get('MESOCYCLE', 'meso')).toBe('Block'); await act(async () => tree.unmount());
});
it('rejects malformed/cross-owner snapshots and surfaces local or later cloud rejection', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); }); const listener = mockListeners.get('users/owner/trainingNotes')!;
  await act(async () => listener.next(snapshot([createTrainingNote('other', 'EXERCISE', 'press', 'Private', 1), { id: 'broken' }])));
  expect(notes.error).toBe(true); expect(notes.get('EXERCISE', 'press')).toBe('');
  await act(async () => listener.next(snapshot([])));
  mockWrite.mockImplementationOnce(async (_path, _note, _synced, rejected) => { rejected(Error('denied')); return 'pending'; });
  await act(async () => { await expect(notes.save('EXERCISE', 'press', 'Draft')).rejects.toThrow('saveFailed'); });
  expect(notes.get('EXERCISE', 'press')).toBe('');
  await act(async () => listener.next(snapshot([]))); await act(async () => notes.save('EXERCISE', 'press', 'Draft'));
  await act(async () => mockWrite.mock.calls.at(-1)[3](Error('later denial'))); expect(notes.error).toBe(true);
  await act(async () => listener.error()); expect(notes.ready).toBe(true); await act(async () => tree.unmount());
});
it('hides another account immediately, ignores stale callbacks and rejects stale save closures', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); }); const previous = mockListeners.get('users/owner/trainingNotes')!;
  await act(async () => previous.next(snapshot([createTrainingNote('owner', 'EXERCISE', 'press', 'Private', 1)])));
  const oldSave = notes.save; mockUid = 'other'; await act(async () => tree.update(<Tree />));
  expect(previous.stop).toHaveBeenCalled(); expect(notes.get('EXERCISE', 'press')).toBe('');
  await expect(oldSave('EXERCISE', 'press', 'stale')).rejects.toThrow('notesUnavailable');
  await act(async () => previous.next(snapshot([createTrainingNote('owner', 'EXERCISE', 'press', 'stale', 1)])));
  expect(notes.get('EXERCISE', 'press')).toBe('');
  mockUid = null; await act(async () => tree.update(<Tree />)); await expect(notes.save('EXERCISE', 'press', 'x')).rejects.toThrow();
  await act(async () => tree.unmount());
});
it('does not publish an old-account write completion into a new account', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); });
  await act(async () => mockListeners.get('users/owner/trainingNotes')!.next(snapshot([])));
  let release!: () => void; mockWrite.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  const pending = notes.save('EXERCISE', 'press', 'Private').catch((error) => error.message);
  mockUid = 'other'; await act(async () => tree.update(<Tree />));
  await act(async () => release()); expect(await pending).toBe('saveFailed'); expect(notes.get('EXERCISE', 'press')).toBe('');
  await act(async () => tree.unmount());
});
