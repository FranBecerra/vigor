import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { BioReadinessView } from '@/hooks/useBioReadiness';
import { readinessBand, readinessInk } from '@/services/bio/readinessPresentation';
import { InfoIcon } from '@/components/icons/ActionIcons';

export function BioReadinessCard({ view }: { view: BioReadinessView }) {
  const { t, i18n } = useTranslation(), router = useRouter(), { scheme, colors, surfaces, radius, typography } = useTheme();
  const [details, setDetails] = useState(false);
  const index = view.state === 'READY' ? view.index : undefined;
  const format = (value?: number) => value === undefined ? '—' : value.toLocaleString(i18n.resolvedLanguage ?? i18n.language, { maximumFractionDigits: 1 });
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    onPress={action} style={{ minHeight: 48, justifyContent: 'center' }}>
    <Text style={[typography.title, { color: colors.bioText }]}>{label}</Text>
  </Pressable>;
  const badge = (score: number | undefined, measured = false, unusual = false, missingGoal = false) => {
    const band = readinessBand(score), ink = readinessInk[scheme][band];
    return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
      <View accessible={false} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ink }} />
      <Text style={[typography.caption, { color: ink, flexShrink: 1 }]}>{t(`bioSummary.${unusual ? 'unusual' : missingGoal ? 'goalMissing' : band === 'UNKNOWN' && measured ? 'building' : band}`)}</Text>
    </View>;
  };
  return <View style={{ ...surfaces.bio, borderRadius: radius.lg, padding: 20, gap: 12, marginBottom: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bioReadiness.title')}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioReadiness.experimental')}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t(details ? 'bioReadiness.hideDetails' : 'bioReadiness.details')}
        accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <View accessible={false}><InfoIcon size={24} color={colors.bioText} /></View>
      </Pressable>
    </View>
    {view.state === 'LOADING' ? <ActivityIndicator color={colors.bioText} /> : <>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text testID="readiness-score" style={[typography.emphasis, { color: readinessInk[scheme][readinessBand(index?.score)] }]}>{index?.score ?? '—'}</Text>
        {index?.score !== undefined && <Text style={[typography.title, { color: colors.textSecondary }]}>/ 100</Text>}
      </View>
      {badge(index?.score)}
      {index?.date && <Text style={[typography.caption, { color: colors.textSecondary }]}>{index.date}</Text>}
      {view.state === 'OFF' && <>
        {button(t('bioNight.connect'), () => router.push('/settings'))}
      </>}
      {view.state === 'UNAVAILABLE' && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioNight.updateRequired')}</Text>}
      {view.state === 'ERROR' && <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bioHealth.error')}</Text>}
      {index && <>
        {[
          { key: 'sleep', title: t('bioReadiness.sleep'), score: index.sleep.score, value: index.sleep.currentMinutes,
            missingGoal: index.reasons.includes('SLEEP_GOAL'),
            display: index.sleep.currentMinutes === undefined ? '—' : t('bioHealth.sleepValue', {
              hours: Math.floor(Math.round(index.sleep.currentMinutes) / 60), minutes: Math.round(index.sleep.currentMinutes) % 60 }) },
          { key: 'pulse', title: t('bioNight.HEART_RATE'), score: index.cardiac.pulse?.score, value: index.cardiac.pulse?.current,
            unusual: index.cardiac.pulse?.unusual,
            display: index.cardiac.pulse?.current === undefined ? '—' : `${format(index.cardiac.pulse.current)} bpm` },
          { key: 'hrv', title: index.cardiac.hrv ? t(`bioNight.${index.cardiac.hrv.metric}`) : t('bioSummary.hrv'),
            score: index.cardiac.hrv?.score, value: index.cardiac.hrv?.current,
            unusual: index.cardiac.hrv?.unusual,
            display: index.cardiac.hrv?.current === undefined ? '—' : `${format(index.cardiac.hrv.current)} ms` },
        ].map((row) => <View key={row.key} testID={`readiness-metric-${row.key}`}
          style={{ paddingVertical: 10, borderTopWidth: 0.5, borderColor: colors.surfaceBorder, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>{row.title}</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{row.display}</Text>
          </View>
          {badge(row.score, row.value !== undefined, row.unusual, row.missingGoal)}
        </View>)}
        {index.reasons.includes('SLEEP_GOAL') && button(t('bioReadiness.setGoal'), () => router.push('/settings'))}
        {details && <View style={{ gap: 10 }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`bioReadiness.coverage.${index.coverage}`)}</Text>
          {index.reasons.map((reason) => <Text key={reason} style={[typography.body, { color: colors.textSecondary }]}>{t(`bioReadiness.reason.${reason}`)}</Text>)}
          <Text style={[typography.body, { color: colors.textSecondary }]}>{index.sourceName}</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioReadiness.sleepDetails', {
            current: format(index.sleep.currentMinutes), goal: format(index.sleep.goalMinutes), count: index.sleep.observedDays,
          })}</Text>
          {[index.cardiac.pulse, index.cardiac.hrv].map((signal, position) => signal && <View key={position} style={{ gap: 4 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{t(`bioNight.${signal.metric}`)}</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioReadiness.signalDetails', { current: format(signal.current), recent: format(signal.recent), reference: format(signal.reference), unit: signal.metric === 'HEART_RATE' ? 'bpm' : 'ms' })}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioReadiness.signalCoverage', {
              baseline: signal.baselineDays, recent: signal.recentDays, windows: signal.referenceWindows,
            })}</Text>
          </View>)}
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioReadiness.formula')}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{index.policy}</Text>
        </View>}
      </>}
    </>}
    {details && <>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSummary.legend')}</Text>
      {view.state === 'OFF' && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioReadiness.intro')}</Text>}
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioReadiness.boundary')}</Text>
    </>}
  </View>;
}
