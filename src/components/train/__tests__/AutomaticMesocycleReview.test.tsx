import Screen from '@/app/(tabs)/(train)/mesocycle-continuity';
import { MesocycleContinuityFlow } from '../MesocycleContinuityFlow';
import { continuityFixture } from '@/test-support/continuityFixture';

const { create, act } = require('react-test-renderer');
const mockLoad = jest.fn();
const mockRouter = { dismissTo: jest.fn(), canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() };
let mockParams: { routineId: string; sourceId: string; afterWorkout?: string };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: new Map() }) }));
const mockReviews = { ready: false, error: false, entries: [] };
jest.mock('@/hooks/useMicrocycleReviews', () => ({ useMicrocycleReviews: () => mockReviews }));
jest.mock('@/services/training/mesocycleContinuityRepository', () => ({
  loadContinuityReview: (...args: unknown[]) => mockLoad(...args), saveMesocycleContinuation: jest.fn(),
}));

function setup(automatic: boolean) {
  const { data } = continuityFixture();
  mockParams = { routineId: data.routine.id, sourceId: data.source.id, ...(automatic ? { afterWorkout: data.history.at(-1)!.id } : {}) };
  mockLoad.mockResolvedValue(data);
  return data;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockReviews.ready = false;
  mockReviews.error = false;
});

it('opens the existing review after server confirmation, with cancellation returning to Training', async () => {
  const data = setup(true);
  let tree: any;
  await act(async () => { tree = create(<Screen />); });
  expect(mockLoad).toHaveBeenCalledWith('owner', data.routine.id, data.source.id);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(tree.root.findByType(MesocycleContinuityFlow).props.feedback).toBeNull();
  mockReviews.ready = true;
  await act(async () => tree.update(<Screen />));
  expect(tree.root.findByType(MesocycleContinuityFlow).props.feedback).toBe(mockReviews.entries);
  mockReviews.error = true;
  await act(async () => tree.update(<Screen />));
  expect(tree.root.findByType(MesocycleContinuityFlow).props.feedback).toBeNull();
  await act(async () => tree.root.findByType(MesocycleContinuityFlow).props.onCancel());
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(train)');
  await act(async () => tree.unmount());
});

it.each(['pending occurrence', 'missing saved workout', 'offline'])('returns to Training when auto review cannot be confirmed: %s', async reason => {
  const data = setup(true);
  if (reason === 'offline') mockLoad.mockRejectedValue(Error('offline'));
  else data.history.splice(reason === 'pending occurrence' ? 0 : -1, 1);
  let tree: any;
  await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findAllByType(MesocycleContinuityFlow)).toHaveLength(0);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(train)');
  await act(async () => tree.unmount());
});

it('still allows manual review of an unfinished block and returns to its original screen', async () => {
  const data = setup(false);
  data.history.pop();
  let tree: any;
  await act(async () => { tree = create(<Screen />); });
  await act(async () => tree.root.findByType(MesocycleContinuityFlow).props.onCancel());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
