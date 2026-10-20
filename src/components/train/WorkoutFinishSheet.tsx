import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { BodyMap } from './BodyMap';
import { heatPaint } from '@/services/training/bodyMap';
import type { workoutReview } from '@/services/training/workoutReview';
import type { Exercise } from '@/models';
import { WorkoutClock } from './WorkoutClock';

export function WorkoutFinishSheet({ open, saved, busy, error, summary, exercises, changed, historyReady, startedAt, completedAt, onFinish, onClose }:
  { open: boolean; saved: boolean; busy: boolean; error: boolean; summary: ReturnType<typeof workoutReview>; exercises: Exercise[];
    changed: boolean; historyReady: boolean; startedAt?: number; completedAt?: number; onFinish: (savePlan: boolean) => void; onClose: () => void }) {
  const { t } = useTranslation(); const { colors, typography, spacing, sectionAccent, radius, semantic } = useTheme(); const insets = useSafeAreaInsets();
  const action = (label: string, callback: () => void, primary = false) => <Pressable disabled={busy} onPress={callback}
    style={{ padding: 18, marginTop: 10, borderRadius: radius.pill, backgroundColor: primary ? sectionAccent.train : colors.surface }}>
    <Text style={{ color: primary ? colors.bg : colors.textPrimary, textAlign: 'center', fontWeight: '700' }}>{label}</Text>
  </Pressable>;
  return <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{t(saved ? 'workout.saved' : 'workout.finishTitle')}</Text>
      {startedAt !== undefined && <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Text style={{ color: colors.textSecondary }}>{t('workout.duration')}</Text><WorkoutClock startedAt={startedAt} completedAt={completedAt} />
      </View>}
      {!saved && summary.pending > 0 && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginVertical: 16 }}>{t('workout.pending', { count: summary.pending })}</Text>}
      <View style={{ flexDirection: 'row', gap: 12, marginVertical: 20 }}>
        {[ [summary.completed, t('workout.workingSets')], [Math.round(summary.tonnage).toLocaleString(), 'kg × reps'] ].map(([value, label]) =>
          <View key={label} style={{ flex: 1, padding: 20, backgroundColor: colors.surface, borderRadius: radius.lg }}>
            <Text style={[typography.emphasis, { color: sectionAccent.train }]}>{value}</Text><Text style={{ color: colors.textSecondary }}>{label}</Text>
          </View>)}
      </View>
      <BodyMap height={240} paint={heatPaint(summary.volumes, sectionAccent.train)} />
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 12 }}>{t('workout.heatHint')}</Text>
      {summary.volumes.map((volume) => <View key={volume.muscle} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
        <Text style={{ color: colors.textSecondary }}>{t(`muscle.${volume.muscle}`)}</Text><Text style={{ color: colors.textPrimary }}>{volume.sets}</Text>
      </View>)}
      {!historyReady && <Text style={{ color: colors.textMuted, marginVertical: 12 }}>{t('workout.prUnavailable')}</Text>}
      {historyReady && summary.records.map((record) => <View key={record.exerciseId} style={{ padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, marginTop: 10 }}>
        <Text style={{ color: sectionAccent.train, fontWeight: '700' }}>PR · {exercises.find((exercise) => exercise.id === record.exerciseId)?.name}</Text>
        <Text style={{ color: colors.textPrimary }}>{record.weight} kg × {record.reps}</Text>
      </View>)}
      {error && <Text accessibilityRole="alert" style={{ color: semantic.danger, marginTop: 12 }}>{t('workout.finishError')}</Text>}
      {saved ? action(t('workout.done'), onClose, true) : <>
        {changed && summary.completed > 0 && <><Text style={{ color: colors.textSecondary, marginTop: 20 }}>{t('workout.planChanges')}</Text>
          {action(t('workout.finishAndUpdate'), () => onFinish(true))}</>}
        {summary.completed > 0 && action(t(busy ? 'train.saving' : 'workout.saveWorkout'), () => onFinish(false), true)}
        {action(t('workout.continue'), onClose)}
      </>}
    </ScrollView>
  </Modal>;
}
