import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';

/** No default answer and no keyboard. The same scale is used in both training domains. */
export function SessionEffortInput({ value, onChange, disabled = false }: {
  value: number | null; onChange: (value: number | null) => void; disabled?: boolean;
}) {
  const { t } = useTranslation(); const { colors, surfaces, radius, typography, sectionAccent } = useTheme();
  return <View style={{ gap: 12, marginTop: 20 }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('sessionEffort.question')}</Text>
    <Text style={{ color: colors.textSecondary }}>{t('sessionEffort.optional')}</Text>
    {[0, 5].map((offset) => <View key={offset} style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length: 5 }, (_, index) => offset + index + 1).map((effort) => <Pressable key={effort}
        accessibilityRole="radio" accessibilityLabel={t('sessionEffort.value', { value: effort })}
        accessibilityState={{ selected: value === effort, disabled }} disabled={disabled} onPress={() => onChange(effort)}
        style={{ ...surfaces.field, flex: 1, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
          backgroundColor: value === effort ? sectionAccent.train : colors.surface }}>
        <Text style={{ color: value === effort ? colors.onAccent : colors.textPrimary, fontSize: 18, fontWeight: '600' }}>{effort}</Text>
      </Pressable>)}
    </View>)}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ flex: 1, color: colors.textSecondary }}>{t('sessionEffort.easy')}</Text>
      <Text style={{ flex: 1, textAlign: 'right', color: colors.textSecondary }}>{t('sessionEffort.hard')}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('sessionEffort.skip')} disabled={disabled} onPress={() => onChange(null)}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.accentText }}>{t('sessionEffort.skip')}</Text>
    </Pressable>
  </View>;
}
