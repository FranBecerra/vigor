import React from 'react';
import { Text } from 'react-native';
import { SwipeableSet } from '../SwipeableSet';
import { WorkoutPagerGestureContext } from '../WorkoutPagerGesture';
const { create, act } = require('react-test-renderer');
let mockGesture: any;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: any) => children, Gesture: { Pan: () => {
  const chain: any = { callbacks: {} };
  for (const method of ['enabled', 'activeOffsetX', 'failOffsetY', 'blocksExternalGesture']) chain[method] = (value: unknown) => { chain[method + 'Value'] = value; return chain; };
  for (const method of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) chain[method] = (callback: unknown) => { chain.callbacks[method] = callback; return chain; };
  mockGesture = chain; return chain;
} } }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: require('react-native').View },
  useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: (style: () => unknown) => style(), withTiming: (value: unknown) => value,
  FadeOut: { duration: () => ({}) }, LinearTransition: { duration: () => ({}) }, runOnJS: (fn: unknown) => fn }));
it('closes a reversed reveal, removes on a full left swipe and never deletes twice', async () => {
  let tree: any; const remove = jest.fn();
  await act(async () => { tree = create(<SwipeableSet onRemove={remove}><Text>Set</Text></SwipeableSet>); });
  const callbacks = mockGesture.callbacks;
  expect(mockGesture.activeOffsetXValue).toEqual([-10, 10]); expect(mockGesture.failOffsetYValue).toEqual([-12, 12]);
  callbacks.onStart(); callbacks.onUpdate({ translationX: -80 }); callbacks.onEnd(); expect(remove).not.toHaveBeenCalled();
  callbacks.onStart(); callbacks.onUpdate({ translationX: 100 }); callbacks.onEnd(); expect(remove).not.toHaveBeenCalled();
  callbacks.onStart(); callbacks.onUpdate({ translationX: -180 }); callbacks.onEnd(); expect(remove).toHaveBeenCalledTimes(1);
  callbacks.onEnd(); expect(remove).toHaveBeenCalledTimes(1);
  const trash = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'workout.removeSet' && typeof node.props.onPress === 'function')[0];
  await act(async () => trash.props.onPress()); expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('makes the enclosing workout pager wait for a set swipe, while preserving vertical scrolling', async () => {
  const pager = {} as any; let tree: any;
  await act(async () => { tree = create(<WorkoutPagerGestureContext.Provider value={pager}><SwipeableSet onRemove={jest.fn()}><Text>Set</Text></SwipeableSet></WorkoutPagerGestureContext.Provider>); });
  expect(mockGesture.blocksExternalGestureValue).toBe(pager);
  expect(mockGesture.failOffsetYValue).toEqual([-12, 12]);
  await act(async () => tree.unmount());
});
it('does not enable a destructive gesture without a removal handler', async () => {
  let tree: any;
  await act(async () => { tree = create(<SwipeableSet><Text>Read only</Text></SwipeableSet>); });
  expect(mockGesture.enabledValue).toBe(false);
  expect(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'workout.removeSet')).toHaveLength(0);
  mockGesture.callbacks.onFinalize({}, false);
  await act(async () => tree.unmount());
});
it('closes a failed asynchronous removal and permits a real retry', async () => {
  let tree: any; const remove = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await act(async () => { tree = create(<SwipeableSet onRemove={remove}><Text>Rest</Text></SwipeableSet>); });
  const trash = () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'workout.removeSet' && typeof node.props.onPress === 'function')[0];
  await act(async () => trash().props.onPress()); await act(async () => trash().props.onPress());
  expect(remove).toHaveBeenCalledTimes(2); await act(async () => tree.unmount());
});
