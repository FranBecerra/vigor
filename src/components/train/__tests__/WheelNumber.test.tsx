import React from 'react';
import { FlatList, Modal, Text } from 'react-native';
import { WheelNumber } from '../WheelNumber';
import { SetRow } from '../SetRow';
import { SetEntrySheet } from '../SetEntrySheet';
import { SetType } from '@/models';
import { TrainingUnitsContext } from '@/hooks/TrainingUnitsContext';
import { storedLoad } from '@/services/training/numericWheel';
import { WheelOverlayProvider } from '../WheelOverlay';
const { create, act } = require('react-test-renderer');
const mockGestures: any[] = [];
jest.mock('react-native-gesture-handler', () => {
  const chain = () => {
    const gesture: any = { handlers: {} };
    for (const name of ['enabled', 'activeOffsetX', 'failOffsetY', 'minDuration', 'maxDistance', 'runOnJS', 'blocksExternalGesture']) gesture[name] = () => gesture;
    gesture.activateAfterLongPress = (delay: number) => { gesture.delay = delay; return gesture; };
    for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[name] = (handler: any) => { gesture.handlers[name] = handler; return gesture; };
    mockGestures.push(gesture); return gesture;
  };
  return { GestureDetector: ({ children }: any) => children, Gesture: { Pan: chain, Tap: chain, LongPress: chain, Simultaneous: (...items: any[]) => items } };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

it('keeps tap entry and opens a quarter-step snapping wheel at the held number', async () => {
  const change = jest.fn(), tap = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WheelNumber value={20} step={0.25} maximum={10000} label="KG" onPress={tap} onChange={change}><Text>20</Text></WheelNumber>, {
    createNodeMock: () => ({ measureInWindow: (callback: (...args: number[]) => void) => callback(250, 300, 60, 40) }),
  }); });
  const control = () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'KG' && typeof node.props.onLongPress === 'function')[0];
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  await act(async () => control().props.onPress()); expect(tap).toHaveBeenCalledTimes(1); expect(change).not.toHaveBeenCalled();
  await act(async () => control().props.onLongPress());
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  const list = tree.root.findByType(FlatList); expect(list.props.initialScrollIndex).toBe(50);
  await act(async () => list.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { y: 51 * 44 } } }));
  expect(change).toHaveBeenLastCalledWith(20.25);
  await act(async () => tree.root.findByType(Modal).props.onRequestClose());
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  await act(async () => tree.unmount());
});

it('uses pounds only for presentation and stores canonical kg on wheel, keypad and completion', async () => {
  const weight = jest.fn(), complete = jest.fn(); let tree: any;
  await act(async () => { tree = create(<TrainingUnitsContext.Provider value={{ unit: 'lb', increment: 0.5 }}><SetRow
    data={{ id: 's', setType: SetType.NORMAL, weight: 20, reps: 10, intensity: 2, isCompleted: false, weightIsPlanned: false, repsIsPlanned: false }}
    scale="RIR" onPressSetType={jest.fn()} onToggleDone={jest.fn()} onChangeWeight={weight} onChangeReps={jest.fn()}
    onChangeIntensity={jest.fn()} onChangeExtensions={jest.fn()} onComplete={complete} />
  </TrainingUnitsContext.Provider>); });
  const wheel = tree.root.findAllByType(WheelNumber).find((node: any) => node.props.label === 'LB');
  expect(wheel.props.step).toBe(0.5); expect(wheel.props.value).toBeCloseTo(44.09245, 4);
  await act(async () => wheel.props.onChange(45)); expect(weight).toHaveBeenLastCalledWith(storedLoad(45, 'lb'));
  await act(async () => wheel.props.onPress());
  const sheet = tree.root.findByType(SetEntrySheet);
  await act(async () => sheet.props.onWeight(46)); expect(weight).toHaveBeenLastCalledWith(storedLoad(46, 'lb'));
  await act(async () => sheet.props.onComplete({ weight: 45, reps: 12, intensity: 1 }));
  expect(complete).toHaveBeenCalledWith({ weight: storedLoad(45, 'lb'), reps: 12, intensity: 1 });
  await act(async () => tree.unmount());
});

it('selects and centres a tapped wheel value, ignoring a stale momentum event from the previous position', async () => {
  const change = jest.fn(), scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => {}); let tree: any;
  await act(async () => { tree = create(<WheelNumber value={20} step={.25} maximum={10000} label="KG" onPress={jest.fn()} onChange={change}><Text>20</Text></WheelNumber>); });
  const control = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'KG' && typeof node.props.onLongPress === 'function')[0];
  await act(async () => control.props.onLongPress());
  await act(async () => tree.root.findByType(FlatList).props.renderItem({ item: 20.5, index: 52 }).props.onPress());
  expect(change).toHaveBeenLastCalledWith(20.5); expect(scroll).toHaveBeenLastCalledWith({ offset: 52 * 44, animated: false });
  await act(async () => tree.root.findByType(FlatList).props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { y: 50 * 44 } } }));
  expect(change).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(FlatList).props.renderItem({ item: 20.5, index: 52 }).props.accessibilityState.selected).toBe(true);
  await act(async () => tree.unmount()); scroll.mockRestore();
});

it('keeps the original held finger active through same-window opening and continuously scrubs in whole wheel steps', async () => {
  const change = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WheelOverlayProvider><WheelNumber value={20} step={.25} maximum={10000} label="KG" onPress={jest.fn()} onChange={change}><Text>20</Text></WheelNumber></WheelOverlayProvider>); });
  const gesture = mockGestures.filter(g => g.delay === 300).at(-1);
  await act(async () => gesture.handlers.onStart({ absoluteX: 120, absoluteY: 200 }));
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'numeric-wheel-overlay' }).length).toBeGreaterThan(0);
  await act(async () => gesture.handlers.onUpdate({ translationY: -12 })); expect(change).toHaveBeenLastCalledWith(20.25);
  await act(async () => gesture.handlers.onUpdate({ translationY: -12 })); expect(change).toHaveBeenCalledTimes(1);
  await act(async () => gesture.handlers.onUpdate({ translationY: 24 })); expect(change).toHaveBeenLastCalledWith(19.5);
  const done = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'workout.done' && typeof node.props.onPress === 'function')[0];
  await act(async () => done.props.onPress());
  expect(tree.root.findAllByProps({ testID: 'numeric-wheel-overlay' })).toHaveLength(0);
  await act(async () => tree.unmount());
});
