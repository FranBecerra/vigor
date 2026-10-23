import React from 'react';
import { Alert, Text } from 'react-native';
import Screen from '@/app/(tabs)/(train)/routine';
import { PlanPreview } from '../generate/PlanPreview';
import { ActionMenuSheet } from '../ActionMenuSheet';
import { RIRProgressionPreview } from '../RIRProgressionPreview';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetType } from '@/models';
const { create, act } = require('react-test-renderer');
const mockUpdate = jest.fn(), mockReload = jest.fn(), mockReplace = jest.fn();
const mockCatalogue = new Map([[EXERCISE_CATALOGUE[0].id, EXERCISE_CATALOGUE[0]]]);
const mockSession = { index: 0, focus: 'LOWER', estimatedWorkMinutes: 10, exercises: [{ exerciseId: EXERCISE_CATALOGUE[0].id, order: 0, isEdited: false,
  sets: Array.from({ length: 3 }, () => ({ setType: SetType.NORMAL, targetReps: 10, targetRepsMin: 8, targetRIR: 2 })) }] };
let mockMeso: any;
const mockRoutine: any = { mesocycleId: 'm', name: 'Lower plan', objective: 'Hypertrophy', generationGoal: 'HYPERTROPHY', isActive: true, currentMicrocycleIndex: 0, availableEquipment: [],
  microcycles: Array.from({ length: 6 }, (_, index) => ({ number: index + 1, sessions: [{ plannedSessionIndex: 0, name: 'Lower', exercises: [] }] })) };
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), useLocalSearchParams: () => ({ mesocycleId: 'm', plannedSessionIndex: '0', microcycleIndex: '0' }),
  useFocusEffect: (callback: any) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0, top: 0 }) }));
jest.mock('react-native-screens/experimental', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => ({ routines: [mockRoutine], reload: mockReload }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ catalogue: [...mockCatalogue.values()], exercisesById: mockCatalogue }) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: { get: async () => mockMeso, update: (...args: unknown[]) => mockUpdate(...args) } }));
jest.mock('../generate/PlanPreview', () => ({ PlanPreview: () => null }));
jest.mock('../generate/ExerciseSwapSheet', () => ({ ExerciseSwapSheet: () => null }));
jest.mock('../ActionMenuSheet', () => ({ ActionMenuSheet: () => null }));
jest.mock('../RIRProgressionPreview', () => ({ RIRProgressionPreview: () => null }));
jest.mock('../SharedNoteButton', () => ({ SharedNoteButton: () => null }));
jest.mock('../MuscleVolumeCard', () => ({ MuscleVolumeCard: () => null }));
const tapText = async (tree: any, text: string) => act(async () => {
  const node = tree.root.findAll((entry: any) => typeof entry.props.onPress === 'function' && entry.findAllByType(Text).some((label: any) => label.props.children === text))[0];
  if (!node) throw new Error(`Missing ${text}: ${JSON.stringify(tree.root.findAllByType(Text).map((label: any) => label.props.children))}`);
  node.props.onPress();
});
beforeEach(() => { jest.clearAllMocks(); mockMeso = { id: 'm', userId: 'u', status: 'ACTIVE', currentMicrocycleIndex: 0, projectedMicrocycles: 6, sessionsPerMicrocycle: 1, targetVolumePerGroup: {}, startedAt: 1, updatedAt: 1, plannedSessions: [mockSession] }; });
async function prepare() {
  let tree: any; await act(async () => { tree = create(<Screen />); });
  await tapText(tree, 'routine.editSession');
  await act(async () => tree.root.findByType(PlanPreview).props.onChangeSet(0, 0, 0, { targetRIR: 3 }));
  await tapText(tree, 'routine.saveChanges');
  const menu = tree.root.findByType(ActionMenuSheet).props;
  expect(menu.actions.map((action: any) => action.label)).toEqual(['routine.onlyThisMicrocycle', 'progression.recalculate', 'progression.keepFixed']);
  await act(async () => { menu.onClose(); menu.actions[1].onPress(); });
  expect(tree.root.findByType(RIRProgressionPreview).props.steps).toHaveLength(6);
  expect(mockUpdate).not.toHaveBeenCalled(); return tree;
}
it('reviews before writing and persists the accepted microcycle-specific RIR curve', async () => {
  const tree = await prepare();
  await act(async () => tree.root.findByType(RIRProgressionPreview).props.onApply());
  expect(mockUpdate).toHaveBeenCalledWith('m', expect.objectContaining({ sessionOverrides: expect.objectContaining({
    '0:0': expect.objectContaining({ index: 0 }), '5:0': expect.objectContaining({ index: 0 }),
  }) }));
  expect(mockReload).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('rejects a stale preview and retains the editor for renewed review', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); const tree = await prepare();
  mockMeso = { ...mockMeso, projectedMicrocycles: 5 };
  await act(async () => tree.root.findByType(RIRProgressionPreview).props.onApply());
  expect(mockUpdate).not.toHaveBeenCalled(); expect(alert).toHaveBeenCalled();
  expect(tree.root.findByType(RIRProgressionPreview).props.steps).toHaveLength(6);
  await act(async () => tree.unmount()); alert.mockRestore();
});
it('keeps pending session editing available in a partially completed microcycle', async () => {
  mockRoutine.microcycles[0].sessions.push({ plannedSessionIndex: 1, name: 'Other', exercises: [], completedOn: '2026-10-20' });
  const tree = await prepare();
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); mockRoutine.microcycles[0].sessions.pop();
});
it('opens a completed session in the actual history editor instead of the locked plan editor', async () => {
  mockRoutine.microcycles[0].sessions[0].completedWorkoutId = 'actual';
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/workout-history', params: { id: 'actual', edit: '1' } });
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); delete mockRoutine.microcycles[0].sessions[0].completedWorkoutId;
});
