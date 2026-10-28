import React from 'react';
import { useBioHistory } from '../useBioHistory';
const { create, act } = require('react-test-renderer');
const mockPlans = jest.fn(), mockRoutines = jest.fn(), mockHistory = jest.fn(); let mockUid: string | null = 'owner';
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: { listWhere: (...args: any[]) => mockPlans(...args) },
  routineRepository: { listByUser: (...args: any[]) => mockRoutines(...args) }, workoutSessionRepository: { listByUser: (...args: any[]) => mockHistory(...args) } }));
let value: ReturnType<typeof useBioHistory>;
function Probe() { value = useBioHistory(); return null; }
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockPlans.mockResolvedValue([{ id: 'plan', userId: 'owner' }, { userId: 'other' }]);
  mockRoutines.mockResolvedValue([{ id: 'routine', userId: 'owner' }, { userId: 'other' }]); mockHistory.mockResolvedValue([{ id: 'workout', userId: 'owner' }, { userId: 'other' }]); });
it('loads only owned history and refreshes without silently fabricating unavailable data', async () => {
  let tree: any; await act(async () => { tree = create(<Probe />); });
  expect(value.ready).toBe(true); expect(value.plans).toHaveLength(1); expect(value.routines).toHaveLength(1); expect(value.history).toHaveLength(1);
  expect(mockPlans).toHaveBeenCalledWith('userId', 'owner');
  mockPlans.mockRejectedValueOnce(Error('offline')); await act(async () => value.reload());
  expect(value.error).toBe(true); expect(value.history).toEqual([]);
  await act(async () => value.reload()); expect(value.error).toBe(false); expect(value.history).toHaveLength(1);
  await act(async () => tree.unmount());
});
it('hides previous owners, ignores late results and stops reads when signed out', async () => {
  let release!: (value: any[]) => void; mockPlans.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<Probe />); }); expect(value.ready).toBe(false);
  mockUid = 'other'; mockPlans.mockResolvedValue([]); await act(async () => tree.update(<Probe />));
  await act(async () => release([{ id: 'private', userId: 'owner' }])); expect(value.plans).toEqual([]);
  expect(value.history.every((item) => item.userId === 'other')).toBe(true);
  mockUid = null; await act(async () => tree.update(<Probe />)); expect(value.ready).toBe(true); expect(value.routines).toEqual([]);
  await act(async () => tree.unmount());
});
