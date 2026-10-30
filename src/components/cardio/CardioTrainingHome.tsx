import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useCardioBlocks, useCardioWorkouts } from '@/hooks/useCardioTraining';
import type { CardioWorkout } from '@/models/cardioTraining';

export function CardioHistoryCard({ workout, onPress }: { workout: CardioWorkout; onPress: () => void }) {
  const { t } = useTranslation(), { colors, surfaces, radius } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={t('cardioTraining.result')} onPress={onPress}
    style={{ ...surfaces.card, padding: 18, borderRadius: radius.lg, marginBottom: 12, gap: 8 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '600' }}>{t(`cardioPlan.${workout.prescription.modality}`)} · {workout.name}</Text>
    <Text style={{ color: colors.textSecondary }}>{new Date(workout.startedAt).toLocaleDateString()} · {Math.round(workout.actualSeconds! / 60 * 10) / 10} min</Text>
    {workout.feedback?.effort != null && <Text style={{ color: colors.bioText }}>{t('sessionEffort.summary', { value: workout.feedback.effort })}</Text>}
  </Pressable>;
}
export function CardioTrainingHome() {
  const blocks = useCardioBlocks(), workouts = useCardioWorkouts(), router = useRouter();
  const { t } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme();
  return <View style={{ gap: 10 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('cardioHealth.title')} onPress={() => router.push('/cardio-health')}
      style={{ ...surfaces.card, minHeight: 60, padding: 18, borderRadius: radius.lg }}>
      <Text style={{ color: colors.accentText, fontSize: 17, fontWeight: '600' }}>{t('cardioHealth.title')} ›</Text>
    </Pressable>
    {workouts.entries.filter(w => w.status === 'RUNNING' || w.status === 'PAUSED').map(w => <Pressable key={w.id} accessibilityRole="button" accessibilityLabel={t('cardioTraining.resume')}
      onPress={() => router.push({ pathname: '/cardio-workout', params: { id: w.id } })} style={{ ...surfaces.hero, padding: 20, minHeight: 70, borderRadius: radius.lg }}>
      <Text style={{ color: colors.accentText, fontSize: 19 }}>{t('cardioTraining.resume')} · {t(`cardioPlan.${w.prescription.modality}`)}</Text>
    </Pressable>)}
    {blocks.entries.map(b => <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={t('cardioTraining.openBlock', { name: b.proposal.name })}
      onPress={() => router.push({ pathname: '/cardio-block', params: { id: b.id } })} style={{ ...surfaces.card, padding: 18, borderRadius: radius.lg, minHeight: 90, gap: 8 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 21, fontWeight: '700' }}>{b.proposal.name} ›</Text>
      <Text style={{ color: colors.bioText }}>{t(b.endedAt === null ? 'cardioTraining.active' : 'cardioTraining.ended')} · {b.startDate}</Text>
      <Text style={{ color: colors.textSecondary }}>{t('cardioTraining.progress', { done: b.slots.filter(s => workouts.entries.some(w => w.blockId === b.id && w.slotId === s.id && w.status === 'FINISHED')).length, total: b.slots.filter(s => s.disposition === 'CARDIO').length })}</Text>
    </Pressable>)}
    {(blocks.entries.filter(b => b.endedAt === null).length > 1 || workouts.entries.filter(w => w.status === 'RUNNING' || w.status === 'PAUSED').length > 1) && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.conflict')}</Text>}
    {(blocks.pending || workouts.pending) && <Text style={{ color: colors.textSecondary }}>{t('cardioSaved.pending')}</Text>}
    {(blocks.error || workouts.error) && <Pressable accessibilityRole="button" accessibilityLabel={t('home.retry')} onPress={() => { blocks.reload(); workouts.reload(); }} style={{ minHeight: 48 }}>
      <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.saveFailed')} · {t('home.retry')}</Text>
    </Pressable>}
  </View>;
}
