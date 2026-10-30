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

export default function CardioCheck() {
  const { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const [block, setBlock] = useState(() => cardioFixture({}, Date.now())), [workouts, setWorkouts] = useState<CardioWorkout[]>([]), [selected, setSelected] = useState<string | null>(null), [error, setError] = useState(false);
  if (selected) return <CardioWorkoutPanel id={selected} onExit={() => setSelected(null)} workouts={{ owner: 'owner', entries: workouts, ready: true, error: false, pending: false,
    newId: () => 'synthetic-run', reload: () => undefined, save: async next => { setWorkouts(old => [...old.filter(w => w.id !== next.id), next]); return next; } }} />;
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 25, marginBottom: 16 }}>CARDIO CHECK · memory only</Text>
    <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>Fabricated 8-day cycle · no account writes or sensor readings</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Preview completed cycle (fixture)" style={{ minHeight: 48 }} onPress={() => {
      const now = Date.now(), earlier = now - 9 * 86400000, source = cardioFixture({ sessionMinutes: 40, cardioMinutes: 120 }, earlier);
      const next = withCardioProgression(createCardioBlock('block', source.proposal, shiftCalendarDate(dateInZone(now, source.timeZone), -8), 4, source.timeZone, earlier));
      setBlock(next); setWorkouts(next.slots.filter(s => s.cycle === 0).map((s, i) => {
        const run = startCardioWorkout(next, s.id, earlier, `synthetic-completed-${i}`);
        return transitionCardioWorkout(run, 'FINISH', now - 86400000, run.prescription.durationSeconds, 3);
      }));
    }}><Text style={{ color: colors.accentText }}>Preview completed cycle (fixture)</Text></Pressable>
    <CardioProgressionReview block={block} workouts={workouts} enabled onSave={async next => setBlock(next)} />
    {error && <Text style={{ color: colors.textPrimary }}>Fixture start failed</Text>}
    <CardioTimeline block={block} sports={[]} strength={[]} workouts={workouts} onOpen={(slot, previous) => {
      if (previous) { setSelected(previous.id); return; }
      try { const next = startCardioWorkout(block, slot.id, Date.now(), `synthetic-${slot.id}`); setWorkouts(old => [...old.filter(w => w.id !== next.id), next]); setSelected(next.id); }
      catch { setError(true); }
    }} />
  </ScrollView>;
}
