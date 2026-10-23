import React from 'react';
import { TextInput } from 'react-native';
import { WorkoutNotesSheet } from '../WorkoutNotesSheet';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
const values = { SESSION: '', EXERCISE: 'Seat 4', MESOCYCLE: '' };
const action = (tree: any, label: string) => tree.root.findAll((node: any) => typeof node.props.onPress === 'function'
  && (node.props.accessibilityLabel === label || node.findAll((child: any) => child.props.children === label).length))[0];
it('keeps drafts across three tabs and saves all changed scopes explicitly', async () => {
  const save = jest.fn(async () => {}); const close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutNotesSheet open exerciseName="Press" values={values} onSave={save} onClose={close} />); });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Today only'));
  await act(async () => action(tree, 'notes.EXERCISE').props.onPress()); expect(tree.root.findByType(TextInput).props.value).toBe('Seat 4');
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Seat 5'));
  await act(async () => action(tree, 'notes.MESOCYCLE').props.onPress());
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('This block'));
  await act(async () => action(tree, 'notes.SESSION').props.onPress()); expect(tree.root.findByType(TextInput).props.value).toBe('Today only');
  expect(save).not.toHaveBeenCalled(); await act(async () => action(tree, 'custom.save').props.onPress());
  expect(save.mock.calls).toEqual([['SESSION', 'Today only', undefined], ['EXERCISE', 'Seat 5', undefined], ['MESOCYCLE', 'This block', undefined]]);
  expect(close).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
});
it('retains a failed draft for retry and cancel never writes an unsaved draft', async () => {
  const save = jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined); const close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutNotesSheet open exerciseName="Press" values={values} onSave={save} onClose={close} />); });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Retry me'));
  await act(async () => action(tree, 'custom.save').props.onPress()); expect(close).not.toHaveBeenCalled();
  expect(tree.root.findByType(TextInput).props.value).toBe('Retry me'); expect(JSON.stringify(tree.toJSON())).toContain('notes.saveFailed');
  await act(async () => action(tree, 'custom.save').props.onPress()); expect(close).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount()); save.mockClear();
  await act(async () => { tree = create(<WorkoutNotesSheet open exerciseName="Press" values={values} onSave={save} onClose={close} />); });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Do not save'));
  await act(async () => action(tree, 'generate.cancel').props.onPress()); expect(save).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('shows one session field, preserves legacy exercise notes and leaves unavailable shared scopes read-only', async () => {
  const save = jest.fn(async () => {}); let tree: any;
  await act(async () => { tree = create(<WorkoutNotesSheet open exerciseName="Press" values={values} executionNote="Old setup" unavailable onSave={save} onClose={jest.fn()} />); });
  expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).not.toContain('SESSIONHint');
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Today'));
  await act(async () => action(tree, 'custom.save').props.onPress()); expect(save).toHaveBeenCalledWith('SESSION', 'Today', undefined);
  await act(async () => action(tree, 'notes.EXERCISE').props.onPress()); expect(tree.root.findByType(TextInput).props.editable).toBe(false);
  expect(action(tree, 'custom.save').props.disabled).toBe(true); await act(async () => tree.unmount());
});
