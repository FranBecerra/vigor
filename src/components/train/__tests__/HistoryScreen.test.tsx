import React from 'react';
import HistoryScreen from '@/app/workout-history';
import { SetType } from '@/models';
import { Alert } from 'react-native';
import { RIRProgressionPreview } from '../RIRProgressionPreview';
import { WorkoutHistoryEditor } from '../WorkoutHistoryEditor';
const { create, act } = require('react-test-renderer');
const mockList = jest.fn(); const mockDiscard = jest.fn(); const mockRemove = jest.fn();
const mockEdit = jest.fn(); let mockParams: any = { id: 's' };
const mockGetPlan = jest.fn(), mockUpdatePlan = jest.fn();
const mockGetRoutine = jest.fn(), mockPush = jest.fn();
let mockMenu: any; let mockEntries: any = {}; const mockCatalogue = new Map();
const session: any = { id: 's', userId: 'owner', sessionName: 'Upper', performedAt: 1000, completedAt: 61000,
  mesocycleId: 'm', microcycleId: 'mi', microcycleIndex: 0,
  exercises: [{ id: 'ex', exerciseId: 'missing', isSwap: false, order: 0, notes: 'Seat 4', sets: [
    { id: 'one', setType: SetType.NORMAL, targetReps: 99, targetWeight: 999, targetRIR: 4,
      actualReps: 8, actualWeight: 35, actualRIR: 2, isAutoFilled: false, completionState: 'DONE' },
  ] }] };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ push: mockPush, canGoBack: () => true, back: jest.fn() }), useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockCatalogue }) }));
jest.mock('@/services/repositories', () => ({ routineRepository: { get: (...args: unknown[]) => mockGetRoutine(...args) }, mesocycleRepository: { get: (...args: unknown[]) => mockGetPlan(...args), update: (...args: unknown[]) => mockUpdatePlan(...args) }, workoutSessionRepository: {
  listByUser: (...args: unknown[]) => mockList(...args), discardLocally: (...args: unknown[]) => mockDiscard(...args),
  editCompletedLocally: (...args: unknown[]) => mockEdit(...args),
} }));
jest.mock('@/hooks/useHealthExport', () => ({ useHealthExport: () => ({ entries: mockEntries, service: { remove: mockRemove } }) }));
jest.mock('../ActionMenuSheet', () => ({ ActionMenuSheet: (props: any) => { mockMenu = props; return null; } }));
jest.mock('../BodyMap', () => ({ BodyMap: () => null }));
jest.mock('../WorkoutHealthExport', () => ({ WorkoutHealthExport: () => null }));
jest.mock('../WorkoutHistoryEditor', () => ({ WorkoutHistoryEditor: () => null }));
const discardButton = (tree: any) => tree.root.findAll((node: any) =>
  node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
  && node.findAll((child: any) => child.props.children === 'workout.discard').length)[0];
beforeEach(() => {
  jest.clearAllMocks(); mockParams = { id: 's' }; mockEntries = {}; mockList.mockResolvedValue([session]); mockDiscard.mockResolvedValue(undefined);
  mockRemove.mockImplementation(async (_session, _alsoHealth, discard) => { await discard(); return true; });
});
it('opens a linked recorded session in the shared root-stack editor with its exact cycle, retaining History underneath', async () => {
  mockList.mockResolvedValue([{ ...session, plannedSessionIndex: 4, microcycleIndex: 2 }]);
  mockGetPlan.mockResolvedValue({ id: 'm', routineId: 'r', userId: 'owner', plannedSessions: [{ index: 4 }] });
  mockGetRoutine.mockResolvedValue({ id: 'r', userId: 'owner' });
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  const edit = tree.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.findAll((child: any) => child.props.children === 'historyEdit.title').length)[0];
  await act(async () => edit.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/routine-editor', params: { mesocycleId: 'm', microcycleIndex: '2', plannedSessionIndex: '4', edit: '1' } });
  expect(tree.root.findAllByType(WorkoutHistoryEditor)).toHaveLength(0); await act(async () => tree.unmount());
});
it('opens the exact completed record for editing from the mesocycle and does not reopen after saving', async () => {
  mockParams.edit = '1';
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  expect(tree.root.findByType(WorkoutHistoryEditor).props.session).toEqual(session);
  const corrected = { ...session, sessionName: 'Corrected' }; mockEdit.mockResolvedValue(corrected);
  const editor = tree.root.findByType(WorkoutHistoryEditor).props;
  await act(async () => { await editor.onSave(corrected); editor.onClose(); });
  expect(mockEdit).toHaveBeenCalledWith(session, 'owner', corrected, expect.any(Function));
  expect(tree.root.findAllByType(WorkoutHistoryEditor)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Corrected');
  await act(async () => tree.unmount());
});
it.each([{ userId: 'other' }, { completedAt: undefined }, { discardedAt: 9 }])('never auto-edits an unavailable record %j', async (patch) => {
  mockParams.edit = '1'; mockList.mockResolvedValue([{ ...session, ...patch }]);
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  expect(tree.root.findAllByType(WorkoutHistoryEditor)).toHaveLength(0);
  expect(mockEdit).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('opens the latest workout with actual exercises, sets, intensity and notes', async () => {
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  const output = JSON.stringify(tree.toJSON());
  for (const text of ['Upper', '35', '8', 'Seat 4', 'historyDetails.unknownExercise']) expect(output).toContain(text);
  expect(output).not.toContain('999'); expect(output).not.toContain('workout.delete');
  expect(mockDiscard).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('requires explicit confirmation and cancel leaves the workout untouched', async () => {
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  await act(async () => discardButton(tree).props.onPress());
  expect(mockMenu.title).toBe('workout.discard'); expect(mockMenu.actions[0].tone).toBe('danger');
  await act(async () => { mockMenu.onClose(); mockMenu.actions.at(-1).onPress(); });
  expect(mockDiscard).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  expect(mockMenu.title).toBeNull(); await act(async () => tree.unmount());
});
it('discards only the confirmed record and retains it when local acceptance fails', async () => {
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  mockDiscard.mockRejectedValueOnce(Error('local failure'));
  await act(async () => discardButton(tree).props.onPress());
  await act(async () => mockMenu.actions[0].onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('workout.historyError'); expect(discardButton(tree)).toBeDefined();
  await act(async () => mockMenu.actions[0].onPress());
  expect(mockDiscard).toHaveBeenLastCalledWith(session); expect(discardButton(tree)).toBeUndefined();
  await act(async () => tree.unmount());
});

it('saves a correction before reviewing progression, then updates only pending future overrides on explicit acceptance', async () => {
  mockParams.edit = '1';
  const actual = { ...session, plannedSessionIndex: 0, trainingGoal: 'HYPERTROPHY' };
  const corrected = { ...actual, exercises: actual.exercises.map((entry: any) => ({ ...entry, sets: entry.sets.map((set: any) => ({ ...set, actualRIR: 3 })) })) };
  const plan = { id: 'm', userId: 'owner', status: 'ACTIVE', currentMicrocycleIndex: 1, projectedMicrocycles: 4, prescriptionMode: 'MANUAL',
    plannedSessions: [{ index: 0, focus: 'UPPER', estimatedWorkMinutes: 10, exercises: [{ exerciseId: 'missing', order: 0, isEdited: false,
      sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRepsMin: 8, targetRIR: 2 }] }] }] };
  mockList.mockResolvedValue([actual]); mockGetPlan.mockResolvedValue(plan); mockEdit.mockResolvedValue(corrected); mockUpdatePlan.mockResolvedValue(undefined);
  let tree: any; await act(async () => { tree = create(<HistoryScreen />); });
  const editor = tree.root.findByType(WorkoutHistoryEditor).props;
  await act(async () => { await editor.onSave(corrected, true); editor.onClose(); });
  expect(mockGetPlan.mock.invocationCallOrder[0]).toBeGreaterThan(mockEdit.mock.invocationCallOrder[0]);
  expect(mockUpdatePlan).not.toHaveBeenCalled();
  expect(tree.root.findByType(RIRProgressionPreview).props.steps.map((s: any) => s.index)).toEqual([1, 2, 3]);
  mockList.mockResolvedValue([corrected]);
  await act(async () => tree.root.findByType(RIRProgressionPreview).props.onApply());
  expect(mockUpdatePlan).toHaveBeenCalledWith('m', expect.objectContaining({ sessionOverrides: expect.objectContaining({ '1:0': expect.any(Object), '3:0': expect.any(Object) }) }));
  expect(mockUpdatePlan.mock.calls[0][1].sessionOverrides['0:0']).toBeUndefined();
  expect(tree.root.findByType(RIRProgressionPreview).props.steps).toBeNull();
  await act(async () => tree.unmount());
});

it('keeps a history correction saved if its plan is unavailable, without reporting the correction as failed', async () => {
  mockParams.edit = '1'; mockEdit.mockResolvedValue(session); mockGetPlan.mockRejectedValueOnce(Error('offline'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); let tree: any;
  await act(async () => { tree = create(<HistoryScreen />); });
  await act(async () => tree.root.findByType(WorkoutHistoryEditor).props.onSave(session, true));
  expect(alert).toHaveBeenCalledWith('workout.saved', 'historyProgression.failed');
  expect(mockUpdatePlan).not.toHaveBeenCalled(); await act(async () => tree.unmount()); alert.mockRestore();
});
