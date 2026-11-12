import React from 'react';
import { TextInput } from 'react-native';
import { ManualCardioEditor } from '../ManualCardioEditor';
import { Stepper } from '@/components/train/generate/GenerateControls';
const { create, act } = require('react-test-renderer');

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const action = (tree: any, label: string) => tree.root.findAll((node: any) => typeof node.props.onPress === 'function')
  .find((node: any) => node.props.accessibilityLabel === label || node.findAll((child: any) => child.props.children === label).length > 0);
const press = (tree: any, label: string) => act(async () => action(tree, label).props.onPress());
const enter = (tree: any, label: string, value: string) => act(async () =>
  tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label).props.onChangeText(value));

it('keeps a named manual session draft across phases and submits structured goals', async () => {
  const onReview = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ManualCardioEditor onBack={jest.fn()} onCancel={jest.fn()} onReview={onReview} />); });
  await enter(tree, 'generate.name', 'Aerobic practice');
  await press(tree, 'cardioPlan.WARMUP');
  await enter(tree, 'cardioPlan.WARMUP · manualCardio.minutes', '5');
  await press(tree, 'cardioPlan.MAIN');
  await enter(tree, 'cardioPlan.MAIN · manualCardio.distance', '5,5');
  await enter(tree, 'cardioPlan.MAIN · manualCardio.fast', '5:45');
  await enter(tree, 'cardioPlan.MAIN · manualCardio.slow', '6:15');
  await enter(tree, 'cardioPlan.MAIN · manualCardio.zone', '2');
  await act(async () => tree.root.findAllByType(Stepper).find((node: any) => node.props.label === 'manualCardio.day').props.onChange(3));
  await press(tree, 'cardioPlan.review');
  expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ sessions: 1, manualSessions: [{
    modality: 'RUNNING', dayIndex: 2, phases: {
      WARMUP: { durationSeconds: 300 }, MAIN: { distanceMetres: 5500, paceSecondsPerKm: { fast: 345, slow: 375 }, heartRateZone: 2 },
    },
  }] }), 'Aerobic practice');
  await act(async () => tree.unmount());
});

it('validates manual hybrid time without inventing a timed goal for a zone-only phase', async () => {
  const onReview = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ManualCardioEditor name="Hybrid" availability={{
    trainingDays: 4, cycleDays: 7, minutesPerSession: 60, allowDoubles: false,
  }} strength={[{ id: 'strength', dayIndex: 0, estimatedMinutes: 45, lowerBodyDemand: 'HIGH', name: 'Strength' }]}
    onBack={jest.fn()} onCancel={jest.fn()} onReview={onReview} />); });
  await enter(tree, 'cardioPlan.MAIN · manualCardio.zone', '2');
  await press(tree, 'cardioPlan.review');
  expect(onReview).not.toHaveBeenCalled();
  await enter(tree, 'manualCardio.estimate', '30');
  await press(tree, 'cardioPlan.review');
  expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ manualSessions: [
    { modality: 'RUNNING', dayIndex: 1, estimatedMinutes: 30, phases: { MAIN: { heartRateZone: 2 } } },
  ] }), 'Hybrid');
  await act(async () => tree.unmount());
});

it('uses an existing strength day when doubles are allowed and every training day is already allocated', async () => {
  const onReview = jest.fn(); let tree: any;
  const strength = [1, 4].map(dayIndex => ({ id: `lift-${dayIndex}`, name: 'Strength', dayIndex,
    estimatedMinutes: 45, lowerBodyDemand: 'LOW' as const }));
  await act(async () => { tree = create(<ManualCardioEditor name="Hybrid" availability={{
    trainingDays: 2, cycleDays: 7, minutesPerSession: 60, allowDoubles: true,
  }} strength={strength} onBack={jest.fn()} onCancel={jest.fn()} onReview={onReview} />); });
  await enter(tree, 'cardioPlan.MAIN · manualCardio.minutes', '25');
  await press(tree, 'cardioPlan.review');
  expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ manualSessions: [
    { modality: 'RUNNING', dayIndex: 1, phases: { MAIN: { durationSeconds: 1500 } } },
  ] }), 'Hybrid');
  await act(async () => tree.unmount());
});
