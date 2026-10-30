import React from 'react';
import { ACCENTS, ACCENT_KEYS, accentTokens, validAccent } from '../accent';
import { AccentContext } from '../AccentContext';
import { useTheme } from '../useTheme';
import { semantic } from '../tokens';
import { TodayCard } from '@/components/home/TodayCard';
import { StyleSheet } from 'react-native';
const { create, act } = require('react-test-renderer');
function luminance(hex: string) {
  const c = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
it.each(ACCENT_KEYS)('keeps %s text and filled controls readable in both schemes and shares one accent', accent => {
  for (const scheme of ['dark', 'light'] as const) {
    const { colors: c, sectionAccent: a } = accentTokens(scheme, accent);
    for (const bg of [c.bg, c.bgElevated, c.surface, c.accentTint]) expect(contrast(c.accentText, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onAccent, a.train)).toBeGreaterThanOrEqual(4.5);
    expect(a.bio).toBe(a.train); expect(a.profile).toBe(a.train);
    expect(c.bioText).toBe(c.accentText); expect(c.bioTint).toBe(c.accentTint);
  }
});
it('rejects non-palette, inherited and non-string identities', () => {
  for (const value of [null, undefined, 3, '', 'constructor', '__proto__', '#123456', 'LIME']) expect(validAccent(value)).toBe(false);
  ACCENT_KEYS.forEach(value => expect(validAccent(value)).toBe(true));
});
it('updates live without reallocating surfaces on rerender or changing status colours', async () => {
  let theme!: ReturnType<typeof useTheme>;
  function Probe() { theme = useTheme(); return null; }
  let tree: any; await act(async () => { tree = create(<AccentContext.Provider value="sky"><Probe /></AccentContext.Provider>); });
  expect(theme.sectionAccent.train).toBe(ACCENTS.sky.fill); const surfaces = theme.surfaces;
  await act(async () => tree.update(<AccentContext.Provider value="sky"><Probe /></AccentContext.Provider>)); expect(theme.surfaces).toBe(surfaces);
  await act(async () => tree.update(<AccentContext.Provider value="violet"><Probe /></AccentContext.Provider>));
  expect(theme.sectionAccent.bio).toBe(ACCENTS.violet.fill); expect(theme.surfaces.primary.backgroundColor).toBe(ACCENTS.violet.fill);
  expect(theme.semantic.deload).toBe(semantic.deload); expect(theme.semantic.danger).not.toBe(ACCENTS.violet.fill);
  await act(async () => tree.unmount());
});
it('uses the app accent for the start action without overwriting a saved routine identity colour', async () => {
  let tree: any;
  await act(async () => { tree = create(<AccentContext.Provider value="sky"><TodayCard routineColor="#9BE317" routineIcon="dumbbell"
    routineName="Routine" session={{ name: 'Upper', exercises: [] } as any} muscleLabel={v => v}
    labels={{ start: 'Start', preview: 'Preview', exercises: 'exercises', sets: 'sets' }} onPressStart={() => {}} onPressPreview={() => {}} /></AccentContext.Provider>); });
  const start = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'Start' && typeof node.props.onPress === 'function')[0];
  expect(StyleSheet.flatten(start.props.style).backgroundColor).toBe(ACCENTS.sky.fill);
  await act(async () => tree.unmount());
});
