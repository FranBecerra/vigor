import { Text } from 'react-native';
import type { RoutineIconKey } from '@/models';
import { routineEmoji } from './routineEmoji';
import type { IconProps } from './types';

/** Decorative native glyph. The parent control supplies its localized accessible name. */
export function RoutineBadgeIcon({ icon, size = 24 }: IconProps & { icon: RoutineIconKey }) {
  return <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    allowFontScaling={false} style={{ fontSize: size, lineHeight: size + 8, textAlign: 'center', includeFontPadding: false }}>
    {routineEmoji(icon)}
  </Text>;
}
