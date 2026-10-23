import React from 'react';
import HistoryScreen from '@/app/workout-history';
import { SetType } from '@/models';
import { WorkoutHistoryEditor } from '../WorkoutHistoryEditor';
const { create, act } = require('react-test-renderer');
const mockList = jest.fn(); const mockDiscard = jest.fn(); const mockRemove = jest.fn();
const mockEdit = jest.fn(); let mockParams: any = { id: 's' };
let mockMenu: any; let mockEntries: any = {}; const mockCatalogue = new Map();
const session: any = { id: 's', userId: 'owner', sessionName: 'Upper', performedAt: 1000, completedAt: 61000,
  mesocycleId: 'm', microcycleId: 'mi', microcycleIndex: 0,
  exercises: [{ id: 'ex', exerciseId: 'missing', isSwap: false, order: 0, notes: 'Seat 4', sets: [
    { id: 'one', setType: SetType.NORMAL, targetReps: 99, targetWeight: 999, targetRIR: 4,
      actualReps: 8, actualWeight: 35, actualRIR: 2, isAutoFilled: false, completionState: 'DONE' },
  ] }] };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ canGoBack: () => true, back: jest.fn() }), useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockCatalogue }) }));
jest.mock('@/services/repositories', () => ({ workoutSessionRepository: {
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
