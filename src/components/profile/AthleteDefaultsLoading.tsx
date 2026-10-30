import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { useAthleteIntakeState } from '@/hooks/AthleteIntakeContext';

/** Never strand a deep-linked generator behind an unresolved local profile. */
export function AthleteDefaultsLoading({ onCancel }: { onCancel: () => void }) {
  const { error, reload } = useAthleteIntakeState(), { t } = useTranslation(), { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const action = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ minHeight: 48, paddingVertical: 12 }}><Text style={{ color: colors.accentText, fontSize: 17 }}>{label}</Text></Pressable>;
  return <View style={{ ...surfaces.screen, flex: 1, padding: 24, paddingTop: insets.top + 20 }}>
    {action(t('generate.cancel'), onCancel)}
    {error ? <>
      <Text accessibilityRole="alert" style={{ color: colors.textSecondary, fontSize: 17 }}>{t('settings.error')}</Text>
      {reload && action(t('settings.retry'), reload)}
    </> : <><Text style={{ color: colors.textSecondary }}>{t('cardioPlan.loading')}</Text><ActivityIndicator color={colors.accentText} /></>}
  </View>;
}
