import React from 'react';
import { TextInput } from 'react-native';
import { SetEntrySheet } from '../SetEntrySheet';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

it('edits weight/repetitions/effort in one panel without a native keyboard or changing another field', async () => {
  const weight = jest.fn(); const reps = jest.fn(); const effort = jest.fn(); let tree: any;
  await act(async () => { tree = create(<SetEntrySheet initialField="weight" weight={10} reps={8} intensity={2} scale="RIR"
    onWeight={weight} onReps={reps} onIntensity={effort} onClose={jest.fn()} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await act(async () => button('workout.eraseDigit').props.onLongPress());
  expect(weight).toHaveBeenLastCalledWith(undefined);
  await act(async () => button('3').props.onPress());
  await act(async () => button('5').props.onPress());
  expect(weight).toHaveBeenLastCalledWith(35); expect(reps).not.toHaveBeenCalled();
  await act(async () => button('train.reps').props.onPress());
  await act(async () => button('1').props.onPress());
  await act(async () => button('2').props.onPress());
  expect(reps).toHaveBeenLastCalledWith(12); expect(weight).toHaveBeenLastCalledWith(35);
  await act(async () => button('RIR 0').props.onPress());
  expect(effort).toHaveBeenLastCalledWith(0);
  await act(async () => tree.unmount());
});
