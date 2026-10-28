import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { useBioNight } from '@/hooks/useBioNight';

export function BioNightCard({ night }: { night: ReturnType<typeof useBioNight> }) {
  const { t, i18n } = useTranslation(), router = useRouter();
  const { colors, surfaces, radius, typography } = useTheme();
  const [details, setDetails] = useState(false);
  const latest = night.state === 'READY' ? night.analysis?.latest : undefined;
  const format = (value: number) => value.toLocaleString(i18n.resolvedLanguage ?? i18n.language, { maximumFractionDigits: 1 });
  const sleep = (value: number) => t('bioHealth.sleepValue', { hours: Math.floor(Math.round(value) / 60), minutes: Math.round(value) % 60 });
  const action = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    onPress={onPress} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.title, { color: colors.bioText }]}>{label}</Text></Pressable>;
  return <View style={{ ...surfaces.bio, padding: 20, borderRadius: radius.lg, gap: 12, marginBottom: 16 }}>
    <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bioNight.title')}</Text>
    {night.state === 'LOADING' && <ActivityIndicator color={colors.bioText} />}
    {night.state === 'OFF' && <>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioNight.intro')}</Text>
      {action(t('bioNight.connect'), () => router.push('/settings'))}
    </>}
    {night.state === 'UNAVAILABLE' && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioNight.updateRequired')}</Text>}
    {(night.state === 'ERROR' || night.state === 'READY' && ['ERROR', 'TRUNCATED'].includes(night.analysis?.status ?? ''))
      && <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bioHealth.error')}</Text>}
    {night.state === 'READY' && night.analysis?.status === 'EMPTY' && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioHealth.noData')}</Text>}
    {latest && <>
      <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{sleep(latest.asleepMinutes)}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{latest.date}{!night.analysis?.fresh ? ` · ${t('bioHealth.stale')}` : ''}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
        {latest.cardiac.filter((entry) => details || entry.status === 'AVAILABLE').map((entry) => <View key={entry.metric} style={{ minWidth: 100, flexGrow: 1, gap: 4 }}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{t(`bioNight.${entry.metric}`)}</Text>
          <Text style={[typography.h2, { color: colors.bioText }]}>{entry.median === undefined ? '—' : `${format(entry.median)} ${entry.metric === 'HEART_RATE' ? 'bpm' : 'ms'}`}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{entry.status === 'AVAILABLE' ? t('bioNight.samples', { count: entry.samples })
            : t(entry.status === 'UNSUPPORTED' ? 'bioNight.unsupported' : entry.status === 'ERROR' || entry.status === 'TRUNCATED' ? 'bioHealth.error' : 'bioSummary.noMatch')}</Text>
        </View>)}
      </View>
      {!latest.cardiac.some((entry) => entry.status === 'AVAILABLE') && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSummary.noNightSignals')}</Text>}
      {action(t(details ? 'bioNight.hideDetails' : 'bioNight.details'), () => setDetails(!details))}
      {details && <View style={{ gap: 8 }}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{latest.sourceName}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioNight.interval', {
          from: new Date(latest.start).toLocaleString(i18n.language), to: new Date(latest.end).toLocaleString(i18n.language),
        })}</Text>
        {latest.cardiac.filter((entry) => entry.status === 'EMPTY').map((entry) => <Text key={entry.metric}
          style={[typography.body, { color: colors.textSecondary }]}>{t(`bioNight.${entry.metric}`)}: {t(`bioSummary.missing.${entry.missingReason ?? 'NO_READABLE_SAMPLES'}`)}</Text>)}
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioSummary.permissionPrivacy')}</Text>
        {latest.cardiac.filter((entry) => entry.status === 'AVAILABLE').map((entry) => <View key={entry.metric} style={{ gap: 4 }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`bioNight.${entry.metric}`)}: {t('bioNight.coverage', { bins: entry.occupiedBins, minutes: Math.round(entry.spanMinutes) })}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{night.analysis?.references[entry.metric]
            ? t('bioHealth.reference', { value: `${format(night.analysis.references[entry.metric]!.median)} ${entry.metric === 'HEART_RATE' ? 'bpm' : 'ms'}`, count: night.analysis.references[entry.metric]!.days })
            : t('bioNight.buildingReference')}</Text>
        </View>)}
        <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioNight.gaps', { awake: Math.round(latest.awakeMinutes), unknown: Math.round(latest.unobservedMinutes) })}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioNight.limit')}</Text>
      </View>}
    </>}
    {(night.state === 'READY' || night.state === 'ERROR') && action(t('bioNight.refresh'), night.reload)}
  </View>;
}
