import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { useHealthExport } from '@/hooks/useHealthExport';
import { healthWorkout } from '@/services/health/workoutExport';
import { WorkoutHealthExport } from '@/components/train/WorkoutHealthExport';
import { WorkoutHistoryDetails } from '@/components/train/WorkoutHistoryDetails';
import { WorkoutHistoryEditor } from '@/components/train/WorkoutHistoryEditor';
import { workoutHistoryDetails } from '@/services/training/workoutHistory';
import { formatWorkoutTime } from '@/services/training/workoutRuntime';

export default function HistoryScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { uid } = useAuth(); const { exercisesById } = useExerciseCatalogue(); const { t, i18n } = useTranslation();
  const { colors, typography, sectionAccent, radius, spacing, semantic } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [history, setHistory] = useState<WorkoutSession[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); const [deleting, setDeleting] = useState<WorkoutSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<WorkoutSession | null>(null);
  const openedEditor = useRef<string | null>(null);
  const owner = useRef(uid); owner.current = uid;
  const back = () => router.canGoBack() ? router.back() : router.replace('/history');
  const health = useHealthExport();
  const deletingPayload = deleting && uid ? healthWorkout(deleting, uid) : null;
  const deletingEntry = deletingPayload ? health.entries[deletingPayload.identity] : undefined;
  const deleteWorkout = async (alsoHealth: boolean) => {
    if (!deleting || !uid || deleting.userId !== uid || busy) return;
    setBusy(true); setError(false);
    try {
      if (!await health.service.remove(deleting, alsoHealth, () => workoutSessionRepository.discardLocally(deleting))) throw Error('Discard failed');
      setHistory((old) => old.filter((item) => item.id !== deleting.id)); back();
    } catch { setError(true); } finally { setBusy(false); }
  };
  useFocusEffect(useCallback(() => { let alive = true; setHistory([]); setLoading(true); if (!uid) return;
    workoutSessionRepository.listByUser(uid).then((items) => { if (alive) { setHistory(items.filter((item) => item.userId === uid)); setError(false); setLoading(false); } })
      .catch(() => { if (alive) { setError(true); setLoading(false); } }); return () => { alive = false; };
  }, [uid, id]));
  useEffect(() => {
    const key = `${uid}:${id}`;
    if (loading || edit !== '1' || !uid || openedEditor.current === key) return;
    const session = history.find((item) => item.id === id && item.userId === uid
      && item.completedAt !== undefined && item.discardedAt === undefined);
    if (session) { openedEditor.current = key; setEditing(session); }
  }, [loading, edit, uid, id, history]);
  const timestamp = (session: WorkoutSession) => typeof session.performedAt === 'number' ? session.performedAt : session.performedAt.seconds * 1000;
  return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }}>
      <Pressable accessibilityRole="button" onPress={back} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[typography.body, { color: colors.accentText }]}>{t('generate.back')}</Text></Pressable>
      <Text style={[typography.emphasis, { color: colors.textPrimary, marginBottom: 20 }]}>{t('workout.history')}</Text>
      {loading && <ActivityIndicator color={sectionAccent.train} />}
      {error && <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{t('workout.historyError')}</Text>}
      {!loading && !history.some((item) => item.id === id && item.userId === uid) && <Text style={{ color: colors.textMuted }}>{t('workout.historyEmpty')}</Text>}
      {history.filter((item) => item.id === id && item.userId === uid).map((session) => {
        const exercises = [...session.exercises].sort((a, b) => a.order - b.order).map((entry) => entry.exerciseSnapshot ?? exercisesById.get(entry.exerciseId)).filter((ex): ex is Exercise => !!ex);
        const summary = workoutReview(exercises, toSessionSetsByExercise(session), history.filter((other) => timestamp(other) < timestamp(session)), session.id);
        const details = workoutHistoryDetails(session, exercisesById);
        return <View key={session.id} style={{ padding: 18, marginBottom: 14, borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <View>
            <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{session.sessionName || t('historyDetails.workout')}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 6 }}>{new Date(timestamp(session)).toLocaleDateString(i18n.language)} · M{session.microcycleIndex + 1}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{details.working} {t('workout.workingSets')} · {details.exercises.length} {t('historyDetails.exercises')}
              {details.durationSeconds !== null ? ` · ${formatWorkoutTime(details.durationSeconds)}` : ''}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{Math.round(details.tonnage).toLocaleString(i18n.language)} kg × reps
              {details.meanRIR !== null ? ` · RIR ${details.meanRIR.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}` : ''}
              {details.warmups ? ` · ${details.warmups} W` : ''}</Text>
            {summary.records.length > 0 && <Text style={{ color: colors.accentText, marginTop: 6 }}>{summary.records.length} PR</Text>}
            {!session.completedAt && <Text style={{ color: colors.accentText }}>{t('workout.inProgress')}</Text>}
          </View>
          <WorkoutHistoryDetails details={details} recordSetIds={summary.recordSetIds} /><BodyMap height={180} paint={heatPaint(summary.volumes, sectionAccent.train)} /><WorkoutHealthExport session={session} />
          {!!session.completedAt && <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(session)} style={{ minHeight: 48, justifyContent: 'center', marginTop: 10 }}><Text style={{ color: colors.accentText, fontWeight: '700' }}>{t('historyEdit.title')}</Text></Pressable>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(session)} style={{ paddingVertical: 14, marginTop: 10 }}><Text style={{ color: semantic.danger, fontWeight: '700' }}>{t('workout.discard')}</Text></Pressable>
        </View>;
      })}
    </ScrollView>
    {editing && editing.userId === uid && <WorkoutHistoryEditor key={editing.id} session={editing} onClose={() => setEditing(null)} onSave={async (draft) => {
      if (!uid || owner.current !== uid) throw Error('invalidOwner');
      const saved = await workoutSessionRepository.editCompletedLocally(editing, uid, draft, () => owner.current === uid);
      if (owner.current === uid) setHistory((items) => items.map((item) => item.id === saved.id ? saved : item));
    }} />}
    <ActionMenuSheet title={deleting ? t('workout.discard') : null} subtitle={t(deletingEntry ? 'health.deleteHint' : 'workout.discardHint')} onClose={() => setDeleting(null)}
      actions={[
        { label: t(deletingEntry ? 'health.deleteVigor' : 'workout.discardConfirm'), tone: 'danger', onPress: () => { void deleteWorkout(false); } },
        ...(deletingEntry && deletingEntry.status !== 'deleted' ? [{ label: t('health.deleteBoth'), tone: 'danger' as const, onPress: () => { void deleteWorkout(true); } }] : []),
        { label: t('generate.cancel'), onPress: () => {} },
      ]} />
  </View>;
}
