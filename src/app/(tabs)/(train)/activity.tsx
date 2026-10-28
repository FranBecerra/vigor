import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSportActivities } from '@/hooks/useSportActivities';
import { useTheme } from '@/theme/useTheme';
import { sessionEffortValue } from '@/services/training/sessionFeedback';
import { sportActivityStart, sportActivityMinutes } from '@/services/cardio/sportActivities';

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const { t, i18n } = useTranslation(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors, surfaces, radius, spacing, semantic } = useTheme(); const sports = useSportActivities();
  const item = sports.entries.find((entry) => entry.id === id); const [error, setError] = useState(false), [busy, setBusy] = useState(false);
  const discarding = useRef(false);
  const button = (label: string, action: () => void, danger = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={action}
    style={{ minHeight: 48, justifyContent: 'center', marginTop: 10 }}><Text style={{ color: danger ? semantic.danger : colors.accentText, fontSize: 17, fontWeight: '600' }}>{label}</Text></Pressable>;
  const effort = sessionEffortValue(item?.record?.feedback);
  return <ScrollView style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    {button(t('generate.back'), () => router.canGoBack() ? router.back() : router.replace('/activities'))}
    {!sports.ready ? <ActivityIndicator color={colors.accentText} /> : !item ? <Text style={{ color: colors.textPrimary }}>{t('sportActivities.loadFailed')}</Text> : <>
      <Text style={{ color: colors.textPrimary, fontSize: 29, fontWeight: '700', marginVertical: 16 }}>{item.name || t(`sportActivities.sports.${item.sport}`)}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 17 }}>{t(`sportActivities.contexts.${item.context}`)} · {t(`sportActivities.${item.record ? 'recorded' : 'planned'}`)}</Text>
      <View style={{ ...surfaces.card, borderRadius: radius.lg, padding: 20, marginVertical: 20, gap: 14 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 19 }}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeStyle: 'short', timeZone: (item.record ?? item.planned)!.timeZone }).format(sportActivityStart(item))}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700' }}>{t('sportActivities.minutes', { value: sportActivityMinutes(item) })}</Text>
        {effort !== null && <Text style={{ color: colors.accentText, fontSize: 18 }}>{t('sessionEffort.summary', { value: effort })}</Text>}
        {item.record && <Text style={{ color: colors.textMuted }}>{t('sportActivities.manualMetrics')}</Text>}
      </View>
      {item.planned && item.record && <Text style={{ color: colors.textSecondary, marginBottom: 14 }}>{t('sportActivities.originalPlan', { value: item.planned.durationMinutes })}</Text>}
      {!!item.notes && <Text style={{ color: colors.textPrimary, fontSize: 17, marginBottom: 20 }}>{item.notes}</Text>}
      {button(t('sportActivities.edit'), () => router.push({ pathname: '/activity-editor', params: { id: item.id, mode: item.record ? 'RECORD' : 'PLAN' } }))}
      {!item.record && button(t('sportActivities.record'), () => router.push({ pathname: '/activity-editor', params: { id: item.id, mode: 'RECORD' } }))}
      {button(t(`sportActivities.${item.record ? 'discard' : 'cancelPlan'}`), () => Alert.alert(t(`sportActivities.${item.record ? 'discard' : 'cancelPlan'}`), t('sportActivities.confirmDiscard'), [
        { text: t('generate.cancel'), style: 'cancel' }, { text: t('sportActivities.confirm'), style: 'destructive', onPress: async () => {
          if (discarding.current) return;
          discarding.current = true; setBusy(true); setError(false);
          try { await sports.discard(item); router.dismissTo('/activities'); } catch { setError(true); }
          finally { discarding.current = false; setBusy(false); }
        } },
      ]), true)}
    </>}
    {(error || sports.error) && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('sportActivities.saveFailed')}</Text>}
    {sports.error && button(t('home.retry'), sports.reload)}
  </ScrollView>;
}
