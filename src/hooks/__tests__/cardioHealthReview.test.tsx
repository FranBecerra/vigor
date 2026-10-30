import React from 'react';
import { AppState } from 'react-native';
import { useCardioHealthReview } from '../useCardioHealthReview';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner', mockLoading = false, mockFocused = true;
const mockAvailable = jest.fn(), mockAuthorize = jest.fn(), mockRead = jest.fn();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid, isLoading: mockLoading }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('@/services/health/cardioHealthClient', () => ({ cardioHealthBridge: {
  available: () => mockAvailable(), authorize: () => mockAuthorize(), read: (...args: any[]) => mockRead(...args),
} }));
let result: ReturnType<typeof useCardioHealthReview>, appState: (next: string) => void;
function Probe() { result = useCardioHealthReview(); return null; }
beforeEach(() => {
  jest.clearAllMocks(); mockUid = 'owner'; mockLoading = false; mockFocused = true;
  mockAvailable.mockResolvedValue(true); mockAuthorize.mockResolvedValue(undefined); mockRead.mockResolvedValue({ version: 1, truncated: false, workouts: [] });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener: any) => { appState = listener; return { remove: jest.fn() }; });
});
afterEach(() => jest.restoreAllMocks());
it('does nothing on mount/foreground and reads a bounded window only after an explicit action', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(result.state).toBe('IDLE'); expect(mockAvailable).not.toHaveBeenCalled(); expect(mockAuthorize).not.toHaveBeenCalled();
  await act(async () => appState('active')); expect(mockRead).not.toHaveBeenCalled();
  await act(async () => result.read()); expect(result.state).toBe('READY'); expect(result.data?.workouts).toEqual([]);
  expect(mockRead.mock.calls[0][1] - mockRead.mock.calls[0][0]).toBe(42 * 86400000);
  await act(async () => appState('inactive')); expect(result.state).toBe('READY');
  await act(async () => appState('background')); expect(result.data).toBeUndefined(); expect(result.state).toBe('IDLE');
  await act(async () => appState('active')); expect(mockRead).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('supports explicit retry after authorization/read errors and unsupported binaries without reporting grants', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  mockAvailable.mockResolvedValueOnce(false); await act(async () => result.read()); expect(result.state).toBe('UNAVAILABLE'); expect(mockAuthorize).not.toHaveBeenCalled();
  mockAuthorize.mockRejectedValueOnce(Error('cancelled')); await act(async () => result.read()); expect(result.state).toBe('ERROR'); expect(mockRead).not.toHaveBeenCalled();
  mockRead.mockRejectedValueOnce(Error('locked')); await act(async () => result.read()); expect(result.state).toBe('ERROR'); expect(result.data).toBeUndefined();
  mockRead.mockResolvedValueOnce({ version: 9 }); await act(async () => result.read()); expect(result.state).toBe('ERROR');
  await act(async () => result.read()); expect(result.state).toBe('READY');
  await act(async () => result.clear()); expect(result.state).toBe('IDLE'); await act(async () => tree.unmount());
});
it('ignores duplicate taps, background/blur completions and never restarts a cleared read automatically', async () => {
  let release!: (value: unknown) => void;
  mockRead.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  let pending!: Promise<void>; await act(async () => { pending = result.read(); }); expect(result.state).toBe('LOADING');
  await act(async () => result.read()); expect(mockRead).toHaveBeenCalledTimes(1);
  await act(async () => appState('background')); await act(async () => release({ version: 1, truncated: false, workouts: [] }));
  await pending; expect(result.state).toBe('IDLE'); expect(result.data).toBeUndefined();
  await act(async () => result.read()); expect(result.state).toBe('READY');
  mockFocused = false; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('IDLE');
  await act(async () => result.read()); expect(mockRead).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});
it('isolates owner round trips, obsolete callbacks, loading auth and unmount during authorization', async () => {
  let release!: () => void; mockAuthorize.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  const staleRead = result.read; let pending!: Promise<void>; await act(async () => { pending = result.read(); });
  mockUid = 'second'; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('IDLE');
  await act(async () => staleRead()); expect(mockAvailable).toHaveBeenCalledTimes(1);
  mockUid = 'owner'; await act(async () => tree.update(<Probe />)); await act(async () => release()); await pending;
  expect(mockRead).not.toHaveBeenCalled(); expect(result.data).toBeUndefined();
  mockLoading = true; await act(async () => tree.update(<Probe />)); await act(async () => result.read()); expect(mockAvailable).toHaveBeenCalledTimes(1);
  mockUid = null; mockLoading = false; await act(async () => tree.update(<Probe />)); await act(async () => result.read()); expect(result.state).toBe('IDLE');
  mockUid = 'owner'; await act(async () => tree.update(<Probe />));
  mockAuthorize.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  await act(async () => { pending = result.read(); }); await act(async () => tree.unmount()); await act(async () => release()); await pending;
  expect(mockRead).not.toHaveBeenCalled();
});
it('does not authorize after availability resolves for a backgrounded or replaced request', async () => {
  let release!: (available: boolean) => void; mockAvailable.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  let pending!: Promise<void>; await act(async () => { pending = result.read(); }); await act(async () => result.clear());
  await act(async () => release(true)); await pending; expect(mockAuthorize).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('ignores stale unavailable and rejected read results after clearing', async () => {
  let available!: (value: boolean) => void;
  mockAvailable.mockImplementationOnce(() => new Promise(resolve => { available = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  let pending!: Promise<void>; await act(async () => { pending = result.read(); });
  await act(async () => result.clear()); await act(async () => available(false)); await pending; expect(result.state).toBe('IDLE');
  let reject!: (cause: Error) => void;
  mockRead.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await act(async () => { pending = result.read(); }); await act(async () => result.clear());
  await act(async () => reject(Error('obsolete'))); await pending; expect(result.state).toBe('IDLE'); expect(result.data).toBeUndefined();
  await act(async () => tree.unmount());
});
it('invalidates an in-flight read while authentication becomes unresolved, including a return to the same owner', async () => {
  let release!: (value: unknown) => void; mockRead.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); });
  let pending!: Promise<void>; await act(async () => { pending = result.read(); });
  mockLoading = true; await act(async () => tree.update(<Probe />)); expect(result.data).toBeUndefined();
  await act(async () => release({ version: 1, truncated: false, workouts: [] })); await pending;
  mockLoading = false; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('IDLE'); expect(result.data).toBeUndefined();
  expect(mockRead).toHaveBeenCalledTimes(1); await act(async () => result.read()); expect(result.state).toBe('READY');
  await act(async () => tree.unmount());
});
