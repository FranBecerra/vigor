import React from 'react';
import { AppState } from 'react-native';
import { useBioSessionContext } from '../useBioSessionContext';
import { sessionContextFixture, contextWorkout } from '@/test-support/sessionContextFixture';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'synthetic';
let input: ReturnType<typeof sessionContextFixture>, data: any, reviews: any, readiness: any;
let result: ReturnType<typeof useBioSessionContext>, appState: (state: any) => void;
const remove = jest.fn();
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
function Probe() { result = useBioSessionContext(data, reviews, input.catalogue, readiness, input.labels); return null; }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); input = sessionContextFixture(); jest.setSystemTime(input.now); mockUid = input.owner;
  data = { owner: input.owner, ready: true, error: false, plans: input.plans, routines: input.routines, history: [], reload: jest.fn() };
  reviews = { entries: [], ready: true, error: false }; readiness = { state: 'OFF' };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { appState = callback; return { remove }; });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
it('previews only pending choices, resolves changed plans and never performs writes or starts a workout', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.context!.target!.session.index).toBe(0);
  await act(async () => result.select(1)); expect(result.context!.target!.session.index).toBe(1);
  await act(async () => result.select(99)); expect(result.context!.target!.session.index).toBe(1);
  readiness = { state: 'READY', index: undefined }; await act(async () => tree.update(<Probe />));
  expect(result.context!.general.coverage).toBe('UNAVAILABLE');
  data.history = [contextWorkout(undefined, { mesocycleId: input.plans[0].id, plannedSessionIndex: 1 })];
  await act(async () => tree.update(<Probe />)); expect(result.context!.target!.session.index).toBe(0);
  data = { ...data, history: [], routines: [{ ...input.routines[0], activeMesocycleId: 'new-plan' }], plans: [{ ...input.plans[0], id: 'new-plan' }] };
  await act(async () => tree.update(<Probe />)); expect(result.context!.target).toMatchObject({ mesocycleId: 'new-plan', session: { index: 0 } });
  reviews = { ...reviews, ready: false }; await act(async () => tree.update(<Probe />)); expect(result.context!.reviewStatus).toBe('UNAVAILABLE');
  reviews = { ...reviews, ready: true, error: true }; await act(async () => tree.update(<Probe />)); expect(result.context!.reviewStatus).toBe('UNAVAILABLE');
  expect(data.reload).not.toHaveBeenCalled(); await act(async () => tree.unmount()); expect(remove).toHaveBeenCalledTimes(1);
});
it('hides private context while data are unavailable and rejects account round trips and obsolete selection handlers', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); }); await act(async () => result.select(1));
  const obsoleteSelect = result.select; mockUid = 'other'; await act(async () => tree.update(<Probe />));
  expect(result).toMatchObject({ state: 'LOADING', context: undefined });
  await act(async () => result.select(1)); await act(async () => obsoleteSelect(1));
  mockUid = 'synthetic'; await act(async () => tree.update(<Probe />)); expect(result.context!.target!.session.index).toBe(0);
  await act(async () => obsoleteSelect(1)); expect(result.context!.target!.session.index).toBe(0);
  data = { ...data, ready: false }; await act(async () => tree.update(<Probe />)); expect(result.context).toBeUndefined();
  data = { ...data, ready: true, error: true }; await act(async () => tree.update(<Probe />)); expect(result.state).toBe('ERROR'); expect(result.context).toBeUndefined();
  data = { ...data, owner: null, error: false }; mockUid = null; await act(async () => tree.update(<Probe />));
  expect(result.context).toBeUndefined(); await act(async () => result.select(0)); await act(async () => tree.unmount());
});
it('rechecks the rolling exposure window on the focused clock and foreground, even with Health disconnected', async () => {
  const clear = jest.spyOn(global, 'clearInterval');
  data.history = [contextWorkout(undefined, { performedAt: input.now - 73 * 3600000, completedAt: input.now - 72 * 3600000 + 60000 })];
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(result.context!.exposure.some((entry) => entry.recentSets > 0)).toBe(true);
  await act(async () => jest.advanceTimersByTime(120000)); expect(result.context!.exposure.every((entry) => entry.recentSets === 0)).toBe(true);
  jest.setSystemTime(input.now); await act(async () => appState('background')); expect(result.context!.exposure.every((entry) => entry.recentSets === 0)).toBe(true);
  await act(async () => appState('active')); expect(result.context!.exposure.some((entry) => entry.recentSets > 0)).toBe(true);
  expect(data.reload).not.toHaveBeenCalled(); await act(async () => tree.unmount()); expect(clear).toHaveBeenCalledTimes(1);
});
