import React from 'react';
import { WorkoutActivity, type WorkoutActivityProps } from '../WorkoutLiveActivity.ios';
import * as UI from '@expo/ui/swift-ui';
import * as modifiers from '@expo/ui/swift-ui/modifiers';
const { create, act } = require('react-test-renderer');
jest.mock('@expo/ui/swift-ui', () => ({ HStack: 'HStack', VStack: 'VStack', Text: 'WidgetText', Image: 'WidgetImage', ProgressView: 'ProgressView', Spacer: 'Spacer' }));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({ font: (value: unknown) => ({ font: value }), foregroundStyle: (value: unknown) => ({ color: value }), frame: (value: unknown) => ({ frame: value }), lineLimit: (value: unknown) => ({ lineLimit: value }), monospacedDigit: () => ({}), padding: (value: unknown) => ({ padding: value }), tint: (value: unknown) => ({ tint: value }) }));
jest.mock('expo-widgets', () => ({ createLiveActivity: () => ({}) }));
const props = { title: 'Lower', nextLabel: 'Next set', doneLabel: 'Done', setLabel: 'Set 1 of 3', restLabel: 'Rest', completed: 11, total: 16,
  nextExercise: 'Long exercise name requiring two lines', nextWeight: '35 kg', nextReps: '10 reps', nextIntensity: 2, restStart: 1000, restEnd: 121000 } as WorkoutActivityProps;
// Expo serializes widget functions. Exercise the same isolated-runtime contract.
const source = WorkoutActivity as unknown as string;
const runtime = require('react/jsx-runtime');
const scope = Object.entries({ ...UI, ...modifiers }).filter(([key]) => key !== 'default' && key !== '__esModule');
const renderActivity = new Function(...scope.map(([key]) => key), '_jsx', '_jsxs', `return (${source});`)(...scope.map(([, value]) => value), runtime.jsx, runtime.jsxs) as typeof WorkoutActivity;
it('supplies a dedicated narrow watch family without the phone banner fixed-width columns', async () => {
  const layout = renderActivity(props, { isLuminanceReduced: false } as never); let tree: any;
  await act(async () => { tree = create(layout.bannerSmall); });
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Set 1 of 3'); expect(json).toContain('11'); expect(json).toContain('16');
  expect(json).not.toContain('"width":86');
  expect(tree.root.findAllByType('WidgetText').filter((node: any) => node.props.timerInterval)).toHaveLength(1);
  expect(tree.root.findAllByType('WidgetText').find((node: any) => node.props.children === props.nextExercise).props.modifiers).toContainEqual({ lineLimit: 2 });
  await act(async () => tree.unmount());
});
it('keeps the completed and no-timer watch states legible with reduced luminance', async () => {
  const layout = renderActivity({ ...props, nextExercise: '', restStart: 0, restEnd: 0 }, { isLuminanceReduced: true } as never); let tree: any;
  await act(async () => { tree = create(layout.bannerSmall); });
  const json = JSON.stringify(tree.toJSON()); expect(json).toContain('Done'); expect(json).toContain('#FFFFFF'); expect(json).not.toContain('35 kg');
  await act(async () => tree.unmount());
});
