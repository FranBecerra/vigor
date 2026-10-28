import React from 'react';
import { SetType } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetRow } from '../SetRow';
import { WorkoutExerciseStrip } from '../WorkoutExerciseStrip';
import { SetEntrySheet } from '../SetEntrySheet';
import { ExercisePage } from '../ExercisePage';
import { ExerciseActionsBar } from '../ExerciseActionsBar';
import { TrophyIcon } from '@/components/icons/ActionIcons';
const { create, act } = require('react-test-renderer');
it('keeps the shared action bar bound to the current exercise and only marks visible nonempty notes', async () => {
  const action = jest.fn(); let tree: any;
  const props = { sets: [], scale: 'RIR' as const, width: 320, bottomInset: 0, onUpdateSet: jest.fn(), onAddSet: jest.fn(), onPressSetType: jest.fn(), onAction: action };
  await act(async () => { tree = create(<ExercisePage {...props} exercise={EXERCISE_CATALOGUE[0]} note="A note" />); });
  expect(tree.root.findByType(ExerciseActionsBar).props.hasNote).toBe(true);
  await act(async () => tree.update(<ExercisePage {...props} exercise={EXERCISE_CATALOGUE[1]} note="Legacy hidden note" scopedNotes={[]} />));
  expect(tree.root.findByType(ExerciseActionsBar).props.hasNote).toBe(false);
  for (const id of ['swap', 'info', 'note']) {
    await act(async () => tree.root.findByType(ExerciseActionsBar).props.onAction(id));
    expect(action).toHaveBeenLastCalledWith(EXERCISE_CATALOGUE[1].id, id);
  }
  await act(async () => tree.update(<ExercisePage {...props} exercise={EXERCISE_CATALOGUE[1]} scopedNotes={[{ scope: 'EXERCISE', text: '   ' }]} />));
  expect(tree.root.findByType(ExerciseActionsBar).props.hasNote).toBe(false);
  await act(async () => tree.update(<ExercisePage {...props} exercise={EXERCISE_CATALOGUE[1]} scopedNotes={[{ scope: 'MESOCYCLE', text: 'Program note' }]} />));
  expect(tree.root.findByType(ExerciseActionsBar).props.hasNote).toBe(true);
  await act(async () => tree.unmount());
});
it('does not present the schema warmup effort placeholder as a prescribed RIR', async () => {
  let tree: any;
  const sets = [{ id: 'warmup', setType: SetType.WARMUP, targetWeight: 40, targetReps: 8, targetRIR: 4, isAutoFilled: false, isCompleted: false }];
  await act(async () => { tree = create(<ExercisePage exercise={EXERCISE_CATALOGUE[0]} sets={sets} scale="RIR" width={390} bottomInset={0}
    onUpdateSet={jest.fn()} onAddSet={jest.fn()} onPressSetType={jest.fn()} />); });
  expect(tree.root.findAll((node: any) => node.props.data?.id === 'warmup')[0].props.data.intensity).toBeNull();
  await act(async () => tree.update(<ExercisePage exercise={EXERCISE_CATALOGUE[0]} sets={[{ ...sets[0], actualRIR: 3 }]} scale="RIR" width={390} bottomInset={0}
    onUpdateSet={jest.fn()} onAddSet={jest.fn()} onPressSetType={jest.fn()} />));
  expect(tree.root.findAll((node: any) => node.props.data?.id === 'warmup')[0].props.data.intensity).toBe(3);
  await act(async () => tree.unmount());
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-gesture-handler', () => {
  const chain = () => { const item: any = {}; for (const method of ['enabled', 'activeOffsetX', 'failOffsetY', 'activateAfterLongPress', 'minDuration', 'maxDistance', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) item[method] = () => item; return item; };
  return { Gesture: { Pan: chain, LongPress: chain, Simultaneous: (...items: unknown[]) => items }, GestureDetector: ({ children }: any) => children };
});
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: require('react-native').View, createAnimatedComponent: (component: unknown) => component },
  useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: (style: () => unknown) => style(),
  withTiming: (value: unknown) => value, interpolateColor: () => 'transparent',
  FadeIn: { duration: () => ({}) }, FadeOut: { duration: () => ({}) }, LinearTransition: { duration: () => ({}) }, runOnJS: (fn: unknown) => fn,
}));

it('exposes visible set deletion and one shared editor from all three value cells', async () => {
  const remove = jest.fn(); let tree: any;
  await act(async () => { tree = create(<SetRow data={{ id: 'one', personalRecord: true, setType: SetType.NORMAL, weight: 20, reps: 10, intensity: 2,
    isCompleted: true, weightIsPlanned: false, repsIsPlanned: false }} scale="RIR" onPressSetType={jest.fn()} onToggleDone={jest.fn()}
    onChangeWeight={jest.fn()} onChangeReps={jest.fn()} onChangeIntensity={jest.fn()} onChangeExtensions={jest.fn()} onRemove={remove} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  expect(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'PR').length).toBeGreaterThan(0);
  const trophy = tree.root.findByType(TrophyIcon);
  expect(trophy.props.size).toBe(18);
  let ancestor = trophy.parent;
  while (ancestor && require('react-native').StyleSheet.flatten(ancestor.props.style)?.width !== 22) ancestor = ancestor.parent;
  const checkboxStyle = require('react-native').StyleSheet.flatten(ancestor?.props.style);
  expect(checkboxStyle).toMatchObject({ width: 22, height: 22 });
  await act(async () => button('workout.removeSet').props.onPress()); expect(remove).toHaveBeenCalledTimes(1);
  for (const [label, field] of [['KG', 'weight'], ['train.reps', 'reps'], ['RIR', 'intensity']]) {
    await act(async () => button(label).props.onPress());
    expect(tree.root.findByType(SetEntrySheet).props.initialField).toBe(field);
    await act(async () => tree.root.findByType(SetEntrySheet).props.onClose());
  }
  await act(async () => tree.unmount());
});

it('removes drag-grip dots while keeping exercise selection and addition accessible', async () => {
  const select = jest.fn(); const add = jest.fn(); const menu = jest.fn(); let tree: any;
  const exercises = EXERCISE_CATALOGUE.slice(0, 4);
  await act(async () => { tree = create(<WorkoutExerciseStrip exercises={exercises} activeId={exercises[0].id} onSelect={select} onAdd={add} onReorder={jest.fn()} onExerciseMenu={menu} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  expect(JSON.stringify(tree.toJSON())).not.toContain('⠿');
  await act(async () => button(exercises[3].name).props.onPress()); expect(select).toHaveBeenCalledWith(3);
  await act(async () => button('train.addExercise').props.onPress()); expect(add).toHaveBeenCalled();
  await act(async () => button(exercises[0].name).props.onAccessibilityAction({ nativeEvent: { actionName: 'showMenu' } }));
  expect(menu).toHaveBeenCalledWith(exercises[0].id, undefined);
  await act(async () => tree.unmount());
});
