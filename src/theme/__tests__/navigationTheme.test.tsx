import React from 'react';
import { navigationThemeFor } from '../navigationTheme';
import { palette } from '../tokens';
import TrainStackLayout from '@/app/(tabs)/(train)/_layout';
import TabsLayout from '@/app/(tabs)/_layout';
const { create, act } = require('react-test-renderer');
let mockScheme: 'dark' | 'light' = 'dark';
jest.mock('expo-router', () => {
  const React = require('react');
  const Stack = (props: any) => React.createElement('Stack', props, props.children);
  Stack.Screen = (props: any) => React.createElement('Screen', props);
  return { Stack, DarkTheme: { dark: true, colors: { background: '#000', card: '#000', notification: 'red' }, fonts: {} },
    DefaultTheme: { dark: false, colors: { background: '#fff', card: '#fff', notification: 'red' }, fonts: {} } };
});
jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const NativeTabs = (props: any) => React.createElement('NativeTabs', props, props.children);
  const Trigger = (props: any) => React.createElement('Trigger', props, props.children);
  Trigger.Label = (props: any) => React.createElement('Label', props, props.children);
  Trigger.Icon = () => null; NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../useTheme', () => ({ useTheme: () => {
  const tokens = require('../tokens');
  return { colors: tokens.palette[mockScheme], sectionAccent: tokens.sectionAccent, scheme: mockScheme };
} }));
it.each(['dark', 'light'] as const)('matches native stack, tab surfaces, safe-area theme and cards in %s mode', async (scheme) => {
  mockScheme = scheme;
  const theme = navigationThemeFor(scheme);
  expect(theme.dark).toBe(scheme === 'dark');
  expect(theme.colors.background).toBe(palette[scheme].bg);
  expect(theme.colors.card).toBe(palette[scheme].bg);
  expect(theme.colors.text).toBe(palette[scheme].textPrimary);
  expect(theme.colors.notification).toBe('red');
  let stack: any, tabs: any;
  await act(async () => { stack = create(<TrainStackLayout />); tabs = create(<TabsLayout />); });
  expect(stack.root.findByType('Stack').props.screenOptions.contentStyle.backgroundColor).toBe(palette[scheme].bg);
  expect(tabs.root.findAllByType('Trigger')).toHaveLength(4);
  tabs.root.findAllByType('Trigger').forEach((node: any) => expect(node.props.contentStyle.backgroundColor).toBe(palette[scheme].bg));
  await act(async () => { stack.unmount(); tabs.unmount(); });
});
