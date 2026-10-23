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

it('completes using the latest local values atomically, including partial reps, without a stale target overwrite', async () => {
  const complete = jest.fn(); const close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<SetEntrySheet initialField="reps" weight={20} reps={10} intensity={3} scale="RIR"
    onWeight={jest.fn()} onReps={jest.fn()} onIntensity={jest.fn()} onPartialReps={jest.fn()} onComplete={complete} onClose={close} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  await act(async () => button('8').props.onPress());
  await act(async () => button('RIR 1').props.onPress());
  const partial = button('workout.partialReps');
  await act(async () => partial.props.onPress()); await act(async () => button('3').props.onPress());
  await act(async () => button('workout.completeSet').props.onPress());
  expect(complete).toHaveBeenCalledWith({ weight: 20, reps: 8, intensity: 1, partialReps: 3 }); expect(close).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('opens effort directly with large targets and no unnecessary numeric keypad', async () => {
  let tree: any; await act(async () => { tree = create(<SetEntrySheet initialField="intensity" weight={0} reps={10} scale="RIR"
    onWeight={jest.fn()} onReps={jest.fn()} onIntensity={jest.fn()} onClose={jest.fn()} />); });
  expect(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'workout.eraseDigit')).toHaveLength(0);
  expect(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'RIR 0' && typeof node.props.onPress === 'function')[0].props.style.height).toBe(48);
  await act(async () => tree.unmount());
});
