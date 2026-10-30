import React from 'react';
import { Text } from 'react-native';
import Svg from 'react-native-svg';
import { RoutineBadgeIcon } from '../RoutineBadgeIcon';
import { ROUTINE_ICON_KEYS } from '@/models/routine';
import { ROUTINE_EMOJI, routineEmoji } from '../routineEmoji';
const { create, act } = require('react-test-renderer');
it.each(ROUTINE_ICON_KEYS)('renders the saved %s identity as decorative native text, never an image or vector', async icon => {
  let tree: any;
  await act(async () => { tree = create(<RoutineBadgeIcon icon={icon} />); });
  expect(tree.root.findByType(Text).props).toMatchObject({ children: ROUTINE_EMOJI[icon], accessible: false,
    accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', allowFontScaling: false,
    style: { fontSize: 24, lineHeight: 32, includeFontPadding: false } });
  expect(tree.root.findAllByType(Svg)).toHaveLength(0);
  await act(async () => tree.update(<RoutineBadgeIcon icon={icon} size={28} color="#123456" />));
  expect(tree.root.findByType(Text).props.style).toMatchObject({ fontSize: 28, lineHeight: 36 });
  expect(tree.root.findByType(Text).props.style.color).toBeUndefined();
  await act(async () => tree.unmount());
});
it.each([undefined, null, '', 'unknown', '__proto__', 'constructor', 1, {}])('safely renders an unknown persisted key: %p', icon => {
  expect(routineEmoji(icon)).toBe('🪐');
});
