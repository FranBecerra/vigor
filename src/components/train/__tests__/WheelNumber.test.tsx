import React from 'react';
import { FlatList, Modal, Text } from 'react-native';
import { WheelNumber } from '../WheelNumber';
import { SetRow } from '../SetRow';
import { SetEntrySheet } from '../SetEntrySheet';
import { SetType } from '@/models';
import { TrainingUnitsContext } from '@/hooks/TrainingUnitsContext';
import { storedLoad } from '@/services/training/numericWheel';
const { create, act } = require('react-test-renderer');
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
