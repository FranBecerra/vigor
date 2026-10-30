import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useCardioWorkouts } from '@/hooks/useCardioTraining';
import { cardioElapsed, cardioPhase, correctCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';
import { SessionEffortInput } from '@/components/train/SessionEffortInput';
import { NumericField } from '@/components/train/NumericField';
import { sessionEffortValue } from '@/services/training/sessionFeedback';
import type { CardioWorkout } from '@/models/cardioTraining';
import { backToTraining } from '@/services/training/backNavigation';

const duration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
export default function CardioWorkoutScreen() {
  const { uid } = useAuth(), { id } = useLocalSearchParams<{ id?: string }>();
  return <OwnedWorkout key={`${uid}:${id}`} id={id} />;
}
function OwnedWorkout({ id }: { id?: string }) {
  const workouts = useCardioWorkouts();
  return <CardioWorkoutPanel id={id} workouts={workouts} />;
}
/** The native acceptance fixture supplies an in-memory store, never athlete writes. */
export function CardioWorkoutPanel({ id, workouts, onExit }: { id?: string; workouts: ReturnType<typeof useCardioWorkouts>; onExit?: () => void }) {
  const router = useRouter(), insets = useSafeAreaInsets();
  const exit = () => onExit ? onExit() : router.dismissTo('/(tabs)/(train)');
  const back = () => onExit ? onExit() : backToTraining(router);
  const { t } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme();
  const workout = workouts.entries.find(w => w.id === id);
  const [now, setNow] = useState(Date.now()), [summary, setSummary] = useState(false), [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState<number | undefined>(), [effort, setEffort] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false), lock = useRef(false), live = useRef(false);
  useEffect(() => {
    live.current = true; const timer = setInterval(() => setNow(Date.now()), 500);
    const listener = AppState.addEventListener('change', () => setNow(Date.now()));
    return () => { live.current = false; clearInterval(timer); listener.remove(); };
  }, []);
  const action = async (next: () => CardioWorkout, done?: () => void) => {
    if (!workout || lock.current || !live.current || !workouts.ready || workouts.error) return;
    lock.current = true; setBusy(true); setError(false);
    try { await workouts.save(next(), workout); if (live.current) done?.(); }
    catch { if (live.current) setError(true); }
    finally { if (live.current) { lock.current = false; setBusy(false); } }
  };
  const button = (label: string, press: () => void, danger = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={press}
    style={{ ...surfaces.field, borderRadius: radius.md, minHeight: 48, padding: 14, marginTop: 12, justifyContent: 'center' }}>
    <Text style={{ fontSize: 17, color: danger ? semantic.danger : colors.accentText }}>{label}</Text>
  </Pressable>;
  const beginSummary = () => {
    if (!workout) return;
    const at = Date.now();
    const show = () => { setMinutes(Math.round(cardioElapsed(workout, at) / 600) / 100); setSummary(true); };
    if (workout.status === 'RUNNING') void action(() => transitionCardioWorkout(workout, 'PAUSE', at), show); else show();
  };
  const phase = workout ? cardioPhase(workout, now) : null;
  return <ScrollView style={{ flex: 1, ...surfaces.screen }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    {button(t('generate.back'), () => {
      if (editing || summary) { setEditing(false); setSummary(false); }
      else back();
    })}
    {!workouts.ready ? <ActivityIndicator /> : !workout || workout.status === 'DISCARDED' ? <Text style={{ color: colors.textPrimary }}>{t('cardioSaved.loadFailed')}</Text> : <>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 29, fontWeight: '700', marginVertical: 20 }}>{t(`cardioPlan.${workout.prescription.modality}`)}</Text>
      {workout.status === 'FINISHED' && !editing ? <>
        <Text style={{ color: colors.bioText, fontSize: 35, fontWeight: '700' }}>{duration(workout.actualSeconds! * 1000)}</Text>
        <Text style={{ color: colors.textSecondary, marginVertical: 12 }}>{workout.name} · {t('cardioTraining.recordedTime')}</Text>
        {sessionEffortValue(workout.feedback) !== null && <Text style={{ color: colors.textPrimary }}>{t('sessionEffort.summary', { value: sessionEffortValue(workout.feedback) })}</Text>}
        {button(t('cardioTraining.editResult'), () => { setMinutes(workout.actualSeconds! / 60); setEffort(sessionEffortValue(workout.feedback)); setEditing(true); })}
        {button(t('workout.done'), back)}
      </> : summary || editing ? <>
        <Text style={{ color: colors.textPrimary, fontSize: 23 }}>{t('cardioTraining.finishTitle')}</Text>
        <Text style={{ color: colors.textSecondary, marginVertical: 14 }}>{t('cardioTraining.actualMinutes')}</Text>
        <NumericField compact accessibilityLabel={t('cardioTraining.actualMinutes')} value={minutes} onChangeValue={setMinutes} editable={!busy} />
        <SessionEffortInput value={effort} onChange={setEffort} disabled={busy} />
        {button(t('cardioTraining.saveResult'), () => action(() => editing ? correctCardioWorkout(workout, Math.round(minutes! * 60), effort, Date.now())
          : transitionCardioWorkout(workout, 'FINISH', Date.now(), Math.round(minutes! * 60), effort), () => { setSummary(false); setEditing(false); if (!editing) exit(); }), false, minutes === undefined || !Number.isFinite(minutes) || minutes * 60 < 1 || minutes > 1440)}
        {button(t('cardioTraining.continue'), () => { if (editing) setEditing(false); else setSummary(false); })}
      </> : <>
        <View style={{ ...surfaces.hero, borderRadius: radius.lg, padding: 24, gap: 16 }}>
          <Text style={{ color: colors.bioText, fontSize: 18 }}>{t(`cardioPlan.${phase!.phase === 'READY' ? 'EASY' : phase!.phase}`)}</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 48, fontWeight: '700' }}>{duration(phase!.remaining * 1000)}</Text>
          <Text style={{ color: colors.textSecondary }}>{t('cardioTraining.elapsed')} {duration(cardioElapsed(workout, now))}</Text>
          {phase!.effort && <Text style={{ color: colors.textPrimary, fontSize: 18 }}>{t('cardioPlan.effortRange', phase!.effort)}</Text>}
          {phase!.phase === 'READY' && <Text style={{ color: colors.textPrimary }}>{t('cardioTraining.readyToFinish')}</Text>}
          <Text style={{ color: colors.textSecondary }}>{t('cardioPlan.talkTest')}</Text>
          {workout.prescription.allowWalking && <Text style={{ color: colors.textSecondary }}>{t('cardioPlan.walking')}</Text>}
        </View>
        {button(t(workout.status === 'RUNNING' ? 'cardioTraining.pause' : 'cardioTraining.resume'), () => action(() => transitionCardioWorkout(workout, workout.status === 'RUNNING' ? 'PAUSE' : 'RESUME', Date.now())))}
        {button(t('cardioTraining.finish'), beginSummary)}
        <Text style={{ color: colors.textSecondary, marginTop: 18 }}>{t('cardioTraining.timerNotice')}</Text>
      </>}
      {button(t('cardioTraining.discard'), () => Alert.alert(t('cardioTraining.discard'), t('cardioTraining.confirmDiscard'), [
        { text: t('generate.cancel'), style: 'cancel' }, { text: t('cardioTraining.discard'), style: 'destructive', onPress: () => action(() => transitionCardioWorkout(workout, 'DISCARD', Date.now()), exit) },
      ]), true)}
      {workouts.pending && <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('cardioSaved.pending')}</Text>}
    </>}
    {(error || workouts.error) && <>
      <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.saveFailed')}</Text>
      {button(t('home.retry'), workouts.reload)}
    </>}
  </ScrollView>;
}
