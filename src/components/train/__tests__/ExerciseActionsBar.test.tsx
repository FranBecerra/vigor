import React from 'react';
import { StyleSheet } from 'react-native';
import { ExerciseActionsBar } from '../ExerciseActionsBar';
import { InfoIcon, NoteIcon, SwapIcon } from '@/components/icons/ActionIcons';
import { palette } from '@/theme/tokens';
const { create, act } = require('react-test-renderer');
let mockColors: Record<keyof typeof palette.dark, string> = palette.dark;
let mockAppearance: 'dark' | 'light' = 'dark';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: mockColors, radius: { md: 16 },
  surfaces: require('@/theme/surfaces').surfaces[mockAppearance] }) }));
const actionButtons = (tree: any) => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button'
  && typeof node.props.onPress === 'function' && typeof node.props.style === 'function');

it.each(['dark', 'light'] as const)('uses a shared themed surface with equal labelled SVG actions in %s mode', async (appearance) => {
  mockAppearance = appearance; mockColors = palette[appearance]; const onAction = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ExerciseActionsBar hasNote={false} onAction={onAction} />); });
  const bar = tree.root.findByProps({ testID: 'exercise-actions-bar' });
  expect(StyleSheet.flatten(bar.props.style).backgroundColor).toBe(palette[appearance].bgElevated);
  const buttons = actionButtons(tree);
  expect(buttons).toHaveLength(3);
  for (const [index, action] of ['swap', 'info', 'note'].entries()) {
    const button = buttons[index];
    expect(button.props.accessibilityLabel).toBe(`train.${action}`);
    expect(StyleSheet.flatten(button.parent.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    expect(StyleSheet.flatten(button.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(44);
    expect(button.findAll((node: any) => node.props.children === `train.${action}`).length).toBeGreaterThan(0);
    await act(async () => button.props.onPress());
    expect(onAction).toHaveBeenLastCalledWith(action);
  }
  for (const Icon of [SwapIcon, InfoIcon, NoteIcon]) expect(tree.root.findByType(Icon).props).toMatchObject({ size: 23, color: palette[appearance].textSecondary });
  expect(tree.root.findAllByProps({ testID: 'exercise-note-indicator' })).toHaveLength(0);
  await act(async () => tree.update(<ExerciseActionsBar hasNote onAction={onAction} />));
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'exercise-note-indicator' }).props.style).backgroundColor).toBe(palette[appearance].accentText);
  await act(async () => tree.unmount());
});
it('disables all actions without a handler rather than exposing active no-op buttons', async () => {
  let tree: any; await act(async () => { tree = create(<ExerciseActionsBar hasNote={false} />); });
  const buttons = actionButtons(tree); expect(buttons).toHaveLength(3);
  for (const button of buttons) {
    expect(button.props.disabled).toBe(true); expect(button.props.accessibilityState).toEqual({ disabled: true });
  }
  await act(async () => tree.unmount());
});
