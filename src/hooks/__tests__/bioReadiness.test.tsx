import React from 'react';
import { AppState } from 'react-native';
import { useBioReadiness } from '../useBioReadiness';
import { readinessFixture, READINESS_FIXTURE_NOW } from '@/test-support/readinessFixture';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner', mockReady = true, mockBase = true, mockEnabled = true, mockGoal: number | undefined = 480;
let night: any, result: ReturnType<typeof useBioReadiness>, appState: (state: any) => void;
const remove = jest.fn();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('../useAppSettings', () => ({ useAppSettings: () => ({ ready: mockReady,
  settings: { bioHealthEnabled: mockBase, bioNightEnabled: mockEnabled, bioSleepGoalMinutes: mockGoal } }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
function Probe() { result = useBioReadiness(night); return null; }
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(READINESS_FIXTURE_NOW); jest.clearAllMocks();
  mockUid = 'owner'; mockReady = true; mockBase = true; mockEnabled = true; mockGoal = 480;
  night = { owner: 'owner', state: 'READY', analysis: readinessFixture(), reload: jest.fn() };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { appState = callback; return { remove }; });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
it('reuses observations and immediately hides indices on disconnect, unavailable reads and owner changes', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.index!.score).toBe(100);
  for (const state of ['ERROR', 'UNAVAILABLE', 'LOADING', 'OFF']) {
    night = { ...night, state }; await act(async () => tree.update(<Probe />)); expect(result).toEqual({ state, index: undefined });
  }
  night = { ...night, state: 'READY' }; mockUid = 'other';
  await act(async () => tree.update(<Probe />)); expect(result).toEqual({ state: 'LOADING', index: undefined });
  mockUid = null; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('OFF');
  mockUid = 'owner'; mockReady = false; await act(async () => tree.update(<Probe />)); expect(result.index).toBeUndefined();
  mockReady = true; mockBase = false; await act(async () => tree.update(<Probe />)); expect(result.index).toBeUndefined();
  mockBase = true; mockEnabled = false; await act(async () => tree.update(<Probe />)); expect(result.index).toBeUndefined();
  mockEnabled = true; mockGoal = undefined; await act(async () => tree.update(<Probe />)); expect(result.index!.reasons).toContain('SLEEP_GOAL');
  expect(night.reload).not.toHaveBeenCalled(); await act(async () => tree.unmount()); expect(remove).toHaveBeenCalledTimes(1);
});
it('expires the displayed score while focused and rechecks clock on foreground without querying Health', async () => {
  const clear = jest.spyOn(global, 'clearInterval');
  let tree: any; await act(async () => { tree = create(<Probe />); });
  await act(async () => { jest.advanceTimersByTime(34 * 3600000); });
  expect(result.index!.score).toBeUndefined(); expect(result.index!.reasons).toEqual(['STALE']);
  jest.setSystemTime(READINESS_FIXTURE_NOW); await act(async () => appState('background')); expect(result.index!.score).toBeUndefined();
  await act(async () => appState('active')); expect(result.index!.score).toBe(100);
  expect(night.reload).not.toHaveBeenCalled(); await act(async () => tree.unmount()); expect(clear).toHaveBeenCalledTimes(1);
});
