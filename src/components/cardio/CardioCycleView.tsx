import { countWorkingSets } from '@/services/training/sessionSummary';
import { manualTargetLabels } from './manualCardioLabels';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { useExerciseName } from '@/hooks/useExerciseName';
import { DumbbellIcon } from '@/components/icons';
import { InfoIcon, MoonIcon } from '@/components/icons/ActionIcons';
import { CardioRouteIcon, CycleChevron } from '@/components/icons/CycleReviewIcons';
import { SetType } from '@/models';
import type { RoutineView } from '@/services/training/routineView';
import { groupedReviewSets, matchingStrengthSession } from '@/services/cardio/combinedCycleReview';
import type { CardioPreview, CardioPreviewInput } from '@/services/cardio/cardioPreview';

const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const layout = LinearTransition.duration(180);

/** One full-width expandable cycle, shared by standalone, hybrid and saved reviews. */
export function CardioCycleView({ input, preview, strengthRoutine, sessionCeiling = input.sessionMinutes, currentStrengthDetails = false }: {
  input: CardioPreviewInput; preview: CardioPreview; strengthRoutine?: RoutineView; sessionCeiling?: number; currentStrengthDetails?: boolean;
}) {
  const { t } = useTranslation(), exerciseName = useExerciseName();
  const { colors, surfaces, semantic } = useTheme(), insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null), [basisVisible, setBasisVisible] = useState(false);
  const sessions = useMemo(() => new Map(input.strength.map(s => [s.id, matchingStrengthSession(s, strengthRoutine)])), [input.strength, strengthRoutine]);
  const caption = { color: colors.textSecondary, fontSize: 13, lineHeight: 20 };
  const dayNumber = (day: number) => <View style={{ width: 33, flexShrink: 0, alignItems: 'center' }}>
    <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17 }}>{t('combinedReview.day')}</Text>
    <Text style={{ color: colors.textPrimary, fontSize: 21, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{day + 1}</Text>
  </View>;
  return <>
    <View style={{ flexDirection: 'row', gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.surfaceBorder, paddingVertical: 16, marginBottom: 24 }}>
      {[
        [input.strength.length ? `${input.strength.length} + ${preview.scheduled.length}` : String(preview.scheduled.length), t(input.strength.length ? 'combinedReview.disciplines' : 'combinedReview.cardioSessions')],
        [t('cardioPlan.days', { count: input.cycleDays }), t('combinedReview.perCycle')],
        input.manualSessions && !input.strength.length
          ? [preview.scheduled.some(s => !s.durationMinutes) ? '—' : `${preview.usedMinutes} min`, t('manualCardio.estimatedCycle')]
          : [`${sessionCeiling} min`, t('combinedReview.perSession')],
      ].map(([value, label]) => <View key={label} style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 23, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{value}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{label}</Text>
      </View>)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '500' }}>{t('combinedReview.distribution')}</Text>
      <Text style={caption}>{t('combinedReview.activeDays', { count: preview.activeDays.length })}</Text>
    </View>
    <View style={{ gap: 8 }}>{preview.days.map(day => {
      const events = [...day.strength.map(s => ({ id: `strength:${s.id}`, strength: s, cardio: undefined })),
        ...day.cardio.map(s => ({ id: `cardio:${s.id}`, strength: undefined, cardio: s }))];
      return <Animated.View key={day.dayIndex} layout={layout} testID={`combined-day-${day.dayIndex}`}>
        {!events.length ? <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, paddingHorizontal: 14 }}>
          {dayNumber(day.dayIndex)}<MoonIcon size={18} color={colors.accentText} />
          <Text style={[caption, { fontSize: 14 }]}>{t('calendar.rest')}</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.surfaceBorder }} />
        </View> : <View style={{ gap: 8 }}>{events.map(event => {
          const expanded = open === event.id, strength = event.strength, cardio = event.cardio;
          const session = strength ? sessions.get(strength.id) : null;
          const prescription = cardio ? preview.prescriptions.find(p => p.id === cardio.id) : undefined;
          const title = strength ? strength.name : t(`cardioPlan.${cardio!.modality}`);
          const muscles = [...new Set(session?.exercises.flatMap(e => e.primaryMuscles ?? [e.primaryMuscle]) ?? [])];
          const label = strength ? t('combinedReview.openStrength', { day: day.dayIndex + 1, name: title })
            : t('cardioPlan.openSession', { day: day.dayIndex + 1, modality: title });
          return <Animated.View key={event.id} layout={layout} style={{ ...(expanded ? surfaces.reviewDayExpanded : surfaces.reviewDay), borderRadius: 18, overflow: 'hidden' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : event.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 78, paddingVertical: 13, paddingHorizontal: 14 }}>
              {dayNumber(day.dayIndex)}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {strength ? <DumbbellIcon size={18} color={colors.accentText} /> : <CardioRouteIcon color={colors.accentText} />}
                  </View>
                  <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '500' }}>{title}</Text>
                </View>
                <Text style={[caption, { fontSize: 12, marginTop: 5 }]}>{strength ? muscles.map(m => t(`muscle.${m}`)).join(', ') || t('combinedReview.strengthSession') : t(prescription?.policy === 'MANUAL_PHASES_V1' ? 'manualCardio.title' : 'cardioPlan.easyEffort')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{!strength && !cardio!.durationMinutes ? t('manualCardio.untimed') : `${Math.ceil(strength?.estimatedMinutes ?? cardio!.durationMinutes)}′`}</Text>
                  {strength && session && <Text style={[caption, { fontSize: 12 }]}>
                    {t('combinedReview.strengthSetCount', { count: session.exercises.reduce((sum, exercise) => sum + countWorkingSets(exercise.sets), 0) })}
                  </Text>}
                </View>
                <CycleChevron expanded={expanded} color={colors.accentText} size={16} />
              </View>
            </Pressable>
            {expanded && <View testID={`combined-detail-${event.id}`} style={{ paddingLeft: 59, paddingRight: 15, paddingBottom: 17, gap: 10 }}>
              {strength && session && currentStrengthDetails && <Text style={caption}>{t('combinedReview.currentStrength')}</Text>}
              {strength ? session?.exercises.length ? session.exercises.map((exercise, index) => <View key={`${exercise.exerciseId}:${index}`}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 21 }}>{exerciseName({ id: exercise.exerciseId, name: exercise.name })}</Text>
                {groupedReviewSets(exercise).map((group, i) => <Text key={i} style={caption}>
                  {group.count} × {group.reps}{group.rir === undefined ? '' : ` @ RIR ${group.rir}`}{group.type === SetType.NORMAL ? '' : ` · ${t(`setType.${group.type}`)}`}
                </Text>)}
              </View>) : <Text style={caption}>{t('combinedReview.strengthUnavailable')}</Text>
                : prescription?.policy === 'MANUAL_PHASES_V1' ? prescription.segments.map(segment => <View key={segment.phase}>
                    <Text style={{ color: colors.textPrimary }}>{t(`cardioPlan.${segment.phase}`)}</Text>
                    <Text style={caption}>{manualTargetLabels(segment.targets, t).join(' · ')}</Text>
                  </View>) : prescription ? <>
                  <Text style={caption}>{duration(prescription.durationSeconds)} · {t(prescription.basis === 'REVIEWED_HISTORY' ? 'healthPlanning.source' : prescription.basis === 'FAMILIARIZATION' ? 'cardioPlan.familiarization' : 'cardioPlan.currentPractice')}</Text>
                  {prescription.segments.map(segment => <View key={segment.phase}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 21 }}>{t(`cardioPlan.${segment.phase}`)}</Text>
                    <Text style={caption}>{duration(segment.durationSeconds)} · {t('cardioPlan.effortRange', { min: segment.effort.min, max: segment.effort.max })}</Text>
                  </View>)}
                  <Text style={caption}>{t('cardioPlan.talkTest')}</Text>
                  {prescription.allowWalking && <Text style={caption}>{t(prescription.runWalk ? 'cardioPlan.runWalk' : 'cardioPlan.walking')}</Text>}
                </> : <Text style={caption}>{t('combinedReview.cardioUnavailable')}</Text>}
            </View>}
          </Animated.View>;
        })}</View>}
      </Animated.View>;
    })}</View>
    {preview.omitted.map(item => <Text key={item.candidateId} accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t(`cardioPlan.omitted_${item.reason}`)}</Text>)}
    {preview.closeDemandingSessions && <Text style={{ color: semantic.warning, marginTop: 12 }}>{t('cardioPlan.overlap')}</Text>}
    {!input.manualSessions && <Pressable accessibilityRole="button" accessibilityLabel={t('editorFlow.cardioWhy')} onPress={() => setBasisVisible(true)}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
      <InfoIcon color={colors.textSecondary} size={18} /><Text style={[caption, { flex: 1, fontSize: 12 }]}>{t(input.healthBaseline ? 'healthPlanning.source' : 'editorFlow.cardioSource')}</Text>
    </Pressable>}
    <Modal visible={basisVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBasisVisible(false)}>
      <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: insets.bottom + 30 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('workout.done')} onPress={() => setBasisVisible(false)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 17 }}>{t('workout.done')}</Text></Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '600', marginVertical: 22 }}>{t('editorFlow.cardioWhy')}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 25 }}>{t(input.healthBaseline?.policy.startsWith('OBSERVED_MONTHLY_') ? 'planningHistory.monthlyMethod'
          : input.healthBaseline?.policy === 'OBSERVED_REPEATABLE_START_V2'
          ? 'planningHistory.inferredMethod' : input.healthBaseline ? 'healthPlanning.explanation' : 'editorFlow.cardioExplanation')}</Text>
        {input.healthBaseline && <Text style={[caption, { marginTop: 16 }]}>{t('healthPlanning.provenance', { date: new Date(input.healthBaseline.observedAt).toLocaleDateString(), count: input.healthBaseline.observedSessions })}</Text>}
      </ScrollView>
    </Modal>
  </>;
}
