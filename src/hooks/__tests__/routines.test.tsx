import React from 'react';
import { AppState } from 'react-native';
import { useRoutines } from '../useRoutines';
import { routineRepository, mesocycleRepository, workoutSessionRepository } from '@/services/repositories';
const { create, act } = require('react-test-renderer');
const mockLoad = jest.fn(); let mockOwner: string | null = 'owner';
const mockMap = new Map(); const mockTranslate = (key: string) => key;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate, i18n: { language: 'en' } }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockOwner }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockMap }) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: {}, routineRepository: {}, workoutSessionRepository: {} }));
jest.mock('@/services/training/routineView', () => ({ loadRoutineViews: (...args: unknown[]) => mockLoad(...args) }));
let result: ReturnType<typeof useRoutines>;
function Probe() { result = useRoutines(); return null; }
beforeEach(() => { mockLoad.mockReset(); mockOwner = null; });
afterEach(() => { delete (routineRepository as any).listCachedByUser; jest.restoreAllMocks(); });
it('renders a warm snapshot immediately, revalidates, and never shows it to another account', async () => {
  mockOwner = 'owner'; mockLoad.mockResolvedValueOnce([{ id: 'r' }]); let tree: any;
  await act(async () => { tree = create(<Probe />); });
  expect(result.status).toBe('ready'); expect(result.routines).toEqual([{ id: 'r' }]);
  await act(async () => tree.unmount());
  let resolve!: (value: unknown[]) => void;
  mockLoad.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  await act(async () => { tree = create(<Probe />); });
  expect(result.status).toBe('ready'); expect(result.routines).toEqual([{ id: 'r' }]);
  mockLoad.mockImplementationOnce(() => new Promise(() => {})); mockOwner = 'other';
  await act(async () => tree.update(<Probe />));
  expect(result.routines).toEqual([]); expect(result.status).toBe('loading');
  await act(async () => resolve([{ id: 'stale' }])); expect(result.routines).toEqual([]);
  mockOwner = null; await act(async () => tree.update(<Probe />)); expect(result.routines).toEqual([]);
  await act(async () => tree.unmount());
});

it('paints owner-scoped native cache before a slow remote read and never overwrites newer remote data', async () => {
  mockOwner = 'cache-owner'; let remote!: (value: any[]) => void;
  (routineRepository as any).listCachedByUser = jest.fn().mockResolvedValue([
    { id: 'local', userId: mockOwner }, { id: 'foreign', userId: 'someone-else' },
  ]);
  (routineRepository as any).listByUser = jest.fn(() => new Promise(resolve => { remote = resolve; }));
  mockLoad.mockImplementation((uid, sources) => sources.listRoutines(uid));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(result.status).toBe('ready'); expect(result.routines.map(r => r.id)).toEqual(['local']);
  await act(async () => remote([{ id: 'fresh' }])); expect(result.routines.map(r => r.id)).toEqual(['fresh']);
  await act(async () => tree.unmount());

  mockOwner = 'late-cache'; let cached!: (value: any[]) => void;
  (routineRepository as any).listCachedByUser = jest.fn(() => new Promise(resolve => { cached = resolve; }));
  (routineRepository as any).listByUser = jest.fn().mockResolvedValue([{ id: 'newest' }]);
  await act(async () => { tree = create(<Probe />); });
  await act(async () => cached([{ id: 'obsolete', userId: mockOwner }]));
  expect(result.routines.map(r => r.id)).toEqual(['newest']);
  await act(async () => tree.unmount());
});

it('does not treat empty or failed cache as an empty remote result, and retains cached routines on refresh failure', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockOwner = 'empty-cache'; let reject!: (value: Error) => void;
  (routineRepository as any).listCachedByUser = jest.fn().mockResolvedValue([]);
  (routineRepository as any).listByUser = jest.fn(() => new Promise((_resolve, fail) => { reject = fail; }));
  mockLoad.mockImplementation((uid, sources) => sources.listRoutines(uid));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(result.status).toBe('loading'); expect(result.routines).toEqual([]);
  await act(async () => reject(Error('offline'))); expect(result.status).toBe('error');
  await act(async () => tree.unmount());
  mockOwner = 'failed-cache';
  (routineRepository as any).listCachedByUser.mockRejectedValueOnce(Error('missing'));
  await act(async () => { tree = create(<Probe />); }); expect(result.status).toBe('loading');
  await act(async () => tree.unmount());
  mockOwner = 'late-offline-cache'; let cached!: (value: any[]) => void;
  (routineRepository as any).listCachedByUser = jest.fn(() => new Promise(resolve => { cached = resolve; }));
  (routineRepository as any).listByUser.mockRejectedValueOnce(Error('offline'));
  await act(async () => { tree = create(<Probe />); });
  await act(async () => cached([{ id: 'offline', userId: mockOwner }]));
  expect(result.status).toBe('error'); expect(result.routines.map(r => r.id)).toEqual(['offline']);
  await act(async () => tree.unmount());
});

it('saves only validated presentation fields and refuses old-owner callbacks', async () => {
  mockOwner = 'editor'; mockLoad.mockResolvedValue([{ id: 'editable' }]);
  (routineRepository as any).update = jest.fn().mockResolvedValue(undefined);
  let tree: any; await act(async () => { tree = create(<Probe />); });
  await act(async () => result.rename('editable', ' Revised ', { icon: 'bike', color: '#ABC' }));
  expect(routineRepository.update).toHaveBeenCalledWith('editable', { name: 'Revised', icon: 'bike', updatedAt: expect.any(Number) });
  await expect(result.rename('editable', 'Valid', { icon: 'wrong' as any, color: '#FFFFFF' })).rejects.toThrow('Invalid routine identity');
  await act(async () => result.rename('editable', 'Valid', { icon: 'satellite', color: 'legacy-unused-value' }));
  expect(routineRepository.update).toHaveBeenLastCalledWith('editable', { name: 'Valid', icon: 'satellite', updatedAt: expect.any(Number) });
  await act(async () => result.rename('editable', ' ')); await act(async () => result.rename('missing', 'Valid'));
  expect(routineRepository.update).toHaveBeenCalledTimes(2);
  const staleEdit = result.rename; mockOwner = 'new-editor'; mockLoad.mockResolvedValue([]);
  await act(async () => tree.update(<Probe />));
  await act(async () => staleEdit('editable', 'Old account'));
  expect(routineRepository.update).toHaveBeenCalledTimes(2);
  mockOwner = null; await act(async () => tree.update(<Probe />)); await act(async () => tree.unmount());
});

it('rejects foreign cached plans and filters cached history, ignoring native completions after account switches', async () => {
  mockOwner = 'native-isolation'; let cached!: (value: any[]) => void;
  (routineRepository as any).listCachedByUser = jest.fn().mockResolvedValue([{ id: 'cached', userId: mockOwner }]);
  (mesocycleRepository as any).getCached = jest.fn().mockResolvedValue({ id: 'plan', userId: 'foreign' });
  (workoutSessionRepository as any).listCachedByUser = jest.fn().mockResolvedValue([{ id: 'mine', userId: mockOwner }, { id: 'foreign', userId: 'foreign' }]);
  (routineRepository as any).listByUser = jest.fn(() => new Promise(() => {}));
  mockLoad.mockImplementation(async (uid, sources) => {
    const views = await sources.listRoutines(uid);
    const records = await sources.listWorkoutSessions(uid);
    expect(records.map((item: any) => item.id)).toEqual(['mine']);
    await sources.getMesocycle('plan');
    return views;
  });
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(result.status).toBe('loading'); expect(result.routines).toEqual([]);
  expect(mesocycleRepository.getCached).toHaveBeenCalledWith('plan');
  mockOwner = 'native-isolation-pending';
  (routineRepository as any).listCachedByUser = jest.fn(() => new Promise(resolve => { cached = resolve; }));
  mockLoad.mockImplementation((uid, sources) => sources.listRoutines(uid));
  await act(async () => tree.update(<Probe />)); const oldOwner = mockOwner;
  mockOwner = 'native-isolation-next';
  (routineRepository as any).listCachedByUser = jest.fn().mockResolvedValue([]);
  await act(async () => tree.update(<Probe />));
  await act(async () => cached([{ id: 'old', userId: oldOwner }]));
  expect(result.routines).toEqual([]); expect(result.status).toBe('loading');
  await act(async () => tree.unmount());
});

it('does not let an edit finishing after account change invalidate the new account read', async () => {
  mockOwner = 'pending-editor'; mockLoad.mockResolvedValue([{ id: 'editable' }]);
  let finish!: () => void;
  (routineRepository as any).update = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  let pending!: Promise<void>;
  await act(async () => { pending = result.rename('editable', 'Updated'); });
  mockOwner = 'next-pending-editor'; let load!: (value: any[]) => void;
  mockLoad.mockImplementation(() => new Promise(resolve => { load = resolve; }));
  await act(async () => tree.update(<Probe />)); const calls = mockLoad.mock.calls.length;
  await act(async () => { finish(); await pending; }); expect(mockLoad).toHaveBeenCalledTimes(calls);
  await act(async () => load([{ id: 'new-account-routine' }]));
  expect(result.routines.map(r => r.id)).toEqual(['new-account-routine']);
  await act(async () => tree.unmount());
});

it('revalidates on actual foreground returns without clearing routines or repeating duplicate active events', async () => {
  let listener!: (state: any) => void; const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listener = callback; return { remove }; });
  mockOwner = 'foreground-owner'; mockLoad.mockResolvedValue([{ id: 'visible' }]);
  let tree: any; await act(async () => { tree = create(<Probe />); });
  mockLoad.mockImplementationOnce(() => new Promise(() => {})); const calls = mockLoad.mock.calls.length;
  await act(async () => listener('background')); expect(mockLoad).toHaveBeenCalledTimes(calls);
  await act(async () => listener('active')); expect(mockLoad).toHaveBeenCalledTimes(calls + 1);
  expect(result.status).toBe('ready'); expect(result.routines.map(r => r.id)).toEqual(['visible']);
  await act(async () => listener('active')); expect(mockLoad).toHaveBeenCalledTimes(calls + 1);
  await act(async () => tree.unmount()); expect(remove).toHaveBeenCalledTimes(1);
});
