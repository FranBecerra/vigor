import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Exercise, WorkoutSession } from '@/models';
import { useTheme } from '@/theme/useTheme';
import { useTrainingUnits } from '@/hooks/useTrainingUnits';
import { useExerciseName } from '@/hooks/useExerciseName';
import { useBioDailyHistory } from '@/hooks/useBioDailyHistory';
import { bioExposureRows, bioPerformanceSeries, type BioGranularity } from '@/services/bio/observations';
import { intensityLabel } from '@/services/training/intensityScale';

export function BioEvolution({ owner, history, catalogue }: { owner: string | null; history: WorkoutSession[]; catalogue: ReadonlyMap<string, Exercise> }) {
  const { t, i18n } = useTranslation(), { colors, surfaces, radius, typography } = useTheme();
  const daily = useBioDailyHistory(), units = useTrainingUnits(), name = useExerciseName();
  const [granularity, setGranularity] = useState<BioGranularity>('MICROCYCLE');
  const [showDaily, setShowDaily] = useState(false), [showPerformance, setShowPerformance] = useState(false);
  const [exposureLimit, setExposureLimit] = useState(8), [performanceLimit, setPerformanceLimit] = useState(12);
  const now = Date.now();
  const exposure = useMemo(() => bioExposureRows(owner ?? '', history, catalogue, now, granularity), [owner, history, catalogue, granularity]);
  const performance = useMemo(() => bioPerformanceSeries(owner ?? '', history, catalogue, now), [owner, history, catalogue]);
  const card = { ...surfaces.bio, borderRadius: radius.lg, padding: 20, marginBottom: 16, gap: 12 };
  const date = (at: number) => new Date(at).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language);
  const value = (kg: number) => units.display(kg)!.toLocaleString(i18n.resolvedLanguage ?? i18n.language, { maximumFractionDigits: 1 });
  return <>
    <View style={card}>
      <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bioEvolution.exposure')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {(['DAY', 'SESSION', 'MICROCYCLE', 'MESOCYCLE'] as const).map((level) => <Pressable key={level} accessibilityRole="button"
          accessibilityLabel={t(`bioEvolution.${level}`)} accessibilityState={{ selected: level === granularity }} onPress={() => setGranularity(level)}
          style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: level === granularity ? 2 : 0, borderColor: colors.bioText }}>
          <Text style={[typography.title, { color: level === granularity ? colors.bioText : colors.textSecondary }]}>{t(`bioEvolution.${level}`)}</Text>
        </Pressable>)}
      </ScrollView>
      {exposure.length === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioEvolution.noWork')}</Text>}
      {exposure.slice(0, exposureLimit).map((row) => <View key={row.id} style={{ gap: 6, paddingTop: 10, borderTopWidth: 0.5, borderColor: colors.surfaceBorder }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{date(row.from)}{date(row.to) !== date(row.from) ? ` – ${date(row.to)}` : ''}</Text>
        <Text style={[typography.body, { color: colors.bioText }]}>{t('bioEvolution.work', { workouts: row.workouts, sets: row.sets, minutes: row.minutes })}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{row.muscles.map((muscle) => <View key={muscle.muscle}
          style={{ backgroundColor: colors.bioTint, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 5 }}>
          <Text style={[typography.caption, { color: colors.bioText }]}>{t(`muscle.${muscle.muscle}`)} {muscle.sets}</Text>
        </View>)}</View>
      </View>)}
      {exposure.length > exposureLimit && <Pressable accessibilityRole="button" accessibilityLabel={t('bioEvolution.moreWork')}
        onPress={() => setExposureLimit((value) => value + 8)} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={[typography.title, { color: colors.bioText }]}>{t('bioEvolution.moreWork')}</Text></Pressable>}
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioEvolution.credit')}</Text>
    </View>
    <View style={card}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bioEvolution.daily')} accessibilityState={{ expanded: showDaily }} onPress={() => setShowDaily(!showDaily)}
        style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bioEvolution.daily')} {showDaily ? '⌃' : '⌄'}</Text></Pressable>
      {showDaily && <>
        {daily.error ? <Pressable accessibilityRole="button" accessibilityLabel={t('bio.retry')} onPress={daily.reload} style={{ minHeight: 48 }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.loadError')} {t('bio.retry')}</Text></Pressable>
          : daily.ready && daily.entries.length === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioEvolution.noDaily')}</Text>}
        {daily.entries.map((entry) => <View key={entry.id} style={{ gap: 6, paddingTop: 12, borderTopWidth: 0.5, borderColor: colors.surfaceBorder }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{entry.localDate}</Text>
          {Object.entries(entry.answers).map(([field, answer]) => <Text key={field} style={[typography.body, { color: colors.textSecondary }]}>
            {t(`dailyCheckIn.${field}`)}: {t(`dailyCheckIn.${answer}`)}</Text>)}
        </View>)}
      </>}
    </View>
    <View style={card}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bioEvolution.performance')} accessibilityState={{ expanded: showPerformance }} onPress={() => setShowPerformance(!showPerformance)}
        style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bioEvolution.performance')} {showPerformance ? '⌃' : '⌄'}</Text></Pressable>
      {showPerformance && <>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioEvolution.performanceHint')}</Text>
        {performance.length === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioEvolution.noPerformance')}</Text>}
        {performance.slice(0, performanceLimit).map((series) => <View key={series.key} style={{ gap: 7, paddingTop: 12, borderTopWidth: 0.5, borderColor: colors.surfaceBorder }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{series.exercise ? name(series.exercise) : series.exerciseId}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{t(series.comparableEffort ? 'bioEvolution.reportedEffort' : 'bioEvolution.unknownEffort')}</Text>
          {series.recordingLoad === 'PER_HAND_KG' && <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioEvolution.perHand')}</Text>}
          {series.points.slice(-6).map((point) => <View key={point.workoutId} style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{date(point.at)}</Text>
            <Text style={[typography.body, { color: colors.textPrimary }]}>{value(point.weight)} {units.unit} × {point.reps}{point.rir !== null ? ` @ RIR ${intensityLabel(point.rir, 'RIR')}` : ''}</Text>
          </View>)}
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioEvolution.estimate', { value: value(series.points.at(-1)!.estimate), unit: units.unit })}</Text>
        </View>)}
        {performance.length > performanceLimit && <Pressable accessibilityRole="button" accessibilityLabel={t('bioEvolution.morePerformance')}
          onPress={() => setPerformanceLimit((value) => value + 12)} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={[typography.title, { color: colors.bioText }]}>{t('bioEvolution.morePerformance')}</Text></Pressable>}
      </>}
    </View>
  </>;
}
