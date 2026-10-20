import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/useTheme';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { workoutSessionRepository } from '@/services/repositories';
import type { Exercise, WorkoutSession } from '@/models';
import { toSessionSetsByExercise } from '@/services/training/sessionMapper';
import { workoutReview } from '@/services/training/workoutReview';
import { ActionMenuSheet } from '@/components/train/ActionMenuSheet';
import { BodyMap } from '@/components/train/BodyMap';
import { heatPaint } from '@/services/training/bodyMap';
import { backToTraining } from '@/services/training/backNavigation';

export default function HistoryScreen() {
  const { uid } = useAuth(); const { exercisesById } = useExerciseCatalogue(); const { t, i18n } = useTranslation();
  const { colors, typography, sectionAccent, radius, spacing } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [history, setHistory] = useState<WorkoutSession[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); const [deleting, setDeleting] = useState<WorkoutSession | null>(null);
  const [busy, setBusy] = useState(false); const [expanded, setExpanded] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { let alive = true; if (!uid) return;
    workoutSessionRepository.listByUser(uid).then((items) => { if (alive) { setHistory(items); setError(false); setLoading(false); } })
      .catch(() => { if (alive) { setError(true); setLoading(false); } }); return () => { alive = false; };
  }, [uid]));
  const timestamp = (session: WorkoutSession) => typeof session.performedAt === 'number' ? session.performedAt : session.performedAt.seconds * 1000;
  return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }}>
      <Pressable onPress={() => backToTraining(router)} style={{ paddingVertical: 12 }}><Text style={{ color: sectionAccent.train }}>{t('generate.back')}</Text></Pressable>
      <Text style={[typography.emphasis, { color: colors.textPrimary, marginBottom: 20 }]}>{t('workout.history')}</Text>
      {loading && <ActivityIndicator color={sectionAccent.train} />}
      {error && <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{t('workout.historyError')}</Text>}
      {!loading && !history.length && <Text style={{ color: colors.textMuted }}>{t('workout.historyEmpty')}</Text>}
      {[...history].sort((a, b) => timestamp(b) - timestamp(a)).map((session) => {
        const exercises = [...session.exercises].sort((a, b) => a.order - b.order).map((entry) => entry.exerciseSnapshot ?? exercisesById.get(entry.exerciseId)).filter((ex): ex is Exercise => !!ex);
        const summary = workoutReview(exercises, toSessionSetsByExercise(session), history.filter((other) => timestamp(other) < timestamp(session)), session.id);
        return <View key={session.id} style={{ padding: 18, marginBottom: 14, borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <Pressable onPress={() => setExpanded(expanded === session.id ? null : session.id)}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{new Date(timestamp(session)).toLocaleDateString(i18n.language)} · M{session.microcycleIndex + 1}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{summary.completed} {t('workout.workingSets')} · {Math.round(summary.tonnage)} kg × reps</Text>
            <Text numberOfLines={2} style={{ color: colors.textMuted, marginTop: 6 }}>{exercises.map((ex) => ex.name).join(' · ')}</Text>
            {!session.completedAt && <Text style={{ color: sectionAccent.train }}>{t('workout.inProgress')}</Text>}
          </Pressable>
          {expanded === session.id && <BodyMap height={200} paint={heatPaint(summary.volumes, sectionAccent.train)} />}
          <Pressable disabled={busy} onPress={() => setDeleting(session)} style={{ paddingTop: 18 }}><Text style={{ color: colors.textSecondary }}>{t('workout.delete')}</Text></Pressable>
        </View>;
      })}
    </ScrollView>
    <ActionMenuSheet title={deleting ? t('workout.delete') : null} subtitle={t('workout.deleteHint')} onClose={() => setDeleting(null)}
      actions={[{ label: t('workout.deleteConfirm'), tone: 'danger', onPress: async () => {
        if (!deleting || !uid || deleting.userId !== uid || busy) return;
        setBusy(true); setError(false);
        try { await workoutSessionRepository.delete(deleting.id); setHistory((old) => old.filter((item) => item.id !== deleting.id)); }
        catch { setError(true); } finally { setBusy(false); }
      } }]} />
  </View>;
}
