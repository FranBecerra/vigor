import React from 'react';
import { Alert } from 'react-native';
import ActivityScreen from '@/app/(tabs)/(train)/activity';
import ActivityEditorScreen from '@/app/(tabs)/(train)/activity-editor';
import ActivitiesScreen from '@/app/(tabs)/(train)/activities';
import { SportActivityForm } from '../SportActivityForm';
import { SportActivitiesHome } from '../SportActivitiesHome';
import { saveSportDraft } from '@/services/cardio/sportActivities';
const { create, act } = require('react-test-renderer');
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = { id: 'a', mode: 'PLAN' }, mockUid = 'owner';
const mockSports = { entries: [] as any[], ready: true, error: false, reload: jest.fn(), save: jest.fn(), discard: jest.fn(), newId: jest.fn(() => 'new') };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('@/hooks/useSportActivities', () => ({ useSportActivities: () => mockSports }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../SportActivityForm', () => ({ SportActivityForm: () => null }));
const now = Date.UTC(2026, 9, 28, 12);
const draft = { sport: 'PADEL', context: 'CLASS', name: 'Lesson', notes: 'Notes', mode: 'PLAN',
  startAt: now - 7200000, durationMinutes: 60, timeZone: 'Europe/Madrid', effort: null } as const;
const planned = saveSportDraft('a', 'owner', draft, now - 86400000);
const completed = saveSportDraft('a', 'owner', { ...draft, mode: 'RECORD', effort: 7, durationMinutes: 75 }, now, planned);
function press(tree: any, label: string) {
  return tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress();
}
beforeEach(() => {
  jest.clearAllMocks(); mockParams = { id: 'a', mode: 'PLAN' }; mockUid = 'owner'; mockSports.entries = [planned];
  mockSports.ready = true; mockSports.error = false; mockSports.save.mockResolvedValue(completed); mockSports.discard.mockResolvedValue(undefined); mockRouter.canGoBack.mockReturnValue(true);
});

it('opens edit or recording from a plan and requires explicit confirmation before discarding it', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); let tree: any;
  await act(async () => { tree = create(<ActivityScreen />); });
  await act(async () => press(tree, 'sportActivities.edit'));
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/activity-editor', params: { id: 'a', mode: 'PLAN' } });
  await act(async () => press(tree, 'sportActivities.record'));
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/activity-editor', params: { id: 'a', mode: 'RECORD' } });
  await act(async () => press(tree, 'sportActivities.cancelPlan')); expect(mockSports.discard).not.toHaveBeenCalled();
  const choices = alert.mock.calls[0][2]!;
  expect(choices[0].style).toBe('cancel'); expect(choices[1].style).toBe('destructive');
  await act(async () => choices[1].onPress!()); expect(mockSports.discard).toHaveBeenCalledWith(planned);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/activities');
  await act(async () => tree.unmount()); alert.mockRestore();
});

it('offers only actual-history edit after recording and keeps the detail open on discard failure', async () => {
  mockSports.entries = [completed]; mockSports.discard.mockRejectedValueOnce(Error('offline'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); let tree: any;
  await act(async () => { tree = create(<ActivityScreen />); });
  expect(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'sportActivities.record')).toHaveLength(0);
  await act(async () => press(tree, 'sportActivities.edit'));
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/activity-editor', params: { id: 'a', mode: 'RECORD' } });
  await act(async () => press(tree, 'sportActivities.discard'));
  await act(async () => alert.mock.calls[0][2]![1].onPress!());
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(tree.root.findAll((node: any) => node.props.accessibilityRole === 'alert')[0].props.children).toBe('sportActivities.saveFailed');
  await act(async () => tree.unmount()); alert.mockRestore();
});

it('keeps the original revision while editing, even when a remote update arrives', async () => {
  let tree: any; await act(async () => { tree = create(<ActivityEditorScreen />); });
  expect(mockSports.save).not.toHaveBeenCalled();
  mockSports.entries = [{ ...planned, revision: 2 }]; await act(async () => tree.update(<ActivityEditorScreen />));
  expect(tree.root.findByType(SportActivityForm).props.activity).toEqual(planned);
  await act(async () => tree.root.findByType(SportActivityForm).props.onSave(draft));
  expect(mockSports.save).toHaveBeenCalledWith('a', planned, draft);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/activities');
  await act(async () => tree.unmount());
});

it('resets the editor on account change and never navigates a stale editor after saving', async () => {
  let done!: () => void; mockSports.save.mockImplementationOnce(() => new Promise<void>((resolve) => { done = resolve; }));
  let tree: any; await act(async () => { tree = create(<ActivityEditorScreen />); });
  let pending: Promise<void>; await act(async () => { pending = tree.root.findByType(SportActivityForm).props.onSave(draft); });
  mockUid = 'other'; mockSports.entries = []; mockSports.ready = false; await act(async () => tree.update(<ActivityEditorScreen />));
  expect(tree.root.findAllByType(SportActivityForm)).toHaveLength(0);
  await act(async () => { done(); await pending!; }); expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('creates a separate actual record, supports safe cancel and never creates data on mount', async () => {
  mockParams = { mode: 'RECORD' }; mockRouter.canGoBack.mockReturnValue(false);
  let tree: any; await act(async () => { tree = create(<ActivityEditorScreen />); });
  const form = tree.root.findByType(SportActivityForm); expect(form.props.activity).toBeNull(); expect(form.props.mode).toBe('RECORD');
  expect(mockSports.save).not.toHaveBeenCalled(); await act(async () => form.props.onCancel());
  expect(mockRouter.replace).toHaveBeenCalledWith('/activities');
  await act(async () => form.props.onSave({ ...draft, mode: 'RECORD' }));
  expect(mockSports.save).toHaveBeenCalledWith('new', null, expect.objectContaining({ mode: 'RECORD' }));
  await act(async () => tree.unmount());
});

it('uses a safe back destination while loading and exposes retry rather than a blank editable record', async () => {
  mockSports.ready = false; mockRouter.canGoBack.mockReturnValue(false);
  let tree: any; await act(async () => { tree = create(<ActivityScreen />); });
  await act(async () => press(tree, 'generate.back')); expect(mockRouter.replace).toHaveBeenCalledWith('/activities');
  mockSports.ready = true; mockSports.error = true; mockSports.entries = [];
  await act(async () => tree.update(<ActivityScreen />));
  await act(async () => press(tree, 'home.retry')); expect(mockSports.reload).toHaveBeenCalledTimes(1);
  expect(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'sportActivities.edit')).toHaveLength(0);
  await act(async () => tree.unmount());
});

it.each([ActivitiesScreen, SportActivitiesHome])('opens punctual planning and recording from each activity entry point', async (Screen) => {
  let tree: any; await act(async () => { tree = create(<Screen />); });
  await act(async () => press(tree, 'sportActivities.plan'));
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/activity-editor', params: { mode: 'PLAN' } });
  await act(async () => press(tree, 'sportActivities.record'));
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/activity-editor', params: { mode: 'RECORD' } });
  expect(mockSports.save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
