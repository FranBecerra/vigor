import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { reviewHybridCapacity } from '@/services/cardio/hybridCapacity';

/** Full-width microcycle rows, not a second pill/tab navigation. */
export function HybridCapacityPanel({ review, budget }: { review: ReturnType<typeof reviewHybridCapacity>; budget: number }) {
  const { t, i18n } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme();
  const [info, setInfo] = useState(false);
  const minutes = (n: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(n);
  return <View style={{ ...surfaces.card, padding: 18, borderRadius: radius.lg, gap: 14 }}>
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 21, fontWeight: '700' }}>{t('hybridCapacity.title')}</Text>
    {review.cycles.map(row => <View key={row.cycle} style={{ gap: 6, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', flexGrow: 1 }}>{t('cardioTraining.cycle', { value: row.cycle + 1 })}</Text>
        <Text style={{ color: row.overBudgetMinutes || row.sessionLimitExceeded ? semantic.warning : colors.accentText, fontSize: 18, fontWeight: '700' }}>
          {t('hybridCapacity.total', { used: minutes(row.totalMinutes), budget: minutes(budget) })}
        </Text>
      </View>
      <Text style={{ color: colors.textSecondary }}>{row.startDate} — {row.endDate}</Text>
      <Text style={{ color: colors.textPrimary, lineHeight: 21 }}>{t('hybridCapacity.breakdown', {
        strength: minutes(row.strengthMinutes), cardio: minutes(row.cardioMinutes), sports: minutes(row.plannedSportMinutes + row.recordedSportMinutes),
      })}</Text>
      {row.provisional && <Text style={{ color: colors.textSecondary }}>{t('cardioProgression.provisional')}</Text>}
      {!!row.overBudgetMinutes && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('hybridCapacity.over', { minutes: minutes(row.overBudgetMinutes) })}</Text>}
      {row.sessionLimitExceeded && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('hybridPlan.issue_SESSION_TIME')}</Text>}
    </View>)}
    {!review.fits && <Text style={{ color: semantic.warning, lineHeight: 21 }}>{t('hybridCapacity.adjust')}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={t('hybridCapacity.info')} accessibilityState={{ expanded: info }}
      onPress={() => setInfo(value => !value)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.accentText, fontSize: 16 }}>{t('hybridCapacity.info')}</Text>
    </Pressable>
    {info && <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>{t('hybridCapacity.scope')}</Text>}
  </View>;
}
