import React from 'react';
import { StyleSheet } from 'react-native';
import { BRAND_LIME, palette, typography } from '../tokens';
import { createSurfaceStyles, surfaces } from '../surfaces';
import { useTheme } from '../useTheme';
import { TodayCard } from '@/components/home/TodayCard';
import { RoutineIconKey } from '@/components/icons';
const { create, act } = require('react-test-renderer');
const processBackgroundImage = require('react-native/Libraries/StyleSheet/processBackgroundImage').default;

function luminance(hex: string) {
  const channels = hex.match(/[a-f0-9]{2}/gi)!.map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

it.each(['dark', 'light'] as const)('keeps Subtle text readable across its %s surfaces', (scheme) => {
  const c = palette[scheme];
  for (const background of [c.bg, c.bgElevated, c.surface]) {
    for (const text of [c.textPrimary, c.textSecondary, c.textMuted, c.accentText]) {
      expect({ text, background, contrast: contrast(text, background) }.contrast).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast(c.accentText, c.accentTint)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(c.bioText, c.bioTint)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(c.onAccent, BRAND_LIME)).toBeGreaterThanOrEqual(7);
  expect(contrast(c.controlBorder, c.surface)).toBeGreaterThanOrEqual(3);
});

it.each(['dark', 'light'] as const)('parses every native %s gradient and keeps decoration geometry-neutral', (scheme) => {
  const kinds = surfaces[scheme];
  for (const style of Object.values(kinds)) {
    const flat = StyleSheet.flatten(style);
    if ('experimental_backgroundImage' in flat) {
      const parsed = processBackgroundImage(flat.experimental_backgroundImage);
      expect(parsed.length).toBeGreaterThan(0);
    }
    for (const property of ['padding', 'height', 'width', 'margin', 'position', 'zIndex', 'opacity']) expect(flat).not.toHaveProperty(property);
  }
  expect(kinds.screen.backgroundColor).toBe(palette[scheme].bg);
  expect(kinds.card.backgroundColor).toBe(kinds.hero.backgroundColor);
  expect(kinds.sheet.backgroundColor).toBe(palette[scheme].bgElevated);
  expect(kinds.primary.backgroundColor).toBe(BRAND_LIME);
  expect(kinds.field).not.toHaveProperty('experimental_backgroundImage');
  expect(kinds.field.boxShadow).toMatch(/^inset/);
  expect(typography.emphasis.fontWeight).toBe('800');
});

it('provides the equivalent gradient property for web without adding a dependency', () => {
  const light = createSurfaceStyles('light', 'web'), dark = createSurfaceStyles('dark', 'web');
  expect((light.screen as any).backgroundImage).toContain('radial-gradient');
  expect((dark.card as any).backgroundImage).toContain('linear-gradient');
  expect(light.screen.experimental_backgroundImage).toBeUndefined();
});

it('returns stable shared surface references across updates', async () => {
  const observed: unknown[] = [];
  function Probe() { const theme = useTheme(); observed.push(theme.surfaces); return null; }
  let tree: any;
  await act(async () => { tree = create(<Probe />); });
  await act(async () => { tree.update(<Probe />); });
  expect(observed[0]).toBe(observed[1]);
  await act(async () => tree.unmount());
});

it('retains separate preview/start actions and real metrics in the Subtle hero', async () => {
  const preview = jest.fn(), start = jest.fn(); let tree: any;
  await act(async () => { tree = create(<TodayCard session={{ name: 'Pull', exercises: [] } as any}
    routineName="My routine" routineIcon={'dumbbell' as RoutineIconKey} routineColor={BRAND_LIME}
    muscleLabel={(muscle) => muscle} labels={{ start: 'Start', preview: 'Preview', exercises: 'exercises', sets: 'sets' }}
    onPressPreview={preview} onPressStart={start} />); });
  const buttons = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
  const startButton = buttons.find((node: any) => node.props.accessibilityLabel === 'Start');
  expect(StyleSheet.flatten(startButton.props.style).minHeight).toBeGreaterThanOrEqual(44);
  await act(async () => startButton.props.onPress());
  expect(start).toHaveBeenCalledTimes(1); expect(preview).not.toHaveBeenCalled();
  await act(async () => buttons.find((node: any) => node.props.accessibilityLabel === 'Preview').props.onPress());
  expect(preview).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
