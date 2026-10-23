import React from 'react';
import { TextInput } from 'react-native';
import { WorkoutHistoryEditor } from '../WorkoutHistoryEditor';
import { NumericField } from '../NumericField';
import { SetType, type WorkoutSession } from '@/models';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
const session: WorkoutSession = { id: 'history', userId: 'owner', performedAt: 1000, completedAt: 5000, mesocycleId: 'm', microcycleId: 'micro', microcycleIndex: 0,
  sessionName: 'Upper', exercises: [{ id: 'entry', exerciseId: 'ex', order: 0, isSwap: false,
    sets: [{ id: 'set', setType: SetType.NORMAL, targetWeight: 20, targetReps: 10, targetRIR: 2, actualWeight: 20, actualReps: 10, isAutoFilled: false }] }] };
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
it('keeps edits private until Save, retains a failed draft and closes only after a successful save', async () => {
  const save = jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor session={session} onSave={save} onClose={close} />); });
  await act(async () => tree.root.findAllByType(TextInput)[0].props.onChangeText('Corrected'));
  await act(async () => tree.root.findAllByType(NumericField)[0].props.onChangeValue(35));
  expect(session.exercises[0].sets[0].actualWeight).toBe(20); expect(save).not.toHaveBeenCalled();
  await act(async () => button(tree, 'custom.save').props.onPress()); expect(close).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('historyEdit.failed');
  await act(async () => button(tree, 'custom.save').props.onPress()); expect(close).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[1][0]).toMatchObject({ sessionName: 'Corrected', exercises: [{ sets: [{ actualWeight: 35 }] }] });
  await act(async () => tree.unmount());
});
it('can remove a set from the draft without writing the original', async () => {
  const save = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor session={session} onSave={save} onClose={jest.fn()} />); });
  await act(async () => button(tree, 'workout.removeSet').props.onPress());
  expect(tree.root.findAllByType(NumericField)).toHaveLength(0); expect(session.exercises[0].sets).toHaveLength(1); expect(save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
