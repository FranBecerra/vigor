import React from 'react';
import { SetType } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetRow } from '../SetRow';
import { WorkoutExerciseStrip } from '../WorkoutExerciseStrip';
import { SetEntrySheet } from '../SetEntrySheet';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-gesture-handler', () => {
  const chain = () => { const item: any = {}; for (const method of ['activateAfterLongPress', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) item[method] = () => item; return item; };
  return { Gesture: { Pan: chain }, GestureDetector: ({ children }: any) => children };
});
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: require('react-native').View, createAnimatedComponent: (component: unknown) => component },
  useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: (style: () => unknown) => style(),
  withTiming: (value: unknown) => value, interpolateColor: () => 'transparent',
}));

it('exposes visible set deletion and one shared editor from all three value cells', async () => {
  const remove = jest.fn(); let tree: any;
  await act(async () => { tree = create(<SetRow data={{ id: 'one', setType: SetType.NORMAL, weight: 20, reps: 10, intensity: 2,
    isCompleted: false, weightIsPlanned: false, repsIsPlanned: false }} scale="RIR" onPressSetType={jest.fn()} onToggleDone={jest.fn()}
    onChangeWeight={jest.fn()} onChangeReps={jest.fn()} onChangeIntensity={jest.fn()} onChangeExtensions={jest.fn()} onRemove={remove} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  await act(async () => button('workout.removeSet').props.onPress()); expect(remove).toHaveBeenCalledTimes(1);
  for (const [label, field] of [['train.weight', 'weight'], ['train.reps', 'reps'], ['RIR', 'intensity']]) {
    await act(async () => button(label).props.onPress());
    expect(tree.root.findByType(SetEntrySheet).props.initialField).toBe(field);
    await act(async () => tree.root.findByType(SetEntrySheet).props.onClose());
  }
  await act(async () => tree.unmount());
});

it('removes drag-grip dots while keeping exercise selection and addition accessible', async () => {
  const select = jest.fn(); const add = jest.fn(); let tree: any;
  const exercises = EXERCISE_CATALOGUE.slice(0, 4);
  await act(async () => { tree = create(<WorkoutExerciseStrip exercises={exercises} activeId={exercises[0].id} onSelect={select} onAdd={add} onReorder={jest.fn()} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  expect(JSON.stringify(tree.toJSON())).not.toContain('⠿');
  await act(async () => button(exercises[3].name).props.onPress()); expect(select).toHaveBeenCalledWith(3);
  await act(async () => button('train.addExercise').props.onPress()); expect(add).toHaveBeenCalled();
  await act(async () => tree.unmount());
});
