import React from 'react';
import { AppState } from 'react-native';
import { useBioHealth } from '../useBioHealth';
import { loadAudit, summarizeLoads } from '@/services/performance/loadAudit';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner', mockEnabled = false, mockReady = true;
const mockAvailable = jest.fn(), mockRead = jest.fn(), mockAuthorize = jest.fn();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('../useAppSettings', () => ({ useAppSettings: () => ({ ready: mockReady, settings: { bioHealthEnabled: mockEnabled } }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/services/health/bioHealthClient', () => ({ bioHealthBridge: {
  bioAvailable: () => mockAvailable(), readBio: (...args: unknown[]) => mockRead(...args), authorizeBio: () => mockAuthorize(),
} }));
let result: ReturnType<typeof useBioHealth>, appState: (state: any) => void;
function Probe() { result = useBioHealth(); return null; }
beforeEach(() => {
  jest.clearAllMocks(); mockUid = 'owner'; mockEnabled = false; mockReady = true;
  mockAvailable.mockResolvedValue(true); mockRead.mockResolvedValue({});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { appState = callback; return { remove: jest.fn() }; });
});
afterEach(() => jest.restoreAllMocks());
it('retains visible readings while auditing a controlled 600ms foreground refresh', async () => {
  jest.useFakeTimers(); mockEnabled = true; loadAudit.clear();
  let tree: any;
  try {
    await act(async () => { tree = create(<Probe />); }); expect(result.state).toBe('READY'); expect(result.trends).toHaveLength(3);
    mockRead.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 600)));
    for (let n = 0; n < 20; n++) {
      await act(async () => appState('active'));
      expect(result.state).toBe('LOADING'); expect(result.trends).toHaveLength(3);
      await act(async () => jest.advanceTimersByTime(599)); expect(result.state).toBe('LOADING');
      await act(async () => jest.advanceTimersByTime(1)); expect(result.state).toBe('READY');
    }
    expect(mockRead).toHaveBeenCalledTimes(21);
    expect(summarizeLoads(loadAudit.snapshot()).find(row => row.stage === 'bio.health' && row.trigger === 'foreground'))
      .toMatchObject({ count: 20, p50: 600, p95: 600, max: 600, sufficient: true });
    await act(async () => tree.unmount());
  } finally { jest.useRealTimers(); loadAudit.clear(); }
});
it('performs no reads or prompts before opt-in and supports partial/empty authorized results', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(result.state).toBe('OFF'); expect(mockRead).not.toHaveBeenCalled(); expect(mockAuthorize).not.toHaveBeenCalled();
  mockEnabled = true; await act(async () => tree.update(<Probe />));
  expect(result.state).toBe('READY'); expect(result.trends).toHaveLength(3); expect(mockAuthorize).not.toHaveBeenCalled();
  expect(mockRead.mock.calls[0][1] - mockRead.mock.calls[0][0]).toBeLessThan(45 * 86400000);
  await act(async () => appState('active')); expect(mockRead).toHaveBeenCalledTimes(2);
  await act(async () => appState('background')); expect(mockRead).toHaveBeenCalledTimes(2);
  mockEnabled = false; await act(async () => tree.update(<Probe />)); expect(result.trends).toEqual([]); expect(result.state).toBe('OFF');
  await act(async () => tree.unmount());
});
it('handles old binaries/read errors and retries without retaining inaccessible data', async () => {
  mockEnabled = true; mockAvailable.mockResolvedValue(false);
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.state).toBe('UNAVAILABLE'); expect(mockRead).not.toHaveBeenCalled();
  mockAvailable.mockResolvedValue(true); mockRead.mockRejectedValueOnce(Error('locked'));
  await act(async () => result.reload()); expect(result.state).toBe('ERROR'); expect(result.trends).toEqual([]);
  await act(async () => result.reload()); expect(result.state).toBe('READY');
  mockReady = false; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('LOADING'); expect(result.trends).toEqual([]);
  await act(async () => tree.unmount());
});
it('retains readings only until a refresh fails or access is disabled and never starts obsolete reads', async () => {
  mockEnabled = true; let tree: any;
  await act(async () => { tree = create(<Probe />); });
  mockRead.mockRejectedValueOnce(Error('locked'));
  await act(async () => appState('active')); expect(result.trends).toEqual([]); expect(result.state).toBe('ERROR');
  let release!: (value: boolean) => void;
  mockAvailable.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  await act(async () => result.reload()); const calls = mockRead.mock.calls.length;
  mockEnabled = false; await act(async () => tree.update(<Probe />));
  await act(async () => release(true)); expect(mockRead).toHaveBeenCalledTimes(calls); expect(result.trends).toEqual([]);
  await act(async () => tree.unmount());
});
it('ignores account round trips, overlapped foreground reads and completions after unmount', async () => {
  mockEnabled = true; let release!: (value: unknown) => void;
  mockRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.state).toBe('LOADING');
  mockUid = 'other'; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('READY');
  mockUid = 'owner'; await act(async () => tree.update(<Probe />)); const currentTime = result.fetchedAt;
  await act(async () => release({})); expect(result.fetchedAt).toBe(currentTime);
  mockRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  await act(async () => appState('active')); expect(result.state).toBe('LOADING');
  await act(async () => appState('active')); expect(result.state).toBe('READY');
  await act(async () => release({})); expect(result.state).toBe('READY');
  mockRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  await act(async () => result.reload()); await act(async () => tree.unmount()); await act(async () => release({}));
  mockUid = null; await act(async () => { tree = create(<Probe />); }); expect(result.state).toBe('OFF'); await act(async () => tree.unmount());
});
