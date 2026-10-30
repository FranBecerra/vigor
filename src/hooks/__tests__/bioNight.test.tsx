import React from 'react';
import { AppState } from 'react-native';
import { useBioNight } from '../useBioNight';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner', mockEnabled = false, mockNight = false, mockReady = true;
const mockAvailable = jest.fn(), mockRead = jest.fn(), mockAuthorize = jest.fn();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('../useAppSettings', () => ({ useAppSettings: () => ({ ready: mockReady, settings: { bioHealthEnabled: mockEnabled, bioNightEnabled: mockNight } }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/services/health/bioHealthClient', () => ({ bioNightBridge: {
  available: () => mockAvailable(), read: (...args: unknown[]) => mockRead(...args), authorize: () => mockAuthorize(),
} }));
let result: ReturnType<typeof useBioNight>, appState: (state: any) => void;
function Probe() { result = useBioNight(); return null; }
beforeEach(() => {
  jest.clearAllMocks(); mockUid = 'owner'; mockEnabled = false; mockNight = false; mockReady = true;
  mockAvailable.mockResolvedValue(true); mockRead.mockResolvedValue({ version: 1, metrics: { SLEEP: { samples: [], error: false, truncated: false } } });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { appState = callback; return { remove: jest.fn() }; });
});
afterEach(() => jest.restoreAllMocks());
it('requires both explicit opt-ins, refreshes on foreground and never requests permission on mount', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(result.state).toBe('OFF'); mockEnabled = true; await act(async () => tree.update(<Probe />));
  expect(mockRead).not.toHaveBeenCalled(); mockNight = true; await act(async () => tree.update(<Probe />));
  expect(result.state).toBe('READY'); expect(result.analysis!.status).toBe('EMPTY'); expect(mockAuthorize).not.toHaveBeenCalled();
  expect(mockRead.mock.calls[0][1] - mockRead.mock.calls[0][0]).toBeLessThan(72 * 86400000);
  await act(async () => appState('active')); expect(mockRead).toHaveBeenCalledTimes(2);
  await act(async () => appState('background')); expect(mockRead).toHaveBeenCalledTimes(2);
  mockEnabled = false; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('OFF'); expect(result.analysis).toBeUndefined();
  await act(async () => tree.unmount());
});
it('handles availability/read errors and retries without retaining stale private data', async () => {
  mockEnabled = true; mockNight = true; mockAvailable.mockResolvedValue(false);
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.state).toBe('UNAVAILABLE');
  mockAvailable.mockResolvedValue(true); mockRead.mockRejectedValueOnce(Error('locked'));
  await act(async () => result.reload()); expect(result.state).toBe('ERROR'); expect(result.analysis).toBeUndefined();
  await act(async () => result.reload()); expect(result.state).toBe('READY');
  mockReady = false; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('LOADING'); expect(result.analysis).toBeUndefined();
  await act(async () => tree.unmount());
});
it('ignores account round trips, overlapped reads and results after unmount', async () => {
  mockEnabled = true; mockNight = true; let release!: (value: unknown) => void;
  mockRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  mockUid = 'other'; await act(async () => tree.update(<Probe />));
  mockUid = 'owner'; await act(async () => tree.update(<Probe />)); const time = result.fetchedAt;
  await act(async () => release({ version: 0 })); expect(result.fetchedAt).toBe(time); expect(result.analysis!.status).toBe('EMPTY');
  mockRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  await act(async () => appState('active')); expect(result.state).toBe('LOADING');
  await act(async () => appState('active')); expect(result.state).toBe('READY');
  await act(async () => release({ version: 0 })); expect(result.analysis!.status).toBe('EMPTY');
  mockRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  await act(async () => result.reload()); await act(async () => tree.unmount()); await act(async () => release({ version: 0 }));
  mockUid = null; await act(async () => { tree = create(<Probe />); }); expect(result.state).toBe('OFF'); await act(async () => tree.unmount());
});
it('does not start a read if availability resolves after disconnect', async () => {
  mockEnabled = true; mockNight = true; let release!: (value: boolean) => void;
  mockAvailable.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  mockNight = false; await act(async () => tree.update(<Probe />));
  await act(async () => release(true)); expect(mockRead).not.toHaveBeenCalled(); expect(result.state).toBe('OFF');
  await act(async () => tree.unmount());
});
