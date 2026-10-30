import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { BodyMap } from './BodyMap';
import { heatPaint } from '@/services/training/bodyMap';
import type { workoutReview } from '@/services/training/workoutReview';
import type { Exercise } from '@/models';
import { WorkoutClock } from './WorkoutClock';
import type { ReactNode } from 'react';
import { TrophyIcon } from '@/components/icons/ActionIcons';
import { useExerciseName } from '@/hooks/useExerciseName';
import { useState } from 'react';
import { useTrainingUnits } from '@/hooks/useTrainingUnits';
import type { WorkoutPlanChange } from '@/services/training/workoutReview';
import { SessionEffortInput } from './SessionEffortInput';

export function WorkoutFinishSheet({ open, saved, busy, error, summary, exercises, changed, changes = [], historyReady, startedAt, completedAt, healthContent, effortValue = null, onChangeEffort, onFinish, onClose, planUpdateError = false, onRetryPlan }:
  { open: boolean; saved: boolean; busy: boolean; error: boolean; summary: ReturnType<typeof workoutReview>; exercises: Exercise[];
    changed: boolean; changes?: WorkoutPlanChange[]; historyReady: boolean; startedAt?: number; completedAt?: number; healthContent?: ReactNode;
    effortValue?: number | null; onChangeEffort?: (value: number | null) => void; onFinish: (savePlan: boolean) => void; onClose: () => void;
    planUpdateError?: boolean; onRetryPlan?: () => void }) {
  const { t } = useTranslation(); const { surfaces, colors, typography, spacing, sectionAccent, radius, semantic } = useTheme(); const insets = useSafeAreaInsets();
  const exerciseName = useExerciseName(); const units = useTrainingUnits();
  const [showChanges, setShowChanges] = useState(false);
  const action = (label: string, callback: () => void, primary = false) => <Pressable disabled={busy} onPress={callback}
    style={{ ...(primary ? surfaces.primary : surfaces.field), padding: 18, marginTop: 10, borderRadius: radius.md, backgroundColor: primary ? sectionAccent.train : colors.surface }}>
    <Text style={{ color: primary ? colors.onAccent : colors.textPrimary, textAlign: 'center', fontWeight: '700' }}>{label}</Text>
  </Pressable>;
  return <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <ScrollView style={{ ...surfaces.screen, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{t(saved ? 'workout.saved' : 'workout.finishTitle')}</Text>
      {startedAt !== undefined && <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Text style={{ color: colors.textSecondary }}>{t('workout.duration')}</Text><WorkoutClock startedAt={startedAt} completedAt={completedAt} />
      </View>}
      {!saved && summary.pending > 0 && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginVertical: 16 }}>{t('workout.pending', { count: summary.pending })}</Text>}
      <View style={{ flexDirection: 'row', gap: 12, marginVertical: 20 }}>
        {[ [summary.completed, t('workout.workingSets')], [Math.round(units.display(summary.tonnage) ?? 0).toLocaleString(), `${units.unit} × reps`] ].map(([value, label]) =>
          <View key={label} style={{ ...surfaces.card, flex: 1, padding: 20, borderRadius: radius.lg }}>
            <Text style={[typography.emphasis, { color: colors.accentText }]}>{value}</Text><Text style={{ color: colors.textSecondary }}>{label}</Text>
          </View>)}
      </View>
      {!saved && summary.completed > 0 && onChangeEffort && <SessionEffortInput value={effortValue} onChange={onChangeEffort} disabled={busy} />}
      {saved && effortValue !== null && <Text style={{ color: colors.textSecondary, marginVertical: 12 }}>{t('sessionEffort.summary', { value: effortValue })}</Text>}
      <BodyMap height={240} paint={heatPaint(summary.volumes, sectionAccent.train)} />
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 12 }}>{t('workout.heatHint')}</Text>
      {summary.volumes.map((volume) => <View key={volume.muscle} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
        <Text style={{ color: colors.textSecondary }}>{t(`muscle.${volume.muscle}`)}</Text><Text style={{ color: colors.textPrimary }}>{volume.sets}</Text>
      </View>)}
      {!historyReady && <Text style={{ color: colors.textMuted, marginVertical: 12 }}>{t('workout.prUnavailable')}</Text>}
      {historyReady && summary.records.map((record) => <View key={record.exerciseId} style={{ ...surfaces.card, padding: 16, borderRadius: radius.md, marginTop: 10 }}>
        <TrophyIcon color={colors.textPrimary} />
        <Text style={{ color: colors.accentText, fontWeight: '700' }}>PR · {(() => { const exercise = exercises.find((item) => item.id === record.exerciseId); return exercise ? exerciseName(exercise) : ''; })()}</Text>
        <Text style={{ color: colors.textPrimary }}>{units.display(record.weight)?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {units.unit} × {record.reps}</Text>
      </View>)}
      {error && <Text accessibilityRole="alert" style={{ color: semantic.danger, marginTop: 12 }}>{t('workout.finishError')}</Text>}
      {saved && planUpdateError && <><Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t('finishPlanUpdate.failed')}</Text>
        {onRetryPlan && action(t('finishPlanUpdate.retry'), onRetryPlan)}</>}
      {saved && healthContent}
      {saved ? action(t(busy ? 'train.saving' : 'workout.done'), onClose, true) : <>
        {changed && summary.completed > 0 && <><Text style={{ color: colors.textSecondary, marginTop: 20 }}>{t('workout.planChanges')}</Text>
          {action(t('trainingUpdates.changes'), () => setShowChanges(true))}
          {action(t('workout.finishAndUpdate'), () => onFinish(true))}</>}
        {summary.completed > 0 && action(t(busy ? 'train.saving' : 'workout.saveWorkout'), () => onFinish(false), true)}
        {action(t('workout.continue'), onClose)}
      </>}
    </ScrollView>
    <Modal visible={open && showChanges} transparent animationType="slide" onRequestClose={() => setShowChanges(false)}>
      <Pressable onPress={() => setShowChanges(false)} style={{ flex: 1, backgroundColor: '#0007' }} accessibilityLabel={t('restControls.close')} />
      <View style={{ maxHeight: '65%', ...surfaces.sheet, backgroundColor: colors.bgElevated, padding: 20, paddingBottom: insets.bottom + 20, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{t('trainingUpdates.changes')}</Text>
        <ScrollView>{changes.map((change, index) => <View key={index} style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceBorder }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{change.exercise ? exerciseName(change.exercise) : change.exerciseId}</Text>
          <Text style={{ color: colors.textSecondary }}>{t(change.kind === 'superset' ? 'executionUpdates.change_superset' : change.kind === 'warmups' ? 'setType.WARMUP' : `trainingUpdates.change_${change.kind}`, { set: change.set })}
            {change.before !== undefined ? ` · ${change.kind === 'type' ? t(`setType.${change.before}`) : change.before} → ${change.kind === 'type' ? t(`setType.${change.after}`) : change.after}` : ''}</Text>
        </View>)}</ScrollView>
        {action(t('workout.done'), () => setShowChanges(false))}
      </View>
    </Modal>
  </Modal>;
}
