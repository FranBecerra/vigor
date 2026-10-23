import React from 'react';
import { ExerciseCatalogueProvider, useExerciseCatalogue } from '../useExerciseCatalogue';
import { RehabilitationProvider, useRehabilitation } from '../useRehabilitation';
import { createCustomExercise } from '@/services/training/customExercises';
import { exerciseEditInput, createExerciseOverride } from '@/services/training/exerciseEditing';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner';
const mockListeners = new Map<string, { next: (value: unknown) => void; stop: jest.Mock }>();
const mockWrite = jest.fn();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => path,
  onSnapshot: (path: string, next: (value: unknown) => void) => {
    const stop = jest.fn(); mockListeners.set(path, { next, stop }); return stop;
  },
}));
jest.mock('@/services/repositories/BaseRepository', () => ({ BaseRepository: class {
  path: string;
  constructor(mockPath: string) { this.path = mockPath; }
  createLocally(...args: unknown[]) { return mockWrite(this.path, ...args); }
} }));
const exercise = createCustomExercise({ name: 'Synthetic', recording: { measure: 'REPETITIONS', load: 'NONE' } },
  'owner', 'custom:owner:one', [], 1);
const snapshot = (values: any[]) => ({ docs: values.map(({ id, ...data }) => ({ id, data: () => data })) });
let catalogue: ReturnType<typeof useExerciseCatalogue>;
let rehab: ReturnType<typeof useRehabilitation>;
function Probe() { catalogue = useExerciseCatalogue(); rehab = useRehabilitation(); return null; }
const Tree = () => <ExerciseCatalogueProvider><RehabilitationProvider><Probe /></RehabilitationProvider></ExerciseCatalogueProvider>;
beforeEach(() => { mockUid = 'owner'; mockListeners.clear(); mockWrite.mockReset().mockResolvedValue('pending'); });
it('loads only valid owned exercises, keeps archived identities, and discards stale account callbacks', async () => {
  let tree: any;
  await act(async () => { tree = create(<Tree />); });
  expect(catalogue.ready).toBe(false);
  const previous = mockListeners.get('users/owner/customExercises')!;
  await act(async () => mockListeners.get('users/owner/exerciseOverrides')!.next(snapshot([])));
  await act(async () => mockListeners.get('users/owner/exercisePreferences')!.next(snapshot([])));
  await act(async () => previous.next(snapshot([exercise, { ...exercise, id: 'custom:owner:broken', recording: { measure: 'DISTANCE' } }])));
  expect(catalogue.ready).toBe(true); expect(catalogue.error).toBe(true);
  expect(catalogue.exercisesById.get(exercise.id)).toMatchObject({ name: 'Synthetic' });
  expect(catalogue.exercisesById.has('custom:owner:broken')).toBe(false);
  mockUid = 'other';
  await act(async () => tree.update(<Tree />));
  expect(previous.stop).toHaveBeenCalled(); expect(catalogue.exercisesById.has(exercise.id)).toBe(false);
  await act(async () => previous.next(snapshot([exercise])));
  expect(catalogue.exercisesById.has(exercise.id)).toBe(false);
  await expect(catalogue.archive(exercise)).rejects.toThrow('invalidIdentity');
  await act(async () => tree.unmount());
});
it('accepts local pending creation and reports later cloud rejection without exposing another owner', async () => {
  let tree: any;
  await act(async () => { tree = create(<Tree />); });
  let created: any;
  await act(async () => { created = await catalogue.create({ name: 'Offline synthetic', recording: { measure: 'SECONDS', load: 'LEVEL' } }); });
  expect(mockWrite.mock.calls[0][0]).toBe('users/owner/customExercises');
  expect(catalogue.exercisesById.get(created.id)).toMatchObject({ name: 'Offline synthetic' });
  await act(async () => mockWrite.mock.calls[0][3](new Error('permission-denied')));
  expect(catalogue.error).toBe(true);
  expect(rehab.ready).toBe(false);
  await act(async () => mockListeners.get('users/owner/rehabBlocks')!.next(snapshot([])));
  expect(rehab.ready).toBe(false);
  await act(async () => mockListeners.get('users/owner/rehabLogs')!.next(snapshot([])));
  expect(rehab.ready).toBe(true);
  await expect(rehab.saveBlock({ userId: 'other' } as never)).rejects.toThrow('invalidIdentity');
  await expect(rehab.saveLog({ userId: 'other' } as never)).rejects.toThrow('invalidIdentity');
  mockUid = null;
  await act(async () => tree.update(<Tree />));
  expect(catalogue.exercisesById.has(created.id)).toBe(false);
  await expect(catalogue.create({ name: 'X', recording: { measure: 'SECONDS', load: 'NONE' } })).rejects.toThrow('invalidIdentity');
  await act(async () => tree.unmount());
});
it('applies validated personal overrides without replacing the shared catalogue or leaking stale saves', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); });
  await act(async () => {
    mockListeners.get('users/owner/customExercises')!.next(snapshot([]));
    mockListeners.get('users/owner/exerciseOverrides')!.next(snapshot([]));
    mockListeners.get('users/owner/exercisePreferences')!.next(snapshot([]));
  });
  const base = catalogue.catalogue[0]; const input = { ...exerciseEditInput(base), name: 'Personal name' };
  await act(async () => catalogue.edit(base, input));
  expect(mockWrite.mock.calls[0][0]).toBe('users/owner/exerciseOverrides');
  expect(catalogue.exercisesById.get(base.id)).toMatchObject({ name: 'Personal name', isPersonalized: true });
  expect(base.name).not.toBe('Personal name'); const oldEdit = catalogue.edit;
  mockUid = 'other'; await act(async () => tree.update(<Tree />));
  expect(catalogue.exercisesById.get(base.id)?.name).toBe(base.name);
  await expect(oldEdit(base, input)).rejects.toThrow('invalidIdentity');
  await act(async () => tree.unmount());
});
it('reports malformed overrides and local edit rejection instead of claiming a successful update', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); });
  await act(async () => mockListeners.get('users/owner/customExercises')!.next(snapshot([])));
  const listener = mockListeners.get('users/owner/exerciseOverrides')!; const base = catalogue.catalogue[0];
  await act(async () => mockListeners.get('users/owner/exercisePreferences')!.next(snapshot([])));
  const foreign = createExerciseOverride(base, exerciseEditInput(base), 'other', 1);
  await act(async () => listener.next(snapshot([foreign, { id: base.id, ownerId: 'owner', changes: {} }])));
  expect(catalogue.error).toBe(true); await expect(catalogue.edit(base, exerciseEditInput(base))).rejects.toThrow('saveFailed');
  await act(async () => listener.next(snapshot([])));
  await act(async () => mockListeners.get('users/owner/exercisePreferences')!.next(snapshot([])));
  mockWrite.mockImplementationOnce(async (_path, _item, _synced, rejected) => { rejected(Error('denied')); return 'pending'; });
  await act(async () => { await expect(catalogue.edit(base, { ...exerciseEditInput(base), name: 'Must not publish' })).rejects.toThrow('saveFailed'); });
  expect(catalogue.exercisesById.get(base.id)?.name).toBe(base.name);
  await act(async () => tree.unmount());
});

it('persists exercise recommendation preferences privately and exposes live toggles', async () => {
  let tree: any; await act(async () => { tree = create(<Tree />); });
  const base = catalogue.catalogue[0];
  await act(async () => {
    mockListeners.get('users/owner/customExercises')!.next(snapshot([]));
    mockListeners.get('users/owner/exerciseOverrides')!.next(snapshot([]));
    mockListeners.get('users/owner/exercisePreferences')!.next(snapshot([]));
  });
  await act(async () => catalogue.setExerciseNotRecommended(base.id, true));
  expect(mockWrite.mock.calls[0][0]).toBe('users/owner/exercisePreferences');
  expect(catalogue.notRecommendedExerciseIds.has(base.id)).toBe(true);
  await act(async () => catalogue.setExerciseNotRecommended(base.id, false));
  expect(catalogue.notRecommendedExerciseIds.has(base.id)).toBe(false);
  expect(mockWrite.mock.calls[1][1]).toMatchObject({ id: base.id, userId: 'owner', notRecommended: false });
  await act(async () => tree.unmount());
});
