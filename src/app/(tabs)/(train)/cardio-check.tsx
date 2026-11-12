/** Authenticated native acceptance fixture. Memory-only, no training/Health reads or writes. */
import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardioTimeline } from '@/components/cardio/CardioTimeline';
import { CardioWorkoutPanel } from './cardio-workout';
import { cardioFixture } from '@/test-support/cardioFixture';
import { startCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';
import { createCardioBlock, dateInZone } from '@/services/cardio/cardioBlock';
import { withCardioProgression } from '@/services/cardio/cardioProgression';
import { CardioProgressionReview } from '@/components/cardio/CardioProgressionReview';
import { shiftCalendarDate } from '@/services/training/trainingCalendar';
import type { CardioWorkout } from '@/models/cardioTraining';
import type { SportActivity } from '@/models/sportActivity';
import { SportActivityForm } from '@/components/cardio/SportActivityForm';
import { createSportActivitySeries } from '@/services/cardio/sportActivitySeries';
import { saveSportDraft } from '@/services/cardio/sportActivities';
import { HybridPlanBuilder } from '@/components/cardio/HybridPlanBuilder';
import { hybridFixture } from '@/test-support/hybridFixture';
import { HybridCapacityCheck } from '@/test-support/HybridCapacityCheck';
import { WorkoutFinishSheet } from '@/components/train/WorkoutFinishSheet';
import { completedBlockAfterWorkout } from '@/services/training/mesocycleContinuity';
import { workoutReview } from '@/services/training/workoutReview';
import { toSessionSetsByExercise } from '@/services/training/sessionMapper';
import { MesocycleContinuityFlow } from '@/components/train/MesocycleContinuityFlow';
import { continuityAutomaticFixture, continuityComparisonFixture, continuityFixture } from '@/test-support/continuityFixture';
import { PlanningHistoryCheck } from '@/test-support/PlanningHistoryCheck';
import { CardioHomeCheck } from '@/test-support/CardioHomeCheck';

export default function CardioCheck() {
  const { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const [block, setBlock] = useState(() => cardioFixture({}, Date.now())), [workouts, setWorkouts] = useState<CardioWorkout[]>([]), [selected, setSelected] = useState<string | null>(null), [error, setError] = useState(false);
  const [sportEditor, setSportEditor] = useState<'NEW' | SportActivity | null>(null), [sportEntries, setSportEntries] = useState<SportActivity[]>([]);
  const [failSportSave, setFailSportSave] = useState(false);
  const [hybridOpen, setHybridOpen] = useState(false), [hybridSaved, setHybridSaved] = useState(false);
  const [failHybridSave, setFailHybridSave] = useState(false);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [continuity, setContinuity] = useState<(ReturnType<typeof continuityFixture> & Partial<Pick<ReturnType<typeof continuityComparisonFixture>, 'feedback'>>) | null>(null);
  const [continuityResult, setContinuityResult] = useState<number | null>(null);
  const [failContinuity, setFailContinuity] = useState(true);
  const [finishContinuity, setFinishContinuity] = useState<{ fixture: ReturnType<typeof continuityFixture>; final: boolean } | null>(null);
  if (finishContinuity) {
    const { fixture, final } = finishContinuity;
    const { data } = fixture;
    const workout = data.history.at(-1)!;
    const exercises = workout.exercises.flatMap(entry => entry.exerciseSnapshot ?? []);
    return <WorkoutFinishSheet open saved busy={false} error={false} changed={false} historyReady exercises={exercises}
      summary={workoutReview(exercises, toSessionSetsByExercise(workout), data.history.slice(0, -1), workout.id)}
      onFinish={() => {}} onClose={() => {
        setFinishContinuity(null);
        const source = final ? data.source : { ...data.source, projectedMicrocycles: 5 };
        if (completedBlockAfterWorkout(source, data.routine.generation.goal, data.history.slice(0, -1), workout, data.now)) setContinuity(fixture);
      }} />;
  }
  if (continuity) return <MesocycleContinuityFlow data={continuity.data} catalogue={continuity.exercises} feedback={continuity.feedback}
    onCancel={() => setContinuity(null)} onReload={() => setContinuity(continuityComparisonFixture())}
    onSave={async selection => {
      if (failContinuity) { setFailContinuity(false); throw Error('syntheticContinuityFailure'); }
      setContinuityResult(selection.microcycles); setContinuity(null);
    }} />;
  if (homeOpen) return <CardioHomeCheck onExit={() => setHomeOpen(false)} />;
  if (historyOpen) return <PlanningHistoryCheck onExit={() => setHistoryOpen(false)} />;
  if (capacityOpen) return <HybridCapacityCheck onExit={() => setCapacityOpen(false)} />;
  if (hybridOpen) {
    const source = hybridFixture();
    return <HybridPlanBuilder initialStrength={source.draft} exercises={source.exercises} onCancel={() => setHybridOpen(false)} onSave={async () => {
      if (failHybridSave) { setFailHybridSave(false); throw Error('syntheticHybridFailure'); }
      setHybridSaved(true); setHybridOpen(false);
    }} />;
  }
  if (sportEditor) return <SportActivityForm key={typeof sportEditor === 'string' ? 'new' : sportEditor.id}
    activity={typeof sportEditor === 'string' ? null : sportEditor} mode="PLAN" onCancel={() => setSportEditor(null)} onSave={async (draft) => {
      if (failSportSave) { setFailSportSave(false); throw Error('syntheticSaveFailure'); }
      if (draft.repeat && typeof sportEditor !== 'string') throw Error('invalidSportRecurrence');
      const next = draft.repeat ? Object.values(createSportActivitySeries('synthetic-series', 'owner', draft, Date.now()).occurrences)
        : [saveSportDraft(typeof sportEditor === 'string' ? 'synthetic-one' : sportEditor.id, 'owner', draft, Date.now(),
          typeof sportEditor === 'string' ? undefined : sportEditor)];
      setSportEntries((old) => typeof sportEditor === 'string' ? next : old.map((entry) => entry.id === next[0].id ? next[0] : entry));
      setSportEditor(null);
    }} />;
  if (selected) return <CardioWorkoutPanel id={selected} onExit={() => setSelected(null)} workouts={{ owner: 'owner', entries: workouts, ready: true, error: false, pending: false,
    newId: () => 'synthetic-run', reload: () => undefined, save: async next => { setWorkouts(old => [...old.filter(w => w.id !== next.id), next]); return next; } }} />;
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 25, marginBottom: 16 }}>CARDIO CHECK · memory only</Text>
    <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>Fabricated 8-day cycle · no account writes or sensor readings</Text>
    {process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS === '1' && <>
      <Pressable accessibilityRole="button" accessibilityLabel="Preview active cardio routines (memory only)" onPress={() => setHomeOpen(true)} style={{ minHeight: 48 }}>
        <Text style={{ color: colors.accentText }}>Preview active cardio routines (memory only)</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={{ minHeight: 48 }} onPress={() => {
        setContinuityResult(null); setFailContinuity(true); setContinuity(continuityComparisonFixture());
      }}><Text style={{ color: colors.accentText }}>Preview mesocycle continuity (memory only)</Text></Pressable>
      <Pressable accessibilityRole="button" style={{ minHeight: 48 }} onPress={() => {
        setContinuityResult(null); setFailContinuity(true); setContinuity(continuityAutomaticFixture());
      }}><Text style={{ color: colors.accentText }}>Preview automatic continuity (memory only)</Text></Pressable>
      {[true, false].map(final => <Pressable key={String(final)} accessibilityRole="button" style={{ minHeight: 48 }}
        onPress={() => setFinishContinuity({ fixture: continuityFixture(), final })}>
        <Text style={{ color: colors.accentText }}>{final ? 'Finish final strength workout (memory only)' : 'Finish regular strength workout (memory only)'}</Text>
      </Pressable>)}
      {continuityResult !== null && <Text style={{ color: colors.textPrimary }}>Synthetic successor activated · {continuityResult} microcycles</Text>}
    </>}
    <Pressable accessibilityRole="button" accessibilityLabel="Preview planning history (memory only)" style={{ minHeight: 48 }} onPress={() => setHistoryOpen(true)}>
      <Text style={{ color: colors.accentText }}>Preview planning history (memory only)</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Preview shared capacity (memory only)" style={{ minHeight: 48 }} onPress={() => setCapacityOpen(true)}>
      <Text style={{ color: colors.accentText }}>Preview shared capacity (memory only)</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Preview hybrid authoring (memory only)" style={{ minHeight: 48 }} onPress={() => { setFailHybridSave(true); setHybridSaved(false); setHybridOpen(true); }}>
      <Text style={{ color: colors.accentText }}>Preview hybrid authoring (memory only)</Text>
    </Pressable>
    {hybridSaved && <Text style={{ color: colors.textPrimary }}>Synthetic hybrid proposal saved in memory only</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Preview recurring activity (memory only)" style={{ minHeight: 48 }} onPress={() => { setSportEntries([]); setFailSportSave(false); setSportEditor('NEW'); }}>
      <Text style={{ color: colors.accentText }}>Preview recurring activity (memory only)</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Preview recurring save failure (memory only)" style={{ minHeight: 48 }} onPress={() => { setSportEntries([]); setFailSportSave(true); setSportEditor('NEW'); }}>
      <Text style={{ color: colors.accentText }}>Preview recurring save failure (memory only)</Text>
    </Pressable>
    {!!sportEntries.length && <>
      <Text style={{ color: colors.textPrimary }}>Synthetic activities saved in memory only: {sportEntries.length}</Text>
      {sportEntries.slice(0, 3).map((entry) => <Text key={entry.id} style={{ color: colors.textSecondary }}>{entry.name || entry.sport} · {new Date(entry.planned!.startAt).toISOString()}</Text>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Edit first occurrence (memory only)" style={{ minHeight: 48 }} onPress={() => setSportEditor(sportEntries[0])}>
        <Text style={{ color: colors.accentText }}>Edit first occurrence (memory only)</Text>
      </Pressable>
    </>}
    <Pressable accessibilityRole="button" accessibilityLabel="Preview completed cycle (fixture)" style={{ minHeight: 48 }} onPress={() => {
      const now = Date.now(), earlier = now - 9 * 86400000, source = cardioFixture({ sessionMinutes: 40, cardioMinutes: 120 }, earlier);
      const next = withCardioProgression(createCardioBlock('block', source.proposal, shiftCalendarDate(dateInZone(now, source.timeZone), -8), 4, source.timeZone, earlier));
      setBlock(next); setWorkouts(next.slots.filter(s => s.cycle === 0).map((s, i) => {
        const run = startCardioWorkout(next, s.id, earlier, `synthetic-completed-${i}`);
        return transitionCardioWorkout(run, 'FINISH', now - 86400000, run.prescription.durationSeconds, 3);
      }));
    }}><Text style={{ color: colors.accentText }}>Preview completed cycle (fixture)</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Preview just-activated block (fixture)" style={{ minHeight: 48 }} onPress={() => {
      const now = Date.now(), source = cardioFixture({ sessionMinutes: 40, cardioMinutes: 120 }, now);
      setBlock(withCardioProgression(createCardioBlock('block', source.proposal, dateInZone(now, source.timeZone), 4, source.timeZone, now))); setWorkouts([]);
    }}><Text style={{ color: colors.accentText }}>Preview just-activated block (fixture)</Text></Pressable>
    <CardioProgressionReview block={block} workouts={workouts} enabled onSave={async next => setBlock(next)} />
    {error && <Text style={{ color: colors.textPrimary }}>Fixture start failed</Text>}
    <CardioTimeline block={block} sports={[]} strength={[]} workouts={workouts} onOpen={(slot, previous) => {
      if (previous) { setSelected(previous.id); return; }
      try { const next = startCardioWorkout(block, slot.id, Date.now(), `synthetic-${slot.id}`); setWorkouts(old => [...old.filter(w => w.id !== next.id), next]); setSelected(next.id); }
      catch { setError(true); }
    }} />
  </ScrollView>;
}
