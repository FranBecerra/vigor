import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/useTheme';
import { cardioHomeFixture } from './cardioHomeFixture';
import { RoutineCard } from '@/components/home/RoutineCard';
import { TrainingCalendarCard } from '@/components/train/TrainingCalendarCard';
import { CardioRoutineCard } from '@/components/cardio/CardioRoutineCard';
import { CardioTimeline } from '@/components/cardio/CardioTimeline';
import { CardioWorkoutPanel } from '@/app/(tabs)/(train)/cardio-workout';
import type { CardioWorkout } from '@/models/cardioTraining';
import type { CardioHomeSession } from '@/services/cardio/cardioHome';
import { startCardioWorkout } from '@/services/cardio/cardioWorkout';

export function CardioHomeCheck({ onExit }: { onExit(): void }) {
  const { uid } = useAuth(), { t, i18n } = useTranslation(), { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const sample = useMemo(() => cardioHomeFixture(uid ?? 'owner'), [uid]);
  const [meso, setMeso] = useState(sample.routine.mesocycleSnapshot!), [expanded, setExpanded] = useState(true);
  const [cycle, setCycle] = useState<number | null>(null), [workouts, setWorkouts] = useState<CardioWorkout[]>([]), [running, setRunning] = useState<string | null>(null);
  const routine = { ...sample.routine, mesocycleSnapshot: meso };
  const open = (entry: CardioHomeSession) => { if (entry.workout) setRunning(entry.workout.id); else setCycle(entry.slot.cycle); };
  if (running) return <CardioWorkoutPanel id={running} onExit={() => setRunning(null)} workouts={{ owner: uid ?? 'owner', entries: workouts,
    ready: true, error: false, pending: false, reload: () => {}, newId: () => 'home-run', save: async next => {
      setWorkouts(old => [...old.filter(w => w.id !== next.id), next]); return next;
    } }} />;
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    <Pressable accessibilityRole="button" onPress={cycle === null ? onExit : () => setCycle(null)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>{cycle === null ? 'Close cardio home fixture' : 'Back to active routines'}</Text></Pressable>
    <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 16 }}>Active routines · memory only</Text>
    {cycle !== null ? <CardioTimeline key={cycle} initialCycle={cycle} block={sample.block} workouts={workouts} sports={[]} strength={[]}
      onOpen={(slot, workout) => { const next = workout ?? startCardioWorkout(sample.block, slot.id, Date.now(), `home-run-${slot.id}`);
        if (!workout) setWorkouts(old => [...old, next]); setRunning(next.id); }} /> : <>
      <RoutineCard routine={routine} expanded={expanded} selectedSessionId="" locale={i18n.language} muscleLabel={m => t(`muscle.${m}`)}
        labels={{ sessions: t('home.sessions'), sets: t('home.sets'), today: t('home.today'), viewMesocycle: t('home.viewMesocycle'),
          microcycleOf: t('home.microcycle'), activate: t('home.activateRoutine'), rename: t('routineEdit'), remove: t('home.removeRoutine'), active: t('home.activeRoutine'), skipped: t('routine.skipped') }}
        onToggle={() => setExpanded(!expanded)} onPressDetail={() => {}} onSelectSession={() => {}} onPressMesocycle={() => {}} onRename={() => {}} onRemove={() => {}}
        renderSessionList={rows => <TrainingCalendarCard mesocycleId={routine.mesocycleId} microcycleIndex={0} goal={routine.generationGoal}
          initialMesocycle={meso} sessionRows={rows} persist={async patch => setMeso(old => ({ ...old, ...patch }))}
          cardio={{ routine, blocks: [sample.block], workouts, onOpen: open }} />} />
      <View style={{ height: 12 }} />
      <CardioRoutineCard block={sample.block} workouts={workouts} sports={[]} onOpen={open} onOpenBlock={setCycle}
        expanded={!expanded} onToggle={() => setExpanded(!expanded)} />
    </>}
  </ScrollView>;
}
