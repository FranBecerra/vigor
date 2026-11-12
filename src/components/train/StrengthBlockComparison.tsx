import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { strengthLongitudinalIndicators } from '@/services/training/mesocycleContinuity';

type Evidence = ReturnType<typeof strengthLongitudinalIndicators>;
type Cycle = Evidence['cycles'][number];

function median(sample: readonly number[]) {
  const sorted = [...sample].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function StrengthBlockComparison({ cycles, assessment }: { cycles: readonly Cycle[]; assessment: Evidence['nextBlockReview'] }) {
  const { t, i18n } = useTranslation();
  const { colors, surfaces, spacing, radius, semantic, typography } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const current = cycles.find(cycle => cycle.cycleIndex === selected);
  const label = (key: string) => t(`continuity.comparison.${key}`);
  const number = new Intl.NumberFormat(i18n?.language, { maximumFractionDigits: 1 });
  const heading = { ...typography.body, fontWeight: '700' as const, color: colors.textPrimary };
  const caption = { ...typography.caption, color: colors.textSecondary };
  const card = { ...surfaces.card, borderRadius: radius.lg, padding: spacing.md };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs };
  const cell = { ...caption, flex: 1, textAlign: 'center' as const, fontVariant: ['tabular-nums' as const] };
  const assessmentTitle = assessment.signals.includes('REPEATED_HARDER_RIR') ? 'reviewRir' : assessment.action;
  const risk = assessment.action === 'REVIEW';
  const reasons = assessment.signals.map(signal => label(signal)).join(' ');

  return <>
    <View style={{ ...card, ...(risk ? { borderLeftWidth: 3, borderLeftColor: semantic.warning } : {}), gap: spacing.xs }}>
      <Text style={{ ...caption, color: risk ? semantic.warning : colors.accentText }}>{label('forNextBlock')}</Text>
      <Text accessibilityRole="header" style={heading}>{label(assessmentTitle)}</Text>
      {!!reasons && <Text style={caption}>{reasons}</Text>}
    </View>
    <View style={card}>
      <Text accessibilityRole="header" style={heading}>{label('title')}</Text>
      <View style={{ ...row, paddingVertical: spacing.sm }}>
        {['cycle', 'sets', 'harder', 'recovery'].map(key => <Text key={key} style={cell}>{label(key)}</Text>)}
      </View>
      {cycles.map(cycle => {
        const open = selected === cycle.cycleIndex;
        const recovery = cycle.feedback?.answers.recovery;
        const harder = cycle.effort.reported.length ? `${cycle.effort.harder}/${cycle.effort.reported.length}` : '—';
        const sets = `${cycle.actualWorkingSets}/${cycle.plannedWorkingSets}`;
        return <Pressable key={cycle.cycleIndex} accessibilityRole="button" accessibilityState={{ expanded: open }}
          accessibilityLabel={t('continuity.comparison.row', { cycle: cycle.cycleIndex + 1, sets, harder,
            recovery: label(recovery ?? 'unknown'), phase: cycle.plannedDeload ? `, ${label('deload')}` : '' })}
          onPress={() => setSelected(open ? null : cycle.cycleIndex)}
          style={{ ...row, minHeight: 44, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.surfaceBorder,
            backgroundColor: open ? colors.surface : undefined }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...heading, color: open ? colors.accentText : colors.textPrimary }}>{cycle.cycleIndex + 1}</Text>
            {cycle.plannedDeload && <Text style={caption}>{label('deload')}</Text>}
          </View>
          <Text style={cell}>{sets}</Text>
          <Text style={{ ...cell, color: cycle.effort.harder > 0 ? semantic.warning : colors.textSecondary }}>{harder}</Text>
          <Text style={{ ...cell, color: recovery === 'WORSE' ? semantic.warning : colors.textSecondary }}>{label(recovery ?? 'unknown')}</Text>
        </Pressable>;
      })}
      {current && <View accessibilityLiveRegion="polite" style={{ gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.surfaceBorder, paddingTop: spacing.sm }}>
        <Text style={heading}>{t('continuity.comparison.detail', { cycle: current.cycleIndex + 1,
          completed: current.completedSessions, planned: current.plannedSessions })}</Text>
        {current.effort.reported.length > 0 ? <>
          <Text style={caption}>{t('continuity.comparison.rir', { planned: number.format(median(current.effort.pairedTargets)),
            actual: number.format(median(current.effort.reported)) })}</Text>
          <Text style={caption}>{t('continuity.comparison.coverage', { paired: current.effort.reported.length, planned: current.effort.planned.length })}</Text>
        </> : <Text style={caption}>{label('noPairs')}</Text>}
      </View>}
    </View>
  </>;
}
