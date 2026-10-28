import { View } from 'react-native';
import { DumbbellIcon } from '@/components/icons';
import { CheckIcon, MoonIcon } from '@/components/icons/ActionIcons';
import { useTheme } from '@/theme/useTheme';

/** Decorative status only; the existing row owns selection and check semantics. */
export function RoutineDayIndicator({ kind = 'workout', completed = false }: {
  kind?: 'workout' | 'rest'; completed?: boolean;
}) {
  const { colors } = useTheme();
  const Icon = completed ? CheckIcon : kind === 'rest' ? MoonIcon : DumbbellIcon;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    pointerEvents="none" style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10,
      backgroundColor: kind === 'rest' && !completed ? colors.surface : colors.accentTint,
      alignItems: 'center', justifyContent: 'center' }}>
    <Icon size={19} color={kind === 'rest' && !completed ? colors.textSecondary : colors.accentText} />
  </View>;
}
