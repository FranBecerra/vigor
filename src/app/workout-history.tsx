import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/useTheme';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { mesocycleRepository, routineRepository, workoutSessionRepository } from '@/services/repositories';
import type { Exercise, WorkoutSession, Mesocycle } from '@/models';
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
import { historyProgressionProposal, historyProgressionPatch } from '@/services/training/historyProgression';
import { progressionFingerprint, type ProgressionStep } from '@/services/training/rirReplanning';
import { RIRProgressionPreview } from '@/components/train/RIRProgressionPreview';

export default function HistoryScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { uid } = useAuth(); const { exercisesById } = useExerciseCatalogue(); const { t, i18n } = useTranslation();
  const { surfaces, colors, typography, sectionAccent, radius, spacing, semantic } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [history, setHistory] = useState<WorkoutSession[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); const [deleting, setDeleting] = useState<WorkoutSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<WorkoutSession | null>(null);
  const [progression, setProgression] = useState<{ owner: string; workoutId: string; mesocycle: Mesocycle; goal: string; steps: ProgressionStep[] } | null>(null);
  const openedEditor = useRef<string | null>(null);
  const owner = useRef(uid); owner.current = uid;
  const flow = useRef({ key: `${uid}:${id}`, epoch: 0, mounted: true });
  if (flow.current.key !== `${uid}:${id}`) flow.current = { key: `${uid}:${id}`, epoch: flow.current.epoch + 1, mounted: true };
  const renderEpoch = flow.current.epoch;
  const isCurrent = () => owner.current === uid && flow.current.epoch === renderEpoch && flow.current.mounted;
  useEffect(() => { flow.current.mounted = true; return () => { flow.current.mounted = false; }; }, []);
  useEffect(() => { openedEditor.current = null; setEditing(null); setProgression(null); setBusy(false); }, [uid, id]);
  const back = () => router.canGoBack() ? router.back() : router.replace('/history');
  const health = useHealthExport();
  const openEditor = async (session: WorkoutSession) => {
    if (!uid || busy || !isCurrent()) return;
    setBusy(true);
    try {
      if (Number.isInteger(session.plannedSessionIndex) && session.plannedSessionIndex! >= 0) {
        const plan = await mesocycleRepository.get(session.mesocycleId);
        const template = plan?.routineId ? await routineRepository.get(plan.routineId) : null;
        if (!isCurrent()) return;
        if (plan?.userId === uid && template?.userId === uid && plan.plannedSessions?.some(item => item.index === session.plannedSessionIndex)) {
          router.push({ pathname: '/routine-editor', params: { mesocycleId: plan.id, microcycleIndex: String(session.microcycleIndex), plannedSessionIndex: String(session.plannedSessionIndex), edit: '1' } });
          return;
        }
      }
      if (isCurrent()) setEditing(session);
    } catch { if (isCurrent()) setEditing(session); }
    finally { if (isCurrent()) setBusy(false); }
  };
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
  return <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg, paddingTop: insets.top }}>
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
        return <View key={session.id} style={{ ...surfaces.card, padding: 18, marginBottom: 14, borderRadius: radius.lg }}>
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
          {!!session.completedAt && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void openEditor(session)} style={{ minHeight: 48, justifyContent: 'center', marginTop: 10 }}><Text style={{ color: colors.accentText, fontWeight: '700' }}>{t('historyEdit.title')}</Text></Pressable>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(session)} style={{ paddingVertical: 14, marginTop: 10 }}><Text style={{ color: semantic.danger, fontWeight: '700' }}>{t('workout.discard')}</Text></Pressable>
        </View>;
      })}
    </ScrollView>
    {editing && editing.userId === uid && <WorkoutHistoryEditor key={editing.id} session={editing} onClose={() => setEditing(null)} onSave={async (draft, reviewProgression) => {
      if (!uid || !isCurrent()) throw Error('invalidOwner');
      const saved = await workoutSessionRepository.editCompletedLocally(editing, uid, draft, isCurrent);
      if (isCurrent()) setHistory((items) => items.map((item) => item.id === saved.id ? saved : item));
      if (reviewProgression && isCurrent()) {
        try {
          const mesocycle = await mesocycleRepository.get(saved.mesocycleId), goal = saved.trainingGoal ?? 'HYPERTROPHY';
          if (!mesocycle || mesocycle.userId !== uid || !isCurrent()) throw Error('Missing plan');
          const steps = historyProgressionProposal(mesocycle, goal, saved, history.map(s => s.id === saved.id ? saved : s));
          if (!steps.length) Alert.alert(t('progression.recalculate'), t('historyProgression.noChanges'));
          else setProgression({ owner: uid, workoutId: saved.id, mesocycle, goal, steps });
        } catch { if (isCurrent()) Alert.alert(t('workout.saved'), t('historyProgression.failed')); }
      }
    }} />}
    <RIRProgressionPreview steps={progression?.owner === uid ? progression.steps : null} catalogue={exercisesById} busy={busy}
      onClose={() => setProgression(null)} onApply={async () => {
        if (!progression || busy || !uid || progression.owner !== uid || !isCurrent()) return;
        setBusy(true);
        try {
          const fresh = await mesocycleRepository.get(progression.mesocycle.id);
          if (!isCurrent()) return;
          const actuals = await workoutSessionRepository.listByUser(uid);
          const workout = actuals.find(s => s.id === progression.workoutId && s.userId === uid);
          if (!fresh || fresh.userId !== uid || !workout || !isCurrent()) throw Error('Missing context');
          const steps = historyProgressionProposal(fresh, progression.goal, workout, actuals);
          if (progressionFingerprint(steps) !== progressionFingerprint(progression.steps)) throw Error('Stale progression');
          await mesocycleRepository.update(fresh.id, { ...historyProgressionPatch(fresh, steps), updatedAt: Date.now() });
          if (isCurrent()) setProgression(null);
        } catch { if (isCurrent()) Alert.alert(t('progression.recalculate'), t('progression.stale')); }
        finally { if (isCurrent()) setBusy(false); }
      }} />
    <ActionMenuSheet title={deleting ? t('workout.discard') : null} subtitle={t(deletingEntry ? 'health.deleteHint' : 'workout.discardHint')} onClose={() => setDeleting(null)}
      actions={[
        { label: t(deletingEntry ? 'health.deleteVigor' : 'workout.discardConfirm'), tone: 'danger', onPress: () => { void deleteWorkout(false); } },
        ...(deletingEntry && deletingEntry.status !== 'deleted' ? [{ label: t('health.deleteBoth'), tone: 'danger' as const, onPress: () => { void deleteWorkout(true); } }] : []),
        { label: t('generate.cancel'), onPress: () => {} },
      ]} />
  </View>;
}
