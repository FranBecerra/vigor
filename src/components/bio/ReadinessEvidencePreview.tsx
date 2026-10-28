import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { ReadinessEvidence } from '@/services/bio/readinessEvidence';

/** Synthetic fixture presentation; production activation requires policy review. */
export function ReadinessEvidencePreview({ evidence }: { evidence: ReadinessEvidence }) {
  const { t } = useTranslation(), { colors, surfaces, typography, radius } = useTheme();
  const format = (metric: string, value: number) => metric === 'SLEEP'
    ? t('bioHealth.sleepValue', { hours: Math.floor(Math.round(value) / 60), minutes: Math.round(value) % 60 })
    : `${Math.round(value * 10) / 10} ${metric === 'RESTING_HR' ? 'bpm' : 'ms'}`;
  return <View style={{ ...surfaces.bio, padding: 20, borderRadius: radius.lg, marginBottom: 16, gap: 12 }}>
    <Text style={[typography.caption, { color: colors.textSecondary }]}>Synthetic automatic-readiness POC · not active</Text>
    <Text style={[typography.h2, { color: colors.textPrimary }]}>{t(`readinessPreview.${evidence.state}`)}</Text>
    {evidence.signals.map((signal) => <View key={signal.metric} style={{ gap: 5 }}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>{t(`bioHealth.${signal.metric}`)}: {t(`readinessPreview.${signal.state}`)}</Text>
      {signal.recent !== undefined && <Text style={[typography.body, { color: colors.textSecondary }]}>
        {format(signal.metric, signal.recent)} · {t('readinessPreview.range')}: {format(signal.metric, signal.lower!)}–{format(signal.metric, signal.upper!)}
      </Text>}
    </View>)}
    <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('readinessPreview.explanation')}</Text>
  </View>;
}
