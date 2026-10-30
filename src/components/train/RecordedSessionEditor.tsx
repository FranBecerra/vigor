import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useTheme } from '@/theme/useTheme';
import { mesocycleRepository, workoutSessionRepository } from '@/services/repositories';
import { historyProgressionPatch, historyProgressionProposal } from '@/services/training/historyProgression';
import { progressionFingerprint, type ProgressionStep } from '@/services/training/rirReplanning';
import { workoutHistoryDetails } from '@/services/training/workoutHistory';
import type { Mesocycle, WorkoutSession } from '@/models';
import { WorkoutHistoryEditor } from './WorkoutHistoryEditor';
import { WorkoutHistoryDetails } from './WorkoutHistoryDetails';
import { RIRProgressionPreview } from './RIRProgressionPreview';

/** Edit the exact recorded execution inside the routine, without changing the navigation stack. */
export function RecordedSessionEditor({ workoutId, mesocycleId, cycle, sessionIndex, editing,
  onClose, onSaved, onDirtyChange, onBusyChange }: {
  workoutId: string; mesocycleId: string; cycle: number; sessionIndex: number; editing: boolean;
  onClose: (saved?: boolean) => void; onSaved: () => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const { uid } = useAuth(); const { t } = useTranslation(); const { colors } = useTheme();
  const { exercisesById } = useExerciseCatalogue();
  const [record, setRecord] = useState<WorkoutSession | null>(null);
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false);
  const [progression, setProgression] = useState<{ mesocycle: Mesocycle; goal: string; steps: ProgressionStep[] } | null>(null);
  const key = `${uid}:${mesocycleId}:${cycle}:${sessionIndex}:${workoutId}`;
  const context = useRef({ key, mounted: true, epoch: 0 });
  if (context.current.key !== key) context.current = { key, mounted: true, epoch: context.current.epoch + 1 };
  const epoch = context.current.epoch;
  useEffect(() => { context.current.mounted = true; return () => { context.current.mounted = false; }; }, []);
  const isCurrent = () => context.current.mounted && context.current.key === key && context.current.epoch === epoch;
  useEffect(() => {
    let alive = true; setRecord(null); setFailed(false); setProgression(null);
    if (!uid) return;
    workoutSessionRepository.get(workoutId).then(value => {
      if (!alive) return;
      if (!value || value.id !== workoutId || value.userId !== uid || value.mesocycleId !== mesocycleId || value.microcycleIndex !== cycle
        || value.plannedSessionIndex !== sessionIndex || value.completedAt === undefined || value.discardedAt !== undefined) throw Error('Unavailable execution');
      setRecord(value);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [key, attempt]);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  if (failed) return <View style={{ gap: 12 }}>
    <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{t('workout.historyError')}</Text>
    <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: colors.accentText }}>{t('home.retry')}</Text>
    </Pressable>
  </View>;
  if (!record || record.userId !== uid || record.id !== workoutId || record.mesocycleId !== mesocycleId
    || record.microcycleIndex !== cycle || record.plannedSessionIndex !== sessionIndex) return <ActivityIndicator color={colors.accentText} />;
  return <>
    {editing ? <WorkoutHistoryEditor key={key} inline session={record}
      onDirtyChange={onDirtyChange} onBusyChange={onBusyChange} onClose={() => onClose(false)} onSavedClose={() => onClose(true)} onSave={async (draft, review) => {
        if (!uid || !isCurrent()) throw Error('Invalid editor owner');
        const saved = await workoutSessionRepository.editCompletedLocally(record, uid, draft, isCurrent);
        if (!isCurrent()) return;
        setRecord(saved); onDirtyChange(false); onSaved();
        if (review) {
          try {
            const plan = await mesocycleRepository.get(mesocycleId);
            const history = await workoutSessionRepository.listByUser(uid);
            if (!isCurrent()) return;
            if (!plan || plan.userId !== uid) throw Error('Missing plan');
            const goal = saved.trainingGoal ?? 'HYPERTROPHY';
            const steps = historyProgressionProposal(plan, goal, saved, history.map(item => item.id === saved.id ? saved : item));
            if (!steps.length) Alert.alert(t('progression.recalculate'), t('historyProgression.noChanges'));
            else setProgression({ mesocycle: plan, goal, steps });
          } catch { if (isCurrent()) Alert.alert(t('workout.saved'), t('historyProgression.failed')); }
        }
      }} /> : <WorkoutHistoryDetails details={workoutHistoryDetails(record, exercisesById)} />}
    <RIRProgressionPreview steps={progression?.steps ?? null} catalogue={exercisesById} busy={busy}
      onClose={() => setProgression(null)} onApply={async () => {
        if (!uid || !progression || busy || !isCurrent()) return;
        setBusy(true);
        try {
          const plan = await mesocycleRepository.get(mesocycleId);
          const history = await workoutSessionRepository.listByUser(uid);
          if (!isCurrent()) return;
          const actual = history.find(item => item.id === workoutId && item.userId === uid);
          if (!plan || plan.userId !== uid || !actual) throw Error('Missing context');
          const steps = historyProgressionProposal(plan, progression.goal, actual, history);
          if (progressionFingerprint(steps) !== progressionFingerprint(progression.steps)) throw Error('Stale preview');
          await mesocycleRepository.update(plan.id, { ...historyProgressionPatch(plan, steps), updatedAt: Date.now() });
          if (isCurrent()) { setProgression(null); onSaved(); }
        } catch { if (isCurrent()) Alert.alert(t('progression.recalculate'), t('progression.stale')); }
        finally { if (isCurrent()) setBusy(false); }
      }} />
  </>;
}
