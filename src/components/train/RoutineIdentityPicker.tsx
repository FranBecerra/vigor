import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROUTINE_ICON_ORDER, type RoutineIconKey } from '@/components/icons';
import { RoutineBadgeIcon } from '@/components/icons/RoutineBadgeIcon';
import { useTheme } from '@/theme/useTheme';

export interface RoutineIdentity { icon: RoutineIconKey; color: string }
/** Only the icon is editable. Keep the legacy color field opaque for existing callers. */
export function RoutineIdentityPicker({ value, onChange, disabled = false }: {
  value: RoutineIdentity; onChange(value: RoutineIdentity): void; disabled?: boolean;
}) {
  const { t } = useTranslation(), { colors, typography, radius, spacing } = useTheme();
  const columns = useWindowDimensions().width >= 376 ? 6 : 4;
  return <View style={{ gap: spacing.md, marginVertical: spacing.lg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View testID="routine-identity-preview" accessible={false} style={{ width: 52, height: 52, backgroundColor: colors.accentTint, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
        <RoutineBadgeIcon icon={value.icon} size={28} />
      </View>
      <Text style={[typography.title, { color: colors.textPrimary }]}>{t('routineIdentity.title')}</Text>
    </View>
    <View accessibilityRole="radiogroup" accessibilityLabel={t('routineIdentity.icon')} style={{ width: columns * 48 + (columns - 1) * 8, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
      {ROUTINE_ICON_ORDER.map(icon => {
        const selected = value.icon === icon;
        return <Pressable key={icon} accessibilityRole="radio" accessibilityLabel={t(`routineIdentity.icons.${icon}`)}
          accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onChange({ ...value, icon })}
          style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: selected ? colors.accentTint : colors.surface,
            alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: selected ? colors.accentText : 'transparent' }}>
          <RoutineBadgeIcon icon={icon} size={26} />
        </Pressable>;
      })}
    </View>
  </View>;
}
