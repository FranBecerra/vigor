import React from 'react';
import { Alert, Text } from 'react-native';
import Screen from '@/app/(tabs)/(train)/routine';
import { PlanPreview } from '../generate/PlanPreview';
import { ActionMenuSheet } from '../ActionMenuSheet';
import { RIRProgressionPreview } from '../RIRProgressionPreview';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetType } from '@/models';
import { RecordedSessionEditor } from '../RecordedSessionEditor';
const { create, act } = require('react-test-renderer');
const mockUpdate = jest.fn(), mockReload = jest.fn(), mockReplace = jest.fn();
const mockBack = jest.fn(), mockTemplate = jest.fn(), mockActuals = jest.fn();
let mockViews: any[];
const mockNavigation = { setOptions: jest.fn() };
const mockTranslate = (key: string) => key;
const mockCatalogue = new Map([[EXERCISE_CATALOGUE[0].id, EXERCISE_CATALOGUE[0]]]);
const mockSession = { index: 0, focus: 'LOWER', estimatedWorkMinutes: 10, exercises: [{ exerciseId: EXERCISE_CATALOGUE[0].id, order: 0, isEdited: false,
  sets: Array.from({ length: 3 }, () => ({ setType: SetType.NORMAL, targetReps: 10, targetRepsMin: 8, targetRIR: 2 })) }] };
let mockMeso: any;
let mockParams: any = { mesocycleId: 'm', plannedSessionIndex: '0', microcycleIndex: '0' };
const mockRoutine: any = { mesocycleId: 'm', name: 'Lower plan', objective: 'Hypertrophy', generationGoal: 'HYPERTROPHY', isActive: true, currentMicrocycleIndex: 0, availableEquipment: [],
  microcycles: Array.from({ length: 6 }, (_, index) => ({ number: index + 1, sessions: [{ plannedSessionIndex: 0, name: 'Lower', exercises: [] }] })) };
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, canGoBack: () => true, back: mockBack }), useNavigation: () => mockNavigation, useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: any) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0, top: 0 }) }));
jest.mock('react-native-screens/experimental', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => ({ routines: mockViews, reload: mockReload }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'u' }) }));
jest.mock('../RecordedSessionEditor', () => ({ RecordedSessionEditor: () => null }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ catalogue: [...mockCatalogue.values()], exercisesById: mockCatalogue }) }));
jest.mock('@/services/repositories', () => ({ routineRepository: { get: (...args: unknown[]) => mockTemplate(...args) },
  workoutSessionRepository: { listByUser: (...args: unknown[]) => mockActuals(...args) },
  mesocycleRepository: { get: async () => mockMeso, update: (...args: unknown[]) => mockUpdate(...args) } }));
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
beforeEach(() => { jest.clearAllMocks(); mockViews = [mockRoutine]; mockParams = { mesocycleId: 'm', plannedSessionIndex: '0', microcycleIndex: '0' }; mockMeso = { id: 'm', userId: 'u', status: 'ACTIVE', currentMicrocycleIndex: 0, projectedMicrocycles: 6, sessionsPerMicrocycle: 1, targetVolumePerGroup: {}, startedAt: 1, updatedAt: 1, plannedSessions: [mockSession] }; });
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
it('keeps a completed session in the routine with its exact execution, without navigating to History', async () => {
  mockRoutine.microcycles[0].sessions[0].completedWorkoutId = 'actual';
  mockParams.edit = '1';
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(mockReplace).not.toHaveBeenCalled();
  expect(tree.root.findByType(RecordedSessionEditor).props).toMatchObject({ workoutId: 'actual', mesocycleId: 'm', cycle: 0, sessionIndex: 0, editing: true });
  expect(tree.root.findAllByType(PlanPreview)).toHaveLength(0);
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(RecordedSessionEditor).props.onClose(true));
  expect(tree.root.findByType(RecordedSessionEditor).props.editing).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); delete mockRoutine.microcycles[0].sessions[0].completedWorkoutId;
});

it('protects recorded drafts when switching to pending sessions, and returns directly to the original entry on Back', async () => {
  mockRoutine.microcycles[0].sessions[0].completedWorkoutId = 'actual'; mockParams.edit = '1';
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); let tree: any;
  await act(async () => { tree = create(<Screen />); });
  await act(async () => tree.root.findByType(RecordedSessionEditor).props.onDirtyChange(true));
  const next = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'sharedRoutineEditor.nextCycle' && typeof node.props.onPress === 'function')[0];
  await act(async () => next.props.onPress());
  expect(tree.root.findByType(RecordedSessionEditor).props.cycle).toBe(0); expect(alert).toHaveBeenCalled();
  await act(async () => alert.mock.calls.at(-1)![2]![1].onPress!());
  expect(tree.root.findAllByType(RecordedSessionEditor)).toHaveLength(0); expect(tree.root.findByType(PlanPreview).props.sessions).toHaveLength(1);
  await act(async () => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(mockBack).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); delete mockRoutine.microcycles[0].sessions[0].completedWorkoutId; alert.mockRestore();
});

it('resolves an archived block from its owned saved template and history without replacing the active routine', async () => {
  mockViews = []; mockParams.edit = '1'; mockMeso = { ...mockMeso, routineId: 'r', status: 'COMPLETED', prescriptionMode: 'MANUAL' };
  mockTemplate.mockResolvedValue({ id: 'r', userId: 'u', name: 'Archived', icon: 'moon', accentColor: '#123456', isActive: true, activeMesocycleId: 'new-block',
    generation: { goal: 'HYPERTROPHY', split: 'FULL_BODY', availableEquipment: [] } });
  mockActuals.mockResolvedValue([{ id: 'actual', userId: 'u', mesocycleId: 'm', microcycleIndex: 0, plannedSessionIndex: 0, performedAt: 1, completedAt: 1000,
    exercises: [{ id: 'e', exerciseId: EXERCISE_CATALOGUE[0].id, order: 0, sets: [{ id: 's', setType: SetType.NORMAL, actualReps: 10, actualWeight: 20, completionState: 'DONE' }] }] }]);
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findByType(RecordedSessionEditor).props).toMatchObject({ workoutId: 'actual', editing: true, cycle: 0 });
  expect(mockReplace).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('uses the same single-session editor from the routine entry, with tabs, cycle navigation and dirty-draft protection', async () => {
  mockParams = { mesocycleId: 'm' };
  const other = { ...mockSession, index: 1, name: 'Upper' };
  mockMeso = { ...mockMeso, plannedSessions: [mockSession, other], sessionsPerMicrocycle: 2 };
  mockRoutine.microcycles.forEach((micro: any) => micro.sessions.push({ plannedSessionIndex: 1, name: 'Upper', exercises: [] }));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let tree: any; await act(async () => { tree = create(<Screen />); });
  await tapText(tree, 'routine.edit');
  expect(tree.root.findByType(PlanPreview).props.sessions).toHaveLength(1);
  const tabs = () => tree.root.findAll((node: any) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function');
  expect(tabs().map((node: any) => node.props.accessibilityLabel)).toEqual(['Lower', 'Upper']);
  await act(async () => tabs()[1].props.onPress());
  expect(tree.root.findByType(PlanPreview).props.sessions[0].index).toBe(1);
  await act(async () => tree.root.findByType(PlanPreview).props.onChangeSet(1, 0, 0, { targetRIR: 3 }));
  await act(async () => tabs()[0].props.onPress());
  expect(alert).toHaveBeenLastCalledWith('sharedRoutineEditor.unsaved', expect.any(String), expect.any(Array));
  expect(tree.root.findByType(PlanPreview).props.sessions[0].index).toBe(1);
  await act(async () => alert.mock.calls.at(-1)![2]![1].onPress!());
  const next = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'sharedRoutineEditor.nextCycle' && typeof node.props.onPress === 'function')[0];
  await act(async () => next.props.onPress());
  await act(async () => tree.root.findByType(PlanPreview).props.onChangeSet(0, 0, 0, { targetRIR: 3 }));
  await tapText(tree, 'routine.saveChanges');
  const menu = tree.root.findByType(ActionMenuSheet).props;
  await act(async () => { menu.onClose(); menu.actions.find((a: any) => a.label === 'progression.recalculate').onPress(); });
  expect(tree.root.findByType(RIRProgressionPreview).props.steps[0].index).toBe(1);
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); alert.mockRestore();
  mockRoutine.microcycles.forEach((micro: any) => micro.sessions.pop());
});
