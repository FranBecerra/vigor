import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SetRow } from '../SetRow';
import { SetType, type ExerciseRecording } from '@/models';
import { TrainingUnitsContext } from '@/hooks/TrainingUnitsContext';
const { create, act } = require('react-test-renderer');
jest.mock('../SwipeableSet', () => ({ SwipeableSet: ({ children }: any) => children }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const props = { data: { id: 'set', setType: SetType.NORMAL, weight: 75, reps: 11, intensity: 2, isCompleted: false,
  weightIsPlanned: false, repsIsPlanned: false, previous: { weight: 75, reps: 11, intensity: 2 } }, scale: 'RIR' as const,
  onPressSetType: jest.fn(), onToggleDone: jest.fn(), onChangeWeight: jest.fn(), onChangeReps: jest.fn(), onChangeIntensity: jest.fn(), onChangeExtensions: jest.fn() };

it.each([
  [undefined, 'kg', 2, 'RIR', '75 kg × 11 @ RIR 2'],
  [undefined, 'kg', null, 'RIR', '75 kg × 11'],
  [undefined, 'kg', 0, 'RIR', '75 kg × 11 @ RIR 0'],
  [undefined, 'kg', 5, 'RIR', '75 kg × 11 @ RIR +5'],
  [undefined, 'kg', 8, 'RPE', '75 kg × 11 @ RPE 8'],
  [{ measure: 'REPETITIONS', load: 'NONE' }, 'kg', 2, 'RIR', '11 @ RIR 2'],
  [{ measure: 'SECONDS', load: 'NONE' }, 'kg', 2, 'RIR', '11 s'],
  [{ measure: 'SECONDS', load: 'LEVEL' }, 'lb', 2, 'RIR', '75 custom.LEVEL × 11 s'],
] as const)('keeps explicit scale, units and recording semantics in a single accessible line (%j)', async (recording, unit, intensity, scale, label) => {
  let tree: any;
  await act(async () => { tree = create(<TrainingUnitsContext.Provider value={{ unit, increment: 0.25 }}>
    <SetRow {...props} recording={recording as ExerciseRecording} scale={scale} data={{ ...props.data, previous: { ...props.data.previous, intensity } }} />
  </TrainingUnitsContext.Provider>); });
  const text = tree.root.findAllByType(Text).find((node: any) => node.props.accessibilityLabel === label);
  expect(text.props.children).toBe(label); expect(text.props.numberOfLines).toBe(1);
  expect(text.props.adjustsFontSizeToFit).toBe(true); expect(text.props.minimumFontScale).toBe(0.85);
  expect(StyleSheet.flatten(text.props.style).fontSize).toBeGreaterThan(12);
  await act(async () => tree.unmount());
});
it('converts stored kilograms for imperial display and never invents an intensity for missing previous data', async () => {
  let tree: any; await act(async () => { tree = create(<TrainingUnitsContext.Provider value={{ unit: 'lb', increment: 0.25 }}><SetRow {...props} /></TrainingUnitsContext.Provider>); });
  expect(tree.root.findAllByType(Text).some((node: any) => /^165[.,]35 lb × 11 @ RIR 2$/.test(node.props.accessibilityLabel ?? ''))).toBe(true);
  await act(async () => tree.update(<SetRow {...props} data={{ ...props.data, previous: undefined }} />));
  expect(tree.root.findAllByType(Text).some((node: any) => node.props.accessibilityLabel === '—')).toBe(true);
  await act(async () => tree.unmount());
});
