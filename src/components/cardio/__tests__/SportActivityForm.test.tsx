import React from 'react';
import { TextInput } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { SportActivityForm } from '../SportActivityForm';
import { NumericField } from '@/components/train/NumericField';
import { SessionEffortInput } from '@/components/train/SessionEffortInput';
import { saveSportDraft } from '@/services/cardio/sportActivities';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/train/NumericField', () => ({ NumericField: () => null }));
const now = Date.UTC(2026, 9, 28, 12);
const original = saveSportDraft('padel', 'owner', { sport: 'PADEL', context: 'CLASS', name: 'Tuesday class', notes: 'Original',
  mode: 'PLAN', startAt: now - 7200000, durationMinutes: 60, timeZone: 'Europe/Madrid', effort: null }, now - 86400000);
function press(tree: any, label: string) {
  return tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress();
}
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
afterEach(() => jest.useRealTimers());

it('stages a reservation, date/time and duration without writing or collecting actual effort', async () => {
  const save = jest.fn().mockResolvedValue(undefined), cancel = jest.fn(); let tree: any;
  await act(async () => { tree = create(<SportActivityForm activity={null} mode="PLAN" onSave={save} onCancel={cancel} />); });
  expect(save).not.toHaveBeenCalled(); expect(tree.root.findAllByType(SessionEffortInput)).toHaveLength(0);
  await act(async () => press(tree, 'sportActivities.sports.FOOTBALL'));
  await act(async () => press(tree, 'sportActivities.contexts.MATCH'));
  const inputs = tree.root.findAllByType(TextInput);
  await act(async () => inputs[0].props.onChangeText('Friends'));
  await act(async () => inputs[1].props.onChangeText('Bring boots'));
  await act(async () => tree.root.findByType(NumericField).props.onChangeValue(90));
  const dateButton = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel?.includes('Oct'))[0];
  await act(async () => dateButton.props.onPress());
  expect(tree.root.findByType(DateTimePicker).props.maximumDate).toBeUndefined();
  await act(async () => tree.root.findByType(DateTimePicker).props.onValueChange({}, new Date(now + 172800000)));
  expect(save).not.toHaveBeenCalled();
  await act(async () => press(tree, 'sportActivities.save'));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ mode: 'PLAN', sport: 'FOOTBALL', context: 'MATCH', name: 'Friends',
    notes: 'Bring boots', durationMinutes: 90, startAt: now + 172800000, effort: null }));
  await act(async () => press(tree, 'generate.cancel')); expect(cancel).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('records actual duration/effort independently of an unchanged appointment and can clear the answer', async () => {
  const save = jest.fn().mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<SportActivityForm activity={original} mode="RECORD" onSave={save} onCancel={jest.fn()} />); });
  expect(tree.root.findByType(SessionEffortInput).props.value).toBeNull();
  await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(7));
  await act(async () => tree.root.findByType(NumericField).props.onChangeValue(75));
  await act(async () => press(tree, 'sportActivities.save'));
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ effort: 7, durationMinutes: 75, mode: 'RECORD' }));
  expect(original.planned!.durationMinutes).toBe(60);
  await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(null));
  await act(async () => press(tree, 'sportActivities.save'));
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ effort: null }));
  await act(async () => tree.unmount());
});

it('keeps the draft after a failed save, reports invalid data and blocks duplicate pending saves', async () => {
  let reject!: (cause: Error) => void;
  const save = jest.fn().mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }))
    .mockRejectedValueOnce(Error('invalidSportActivity')).mockResolvedValue(undefined);
  let tree: any;
  await act(async () => { tree = create(<SportActivityForm activity={original} mode="PLAN" onSave={save} onCancel={jest.fn()} />); });
  await act(async () => tree.root.findAllByType(TextInput)[0].props.onChangeText('Keep this draft'));
  let pending: Promise<void>;
  await act(async () => { pending = press(tree, 'sportActivities.save'); });
  expect(tree.root.findByType(NumericField).props.editable).toBe(false);
  await act(async () => press(tree, 'sportActivities.save'));
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { reject(Error('offline')); await pending!; });
  expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('Keep this draft');
  expect(tree.root.findAll((node: any) => node.props.accessibilityRole === 'alert')[0].props.children).toBe('sportActivities.saveFailed');
  await act(async () => tree.root.findByType(NumericField).props.onChangeValue(undefined));
  await act(async () => press(tree, 'sportActivities.save'));
  expect(save.mock.calls[1][0].durationMinutes).toBeNaN();
  expect(tree.root.findAll((node: any) => node.props.accessibilityRole === 'alert')[0].props.children).toBe('sportActivities.invalid');
  await act(async () => tree.root.findByType(NumericField).props.onChangeValue(50));
  await act(async () => press(tree, 'sportActivities.save'));
  expect(save).toHaveBeenCalledTimes(3);
  expect(tree.root.findAll((node: any) => node.props.accessibilityRole === 'alert')).toHaveLength(0);
  await act(async () => tree.unmount());
});

it('shows a required name for Other without losing the typed name when switching sport', async () => {
  let tree: any;
  await act(async () => { tree = create(<SportActivityForm activity={null} mode="RECORD" onSave={jest.fn()} onCancel={jest.fn()} />); });
  await act(async () => press(tree, 'sportActivities.sports.OTHER'));
  expect(tree.root.findAllByType(TextInput)[0].props.accessibilityLabel).toBe('sportActivitiesRequiredName');
  await act(async () => tree.root.findAllByType(TextInput)[0].props.onChangeText('Climbing'));
  await act(async () => press(tree, 'sportActivities.sports.PADEL'));
  expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('Climbing');
  await act(async () => tree.unmount());
});
