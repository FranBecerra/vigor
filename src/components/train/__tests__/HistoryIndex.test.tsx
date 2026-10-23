import React from 'react';
import HistoryScreen from '@/app/(tabs)/(train)/history';
import { SetType, MuscleGroup } from '@/models';
const { create, act } = require('react-test-renderer');
const mockList = jest.fn(); const mockPush = jest.fn(); let mockUid: string | null = 'owner'; const mockCatalogue = new Map();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockCatalogue }) }));
jest.mock('@/services/repositories', () => ({ workoutSessionRepository: { listByUser: (...args: unknown[]) => mockList(...args) } }));
const session: any = { id: 's', userId: 'owner', sessionName: 'Upper', performedAt: 1000, completedAt: 61000,
  exercises: [{ id: 'ex', exerciseId: 'saved', order: 0, exerciseSnapshot: { name: 'Do not show exercise table here', primaryMuscle: MuscleGroup.CHEST, secondaryMuscles: [MuscleGroup.TRICEPS] }, sets: [
    { id: 'a', setType: SetType.NORMAL, actualWeight: 35, actualReps: 8, completionState: 'DONE' },
    { id: 'w', setType: SetType.WARMUP, actualWeight: 20, actualReps: 8, completionState: 'DONE' },
  ] }] };
const text = (tree: any) => tree.root.findAll((node: any) => typeof node.props.children === 'string' || Array.isArray(node.props.children))
  .flatMap((node: any) => Array.isArray(node.props.children) ? node.props.children.filter((child: any) => typeof child === 'string') : [node.props.children]).join(' ');
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockUid = 'owner'; mockList.mockResolvedValue([session]); });
afterEach(() => { act(() => jest.runOnlyPendingTimers()); jest.useRealTimers(); });
it('shows only compact actual totals and muscle capsules, and opens a separate detailed route', async () => {
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  const output = text(tree);
  expect(output).toContain('Upper'); expect(output).toContain('muscle.CHEST'); expect(output).toContain('muscle.TRICEPS'); expect(output).toContain('0.5');
  expect(output).not.toContain('Do not show exercise table here'); expect(output).not.toContain('workout.discard');
  const card = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'Upper' && typeof node.props.onPress === 'function')[0];
  await act(async () => card.props.onPress()); expect(mockPush).toHaveBeenCalledWith({ pathname: '/workout-history', params: { id: 's' } });
  await act(async () => tree.unmount());
});
it('hides another owner immediately and does not expose results from a stale request', async () => {
  let tree: any; let complete!: (items: any[]) => void; mockList.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  await act(async () => { tree = create(<HistoryScreen />); });
  mockUid = 'other'; mockList.mockResolvedValue([]); await act(async () => tree.update(<HistoryScreen />));
  await act(async () => complete([session])); expect(text(tree)).not.toContain('Upper');
  await act(async () => tree.unmount());
});
it('shows load failure without presenting another workout or a destructive action', async () => {
  mockList.mockRejectedValueOnce(Error('offline')); let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  expect(text(tree)).toContain('workout.historyError'); expect(text(tree)).not.toContain('Upper');
  await act(async () => tree.unmount());
});
