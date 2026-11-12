import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { hybridFixture } from './hybridFixture';
import { prepareHybridBundle } from '@/services/cardio/hybridAuthoring';
import { toRoutineView } from '@/services/training/routineView';
import { saveSportDraft } from '@/services/cardio/sportActivities';
import { CardioActivationPanel } from '@/components/cardio/CardioActivation';

/** No production hooks, permissions or persistence: only fabricated source data. */
export function HybridCapacityCheck({ onExit }: { onExit: () => void }) {
  const { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const fixture = useMemo(() => {
    const f = hybridFixture(), now = Date.now();
    const bundle = prepareHybridBundle(f.draft, f.input, { ...f.settings, totalMinutesPerCycle: 100 }, f.exercises, f.labels, now);
    return { plan: bundle.cardio, routine: toRoutineView(bundle.routine, bundle.mesocycle, f.exercises, f.labels)!,
      sports: [saveSportDraft('synthetic-class', 'owner', { sport: 'PADEL', context: 'CLASS', name: 'Synthetic class', notes: '',
        mode: 'PLAN', startAt: now + 86400000, durationMinutes: 60, timeZone: 'UTC', effort: null }, now)] };
  }, []);
  const [activities, setActivities] = useState(fixture.sports), [fail, setFail] = useState(true), [saved, setSaved] = useState(false);
  const action = (label: string, onPress: () => void) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: 48, justifyContent: 'center' }}>
    <Text style={{ color: colors.accentText, fontSize: 17 }}>{label}</Text>
  </Pressable>;
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    {action('Exit capacity check (memory only)', onExit)}
    <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700' }}>HYBRID CAPACITY CHECK</Text>
    <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Synthetic 8-day cycles · 100 min shared time · no account writes</Text>
    {action(activities.length ? 'Remove synthetic reservation' : 'Restore synthetic reservation', () => setActivities(activities.length ? [] : fixture.sports))}
    {saved ? <Text style={{ color: colors.textPrimary, fontSize: 20 }}>Synthetic activation accepted in memory only</Text>
      : <CardioActivationPanel plan={fixture.plan} routine={fixture.routine} ready
        blocks={{ owner: 'owner', entries: [], ready: true, error: false, pending: false, reload: () => undefined, newId: () => 'memory-block', save: async next => {
          if (fail) { setFail(false); throw Error('syntheticActivationFailure'); } return next;
        } }} workouts={{ ready: true, error: false, reload: () => undefined }}
        sports={{ entries: activities, ready: true, error: false, reload: () => undefined }} onActivated={() => setSaved(true)} />}
  </ScrollView>;
}
