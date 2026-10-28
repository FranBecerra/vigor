import React from 'react';
import { AppState } from 'react-native';
import { useBioDailyHistory } from '../useBioDailyHistory';
import { createDailyCheckIn } from '@/services/bio/dailyCheckIn';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; const mockGet = jest.fn(), mockQuery = jest.fn();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path,
  query: (...args: unknown[]) => { mockQuery(...args); return args; }, where: (...args: unknown[]) => args,
  documentId: () => '__name__', orderBy: (...args: unknown[]) => args, limit: (count: number) => count,
  getDocs: (...args: unknown[]) => mockGet(...args) }));
let result: ReturnType<typeof useBioDailyHistory>, appState: (value: any) => void;
function Probe() { result = useBioDailyHistory(); return null; }
const response = (entries: any[]) => ({ docs: entries.map((entry) => ({ id: entry.id, data: () => entry })) });
beforeEach(() => {
  jest.clearAllMocks(); mockUid = 'owner'; mockGet.mockResolvedValue(response([]));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { appState = callback; return { remove: jest.fn() }; });
});
afterEach(() => jest.restoreAllMocks());
it('bounds calendar history and validates ownership, dates and future observations', async () => {
  const now = Date.now(), date = new Date(now), key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const good = createDailyCheckIn('owner', key, { recovery: 'USUAL' }, now - 1000);
  mockGet.mockResolvedValue(response([good, { ...good, userId: 'other' }, { ...good, updatedAt: now + 1000000 }, { ...good, questionnaireVersion: 99 }]));
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.entries).toEqual([good]);
  expect(mockQuery).toHaveBeenCalledWith('users/owner/dailyCheckIns', ['__name__', '>=', expect.any(String)], ['__name__', '<=', key], ['__name__', 'desc'], 43);
  await act(async () => appState('background')); expect(mockGet).toHaveBeenCalledTimes(1);
  await act(async () => appState('active')); expect(mockGet).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});
it('isolates late owner reads, retries errors and stops reading after logout/unmount', async () => {
  let release!: (value: any) => void; mockGet.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.ready).toBe(false);
  mockUid = 'other'; await act(async () => tree.update(<Probe />));
  await act(async () => release(response([]))); expect(result.owner).toBe('other');
  mockGet.mockRejectedValueOnce(Error('offline')); await act(async () => result.reload()); expect(result.error).toBe(true);
  await act(async () => result.reload()); expect(result.error).toBe(false);
  mockGet.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  await act(async () => result.reload()); await act(async () => tree.unmount()); await act(async () => release(response([])));
  mockUid = null; await act(async () => { tree = create(<Probe />); }); expect(result.ready).toBe(true); expect(result.entries).toEqual([]); await act(async () => tree.unmount());
});
