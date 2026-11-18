import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { useCardioPlans } from '@/hooks/useCardioPlans';
import { RoutineActionsSheet } from '@/components/train/RoutineActionsSheet';

export function SavedCardioPlans() {
  const plans = useCardioPlans(); const router = useRouter(); const { t } = useTranslation(); const { colors, surfaces, radius } = useTheme();
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = plans.entries.find(plan => plan.id === targetId);
  const open = (id: string, edit = false) => router.push({ pathname: '/cardio-cycle', params: { id, ...(edit ? { edit: '1' } : {}) } });
  return <View style={{ gap: 10 }}>
    {!!plans.entries.length && <Text accessibilityRole="header" style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>{t('cardioSaved.title')}</Text>}
    {plans.entries.map(plan => <View key={plan.id} style={{ ...surfaces.card, borderRadius: radius.lg, padding: 18, minHeight: 90, flexDirection: 'row' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cardioSaved.open', { name: plan.name })} onPress={() => open(plan.id)}
        style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>{plan.name} ›</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t('cardioSaved.card', { days: plan.input.cycleDays, sessions: plan.preview.scheduled.length, minutes: plan.preview.usedMinutes })}</Text>
        <Text style={{ color: colors.bioText, fontSize: 13 }}>{t('cardioSaved.proposal')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('trainingAgenda.manage', { name: plan.name })}
        onPress={() => setTargetId(plan.id)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontWeight: '700' }}>···</Text>
      </Pressable>
    </View>)}
    <RoutineActionsSheet onClose={() => setTargetId(null)} target={target ? {
      name: target.name, active: false, activate: () => open(target.id), edit: () => open(target.id, true), removeDisabled: plans.error,
      remove: () => Alert.alert(t('home.removeTitle', { name: target.name }), t('cardioSaved.confirmArchive'), [
        { text: t('generate.cancel'), style: 'cancel' },
        { text: t('home.removeRoutine'), style: 'destructive', onPress: () => {
          void plans.archive(target).catch(() => Alert.alert(t('home.removeFailed')));
        } },
      ]),
    } : null} />
    {plans.pending && <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('cardioSaved.pending')}</Text>}
    {plans.error && <Pressable accessibilityRole="button" accessibilityLabel={t('home.retry')} onPress={plans.reload} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{t('cardioSaved.loadFailed')} · {t('home.retry')}</Text>
    </Pressable>}
  </View>;
}
