import { routineRestDays } from '@/services/training/routineRestDays';
import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardioTimeline } from '@/components/cardio/CardioTimeline';
import { TrainingAgenda } from '@/components/train/TrainingAgenda';
import { AgendaActionSheet } from '@/components/train/AgendaActionSheet';
import { useTheme } from '@/theme/useTheme';
import { startCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';
import { changeCardioSlot } from '@/services/cardio/cardioBlock';
import { cardioHealthCandidates, createLinkedCardioWorkout } from '@/services/cardio/cardioHealthLink';
import { agendaMoveTo, movableAgendaEntry, pendingAgendaSession, trainingAgenda, type AgendaEntry, type AgendaExtraRest, type AgendaMove } from '@/services/training/trainingAgenda';
import type { CardioHealthRead } from '@/models/cardioHealth';
import type { CardioWorkout } from '@/models/cardioTraining';
import { cardioFixture, weeklyCardioAgendaFixture } from './cardioFixture';
import { cardioHomeFixture } from './cardioHomeFixture';

const now = Date.UTC(2026, 9, 30, 18);
const owner = 'owner', today = '2026-10-30';
const watch: CardioHealthRead = { version: 1, truncated: false, workouts: [{
  id: 'synthetic-run', kind: 'RUNNING', start: now - 4 * 86400000 - 2_400_000, end: now - 4 * 86400000 - 240_000, durationSeconds: 2040,
  distanceMetres: 4300, averageHeartRateBpm: 139, sourceId: 'sample.watch', sourceName: 'Apple Watch · fixture',
  manuallyEntered: false, ownExport: false, mixedActivities: false, linkKey: 'a'.repeat(64),
}] };

/** The app's agenda and action sheet with injected memory-only records. */
export function TrainingAgendaCheck({ onExit, weekly = false }: { onExit: () => void; weekly?: boolean }) {
  const [week] = useState(() => weekly ? weeklyCardioAgendaFixture() : null);
  const { t } = useTranslation(), { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const [sample] = useState(() => cardioHomeFixture(owner, now));
  const [block, setBlock] = useState(() => week?.block ?? cardioFixture({}, now)), [workouts, setWorkouts] = useState<CardioWorkout[]>(week?.workouts ?? []);
  const [adjusted, setAdjusted] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [rests, setRests] = useState<AgendaExtraRest[]>([]);
  const [removedRestIds, setRemovedRestIds] = useState<string[]>([]);
  const [moves, setMoves] = useState<AgendaMove[]>([]);
  const [action, setAction] = useState<{ entry: AgendaEntry; mode: 'session' | 'health' } | null>(null);
  const meso = sample.routine.mesocycleSnapshot!;
  const strength = { ...sample.routine, mesocycleSnapshot: { ...meso, restDayChecks: checks,
    ...(weekly ? { restDays: routineRestDays(meso).slice(0, 5) } : {}) } };
  const agenda = trainingAgenda(owner, [strength], [block], workouts, [], adjusted ? '2026-11-16' : week?.today ?? today, moves, rests, removedRestIds);
  const close = () => setAction(null);
  const entry = action?.entry, cardio = entry?.kind === 'cardio' ? entry.session : null;
  return <ScrollView style={{ flex: 1, ...surfaces.screen }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 110 }}>
    <Pressable accessibilityRole="button" onPress={onExit} style={{ minHeight: 44 }}><Text style={{ color: colors.accentText }}>Close grouped agenda fixture</Text></Pressable>
    <Text style={{ color: colors.textPrimary, fontSize: 25, fontWeight: '800' }}>Relative agenda · memory only</Text>
    {week && <Pressable accessibilityRole="button" style={{ minHeight: 44 }} onPress={() => {
      if (adjusted) { setTimeline(!timeline); return; }
      const [first, second] = week.block.slots;
      const shifted = { ...week.block, startDate: '2026-11-10', slots: [
        { ...first, date: '2026-11-10' }, { ...second, date: '2026-11-17' },
      ] };
      setBlock(changeCardioSlot(shifted, second.id, '2026-11-16', 'CARDIO', null, workouts, Date.UTC(2026, 10, 16, 11)));
      setAdjusted(true);
    }}><Text style={{ color: colors.accentText }}>{adjusted ? 'Toggle adjusted cardio cycle' : 'Move second cycle run from 17 to 16 November'}</Text></Pressable>}
    {week && adjusted && !timeline && workouts.length === 1 && <Pressable accessibilityRole="button" style={{ minHeight: 44 }} onPress={() => {
      const started = Date.UTC(2026, 10, 16, 12);
      const run = startCardioWorkout(block, block.slots[1].id, started, 'weekly-second-run');
      setWorkouts(previous => [...previous, transitionCardioWorkout(run, 'FINISH', started + 60000, 60)]);
    }}><Text style={{ color: colors.accentText }}>Finish second cycle run</Text></Pressable>}
    {timeline ? <CardioTimeline block={block} sports={[]} strength={[]} workouts={workouts} initialCycle={1} /> : <TrainingAgenda agenda={agenda} onOpen={entry => { if (entry.kind !== 'cardio' || !entry.upcoming) setAction({ entry, mode: 'session' }); }}
      onLink={entry => setAction({ entry, mode: 'health' })} canMove={movableAgendaEntry}
      canLink={entry => entry.kind === 'cardio' && pendingAgendaSession(entry)}
      onReorder={(from, to) => {
        const change = agendaMoveTo(agenda.rows, from, to);
        if (change) setMoves(previous => [...previous, change]);
      }}
      onAddRest={agenda.restScope ? () => setRests(previous => [...previous, { id: `fixture-rest-${previous.length}`, scope: agenda.restScope!, checked: false }]) : undefined}
      onRemoveRest={entry => setRemovedRestIds(previous => [...previous, entry.id])}
      onToggleRest={entry => {
        if (entry.extra) setRests(previous => previous.map(rest => rest.id === entry.id ? { ...rest, checked: !entry.checked } : rest));
        else setChecks(previous => ({ ...previous, [`${entry.cycle}:${entry.restDayId}`]: !entry.checked }));
      }} />}
    {action && entry && <AgendaActionSheet name={entry.kind === 'strength' ? entry.session.name : t('cardioPlan.RUNNING')}
      mode={action.mode} onClose={close} start={pendingAgendaSession(entry) ? close : undefined}
      skip={cardio ? async () => { setBlock(changeCardioSlot(block, cardio.slot.id, cardio.slot.date, 'SKIPPED', null, workouts, now + 1)); } : undefined}
      health={cardio && action.mode === 'health' ? { state: 'READY', rows: cardioHealthCandidates(block, cardio.slot.id, watch, workouts, now),
        planned: `${Math.round(cardio.seconds / 6) / 10} min`, load: () => {}, save: async id => {
          setWorkouts([...workouts, createLinkedCardioWorkout(block, cardio.slot.id, id, watch, workouts, now, 'fixture-link')]);
        } } : undefined} />}
  </ScrollView>;
}
