import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { BioHealthMetric, BioHealthTrend } from '@/models/bioHealth';
import type { useBioHealth } from '@/hooks/useBioHealth';
import { buildMetricMonitor, metricChartSlots, type MetricMonitor } from '@/services/bio/metricMonitor';
import { InfoIcon } from '@/components/icons/ActionIcons';
import { BioIntervalBar, BioMetricTrend, metricTone, SoftMetricSurface, useMetricMaterial } from './BioMetricVisual';

export function BioMetricMonitor({ health, sleepGoalMinutes }: { health: ReturnType<typeof useBioHealth>; sleepGoalMinutes?: number }) {
  const { t, i18n } = useTranslation(), router = useRouter();
  const { colors, typography } = useTheme(), material = useMetricMaterial();
  const [info, setInfo] = useState(false);
  const [selected, setSelected] = useState<{ metric: BioHealthMetric; source?: string; owner: string | null } | null>(null);
  useEffect(() => { setSelected(null); setInfo(false); }, [health.owner, health.state]);
  const rows = useMemo(() => health.state === 'READY'
    ? (['RESTING_HR', 'HRV_SDNN', 'SLEEP'] as const).map((metric) => {
      const trend: BioHealthTrend = health.trends.find((item) => item.metric === metric)
        ?? { metric, status: 'EMPTY', days: [], fresh: false };
      return { trend, view: buildMetricMonitor(trend, sleepGoalMinutes, Date.now()) };
    }) : [], [health.trends, health.state, sleepGoalMinutes]);
  const active = selected && selected.owner === health.owner && rows.find(({ trend }) => trend.metric === selected.metric && trend.sourceId === selected.source);
  useEffect(() => { if (selected && !active) setSelected(null); }, [selected, active]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const format = (metric: BioHealthMetric, value: number) => metric === 'SLEEP'
    ? t('bioMetric.sleepValue', { hours: Math.floor(Math.round(value) / 60), minutes: Math.round(value) % 60 })
    : value.toLocaleString(language, { maximumFractionDigits: 1 });
  const unit = (metric: BioHealthMetric) => metric === 'SLEEP' ? '' : metric === 'RESTING_HR' ? 'bpm' : 'ms';
  const full = (metric: BioHealthMetric, value: number) => `${format(metric, value)} ${unit(metric)}`.trim();
  const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(language, { day: 'numeric', month: 'short' });
  const range = (metric: BioHealthMetric, view: MetricMonitor) => view.range
    ? `${format(metric, view.range.lower)}–${full(metric, view.range.upper)}` : t('bioMetric.noRange');
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action}
    style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.title, { color: colors.bioText }]}>{label}</Text></Pressable>;
  const reading = (trend: BioHealthTrend, view: MetricMonitor) => <>
    <Text style={[typography.emphasis, { color: colors.textPrimary, fontVariant: ['tabular-nums'] }]}>
      {view.latest ? format(trend.metric, view.latest.value) : '—'}
      {!!view.latest && <Text style={[typography.caption, { color: colors.textSecondary }]}> {unit(trend.metric)}</Text>}
    </Text>
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <View accessible={false} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: material[metricTone(view)] }} />
      <Text style={[typography.caption, { flexShrink: 1, color: material[metricTone(view)], fontWeight: '600' }]}>{t(`bioMetric.position.${view.position}`)}</Text>
    </View>
  </>;
  return <View style={{ gap: 14, marginBottom: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={[typography.h2, { color: colors.textPrimary, flex: 1 }]}>{t('bioMetric.title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bioSummary.recordDetails')} accessibilityState={{ expanded: info }}
        onPress={() => setInfo(!info)} style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
        <View accessible={false}><InfoIcon size={24} color={colors.bioText} /></View>
      </Pressable>
    </View>
    {info && <SoftMetricSurface style={{ padding: 18, gap: 10 }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioMetric.method')}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioHealth.contextOnly')}</Text>
    </SoftMetricSurface>}
    {health.state === 'LOADING' && <ActivityIndicator color={colors.bioText} />}
    {health.state === 'OFF' && <SoftMetricSurface style={{ padding: 20 }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioHealth.connectIntro')}</Text>
      {button(t('bioHealth.openSettings'), () => router.push('/settings'))}
    </SoftMetricSurface>}
    {health.state === 'UNAVAILABLE' && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('health.unavailable')}</Text>}
    {health.state === 'ERROR' && <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bioHealth.error')}</Text>}
    {health.state === 'READY' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {rows.map(({ trend, view }) => <View key={trend.metric} style={{ width: trend.metric === 'SLEEP' ? '100%' : '47%', flexGrow: 1 }}>
        <SoftMetricSurface style={{ flex: 1 }} testID={`bio-metric-${trend.metric}`}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('bioMetric.open', { metric: t(`bioMetric.label.${trend.metric}`) })}
            accessibilityHint={t('bioMetric.openHint')} onPress={() => setSelected({ metric: trend.metric, source: trend.sourceId, owner: health.owner })}
            style={{ padding: 16, gap: 10, flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textSecondary, minHeight: 32 }]}>{t(`bioMetric.label.${trend.metric}`)}</Text>
            {reading(trend, view)}
            <BioIntervalBar view={view} label={t('bioMetric.intervalLabel', { value: view.latest ? full(trend.metric, view.latest.value) : '—', range: range(trend.metric, view) })} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{view.range ? `${t('bioMetric.range')}\n${range(trend.metric, view)}` : t(view.position === 'MISSING' ? 'bioHealth.missing' : view.position === 'ERROR' ? 'bioHealth.error' : 'bioMetric.noRange')}</Text>
            {view.latest && <Text style={[typography.caption, { color: colors.textSecondary }]}>{date(view.latest.date)}</Text>}
          </Pressable>
        </SoftMetricSurface>
      </View>)}
    </View>}
    {(health.state === 'READY' || health.state === 'ERROR') && button(t('bioHealth.refresh'), health.reload)}
    {!!active && <Modal visible animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={() => setSelected(null)}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 48, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={[typography.h2, { flex: 1, color: colors.textPrimary }]}>{t(`bioMetric.label.${active.trend.metric}`)}</Text>
            {button(t('bioMetric.close'), () => setSelected(null))}
          </View>
          <SoftMetricSurface style={{ padding: 20, gap: 12 }} testID="bio-metric-detail">
            {reading(active.trend, active.view)}
            {active.view.latest && <Text style={[typography.caption, { color: colors.textSecondary }]}>{date(active.view.latest.date)}</Text>}
            <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bioMetric.trend')}</Text>
            <BioMetricTrend view={active.view} label={t('bioHealth.chartLabel', { count: metricChartSlots(active.view).filter((slot) => slot.day).length })} />
            {active.view.latest && <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{date(metricChartSlots(active.view)[0].date)}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{date(active.view.latest.date)}</Text>
            </View>}
            <Text style={[typography.body, { color: colors.textPrimary }]}>{active.view.range ? `${t('bioMetric.range')}: ${range(active.trend.metric, active.view)}` : t(active.view.latest ? 'bioHealth.buildingReference' : 'bioHealth.noData')}</Text>
            {active.view.goal !== undefined && <Text style={[typography.body, { color: colors.textPrimary }]}>{t('bioMetric.goal', { value: full('SLEEP', active.view.goal) })}</Text>}
            {active.trend.metric === 'SLEEP' && <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioMetric.sleepBoundary')}</Text>}
            {active.view.position === 'GOAL_MISSING' && button(t('bioReadiness.setGoal'), () => { setSelected(null); router.push('/settings'); })}
          </SoftMetricSurface>
          <SoftMetricSurface style={{ padding: 18, gap: 8 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bioMetric.records')}</Text>
            {active.trend.sourceName && <Text style={[typography.body, { color: colors.textSecondary }]}>{active.trend.sourceName}</Text>}
            {active.view.range && <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioMetric.referenceDates', { count: active.view.range.count, from: date(active.view.range.from), to: date(active.view.range.to) })}</Text>}
            {metricChartSlots(active.view).map((slot) => <View key={slot.date} style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>{date(slot.date)}</Text>
              <Text style={[typography.body, { color: colors.textPrimary }]}>{slot.day ? full(active.trend.metric, slot.day.value) : t('bioHealth.missing')}</Text>
            </View>)}
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioMetric.method')}</Text>
          </SoftMetricSurface>
        </ScrollView>
      </View>
    </Modal>}
  </View>;
}
