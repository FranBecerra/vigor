import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { useCardioPlans } from '@/hooks/useCardioPlans';

export function SavedCardioPlans() {
  const plans = useCardioPlans(); const router = useRouter(); const { t } = useTranslation(); const { colors, surfaces, radius } = useTheme();
  return <View style={{ gap: 10 }}>
    {!!plans.entries.length && <Text accessibilityRole="header" style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>{t('cardioSaved.title')}</Text>}
    {plans.entries.map(plan => <Pressable key={plan.id} accessibilityRole="button" accessibilityLabel={t('cardioSaved.open', { name: plan.name })}
      onPress={() => router.push({ pathname: '/cardio-cycle', params: { id: plan.id } })}
      style={{ ...surfaces.card, borderRadius: radius.lg, padding: 18, minHeight: 90, gap: 6 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>{plan.name} ›</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t('cardioSaved.card', { days: plan.input.cycleDays, sessions: plan.preview.scheduled.length, minutes: plan.preview.usedMinutes })}</Text>
      <Text style={{ color: colors.bioText, fontSize: 13 }}>{t('cardioSaved.proposal')}</Text>
    </Pressable>)}
    {plans.pending && <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('cardioSaved.pending')}</Text>}
    {plans.error && <Pressable accessibilityRole="button" accessibilityLabel={t('home.retry')} onPress={plans.reload} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{t('cardioSaved.loadFailed')} · {t('home.retry')}</Text>
    </Pressable>}
  </View>;
}
