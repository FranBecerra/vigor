import React from 'react';
import { RoutineSessionSelector } from '../RoutineSessionSelector';
const { create, act } = require('react-test-renderer');
let mockEnd: (event: { translationX: number }) => void;
const mockVerticalFail = jest.fn();
jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: any) => children,
  Gesture: { Pan: () => {
    const gesture: any = {}; ['enabled', 'activeOffsetX', 'runOnJS'].forEach(key => { gesture[key] = () => gesture; });
    gesture.failOffsetY = (...args: unknown[]) => { mockVerticalFail(...args); return gesture; };
    gesture.onEnd = (end: typeof mockEnd) => { mockEnd = end; return gesture; }; return gesture;
  } } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const sessions = [{ plannedSessionIndex: 2, name: 'Upper' }, { plannedSessionIndex: 7, name: 'Lower' }];
it('switches the exact session and microcycle with arrows or a deliberate horizontal swipe', async () => {
  const select = jest.fn(); let tree: any;
  await act(async () => { tree = create(<RoutineSessionSelector cycle={1} cycles={4} sessions={sessions} selected={2} disabled={false} onSelect={select} />); });
  const buttons = tree.root.findAll((node: any) => typeof node.props.onPress === 'function');
  await act(async () => buttons.find((node: any) => node.props.accessibilityLabel === 'Lower').props.onPress()); expect(select).toHaveBeenLastCalledWith(1, 7);
  await act(async () => mockEnd({ translationX: -90 })); expect(select).toHaveBeenLastCalledWith(2, 2);
  await act(async () => mockEnd({ translationX: 90 })); expect(select).toHaveBeenLastCalledWith(0, 2);
  select.mockClear(); await act(async () => mockEnd({ translationX: -30 })); expect(select).not.toHaveBeenCalled();
  expect(mockVerticalFail).toHaveBeenCalledWith([-12, 12]); await act(async () => tree.unmount());
});
it.each([{ cycle: 0, dx: 100, disabled: false }, { cycle: 9, dx: -100, disabled: false }, { cycle: 4, dx: -100, disabled: true }])('does not leave cycle bounds or switch during a save: %j', async ({ cycle, dx, disabled }) => {
  const select = jest.fn(); let tree: any;
  await act(async () => { tree = create(<RoutineSessionSelector cycle={cycle} cycles={10} sessions={sessions} selected={7} disabled={disabled} onSelect={select} />); });
  await act(async () => mockEnd({ translationX: dx })); expect(select).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
