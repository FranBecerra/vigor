import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { ROUTINE_ICONS, ROUTINE_ICON_ORDER } from '../RoutineIcons';
import { ROUTINE_SYMBOL_PATHS } from '../RoutineSymbolIcons';
import { ROUTINE_ICON_KEYS } from '@/models/routine';
import { ROUTINE_EMOJI } from '../routineEmoji';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import fr from '@/i18n/locales/fr.json';
import ja from '@/i18n/locales/ja.json';
const { create, act } = require('react-test-renderer');
it('keeps the selectable emoji catalogue and legacy SVG family distinct with translated accessible names', () => {
  expect(ROUTINE_ICON_ORDER).toHaveLength(24);
  expect(new Set(ROUTINE_ICON_ORDER).size).toBe(24);
  expect(ROUTINE_ICON_ORDER).not.toContain('bodyweight');
  expect(Object.keys(ROUTINE_EMOJI).sort()).toEqual([...ROUTINE_ICON_KEYS].sort());
  expect(new Set(ROUTINE_ICON_ORDER.map(icon => ROUTINE_EMOJI[icon])).size).toBe(24);
  expect(Object.keys(ROUTINE_ICONS).every(icon => ROUTINE_ICON_KEYS.includes(icon as any))).toBe(true);
  expect(new Set(Object.values(ROUTINE_SYMBOL_PATHS)).size).toBe(17);
  for (const dictionary of [en, es, fr, ja]) for (const icon of ROUTINE_ICON_KEYS) {
    expect((dictionary.routineIdentity.icons as Record<string, string>)[icon]?.length).toBeGreaterThan(0);
  }
});
it.each(Object.keys(ROUTINE_SYMBOL_PATHS))('renders %s as a scalable monochrome vector with inherited stroke', async key => {
  const Icon = ROUTINE_ICONS[key as keyof typeof ROUTINE_SYMBOL_PATHS]; let tree: any;
  for (const size of [16, 24, 32]) {
    await act(async () => {
      const element = <Icon size={size} color="#315D5A" />;
      if (!tree) tree = create(element); else tree.update(element);
    });
    expect(tree.root.findByType(Svg).props).toMatchObject({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' });
    const paths = tree.root.findAllByType(Path);
    expect(paths[0].props).toMatchObject({ stroke: '#315D5A', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' });
    for (const path of paths) expect(path.props.d).not.toMatch(/NaN|Infinity|undefined/);
    expect(paths[1].props).toMatchObject({ fill: '#315D5A', fillOpacity: .12 });
    if (key !== 'constellation') expect(paths[2].props).toMatchObject({ stroke: '#315D5A', strokeOpacity: .55, strokeWidth: 1.6 * .72 });
  }
  await act(async () => tree.update(<Icon />));
  expect(tree.root.findByType(Svg).props.width).toBe(24);
  expect(tree.root.findAllByType(Path)[0].props.stroke).toBe('#fff');
  await act(async () => tree.unmount());
});
