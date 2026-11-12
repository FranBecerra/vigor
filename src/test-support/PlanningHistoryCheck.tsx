import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardioPlanBuilder } from '@/components/cardio/CardioPlanBuilder';
import { CardioPlanningHistoryContext } from '@/components/cardio/CardioPlanningHistoryContext';
import { CardioPlanningHealthReview } from '@/components/cardio/CardioPlanningHealthReview';
import { StrengthPlanBuilder } from '@/app/(tabs)/(train)/generate';
import { HybridPlanBuilder } from '@/components/cardio/HybridPlanBuilder';
import { planningHistoryFixture } from './planningHistoryFixture';
import { hybridFixture } from './hybridFixture';
import { vigorPlanningHistory } from '@/services/cardio/planningHistory';
import { cardioInputForSave, saveCardioProposal } from '@/services/cardio/savedCardioPlan';

/** Full production UI, fabricated history/Health and memory-only saves. */
export function PlanningHistoryCheck({ onExit }: { onExit(): void }) {
  const { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'MENU' | 'CARDIO' | 'HYBRID'>('MENU'), [state, setState] = useState<'RECORDS' | 'EMPTY' | 'ERROR'>('RECORDS');
  const [failed, setFailed] = useState(true), [saved, setSaved] = useState(false);
  const entries = useMemo(() => planningHistoryFixture(Date.now(), 'CYCLING'), []);
  const bridge = useMemo(() => ({ available: async () => true, authorize: async () => undefined,
    read: async () => ({ ...vigorPlanningHistory(entries, 'owner', Date.now()), workouts: vigorPlanningHistory(entries, 'owner', Date.now()).workouts.map(w => ({ ...w, sourceId: 'synthetic-watch', sourceName: 'Synthetic Watch' })) }) }), [entries]);
  const source = useMemo(hybridFixture, []);
  const history = { owner: 'owner', ready: true, error: state === 'ERROR', entries: state === 'EMPTY' ? [] : entries,
    reload: () => setState('RECORDS'), renderHealth: (props: React.ComponentProps<typeof CardioPlanningHealthReview>) => <CardioPlanningHealthReview {...props} bridge={bridge} /> };
  if (mode !== 'MENU') return <CardioPlanningHistoryContext.Provider value={history}>
    {mode === 'CARDIO' ? <CardioPlanBuilder ready error={false} onRetry={() => undefined} onCancel={() => setMode('MENU')} onSave={async (name, input) => {
      saveCardioProposal('synthetic-history-plan', 'owner', name, cardioInputForSave(input, Date.now()), null, Date.now());
      if (failed) { setFailed(false); throw Error('syntheticSaveFailure'); }
      setSaved(true); setMode('MENU');
    }} /> : <HybridPlanBuilder initialStrength={source.draft} exercises={source.exercises}
      renderStrength={props => <StrengthPlanBuilder {...props} />} onCancel={() => setMode('MENU')} onSave={async () => {
      if (failed) { setFailed(false); throw Error('syntheticSaveFailure'); }
      setSaved(true); setMode('MENU');
    }} />}
  </CardioPlanningHistoryContext.Provider>;
  const action = (label: string, press: () => void) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={press} style={{ minHeight: 48, justifyContent: 'center' }}>
    <Text style={{ color: colors.accentText, fontSize: 17 }}>{label}</Text></Pressable>;
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 22, paddingTop: insets.top + 20, paddingBottom: 110 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700' }}>PLANNING HISTORY · memory only</Text>
    <Text style={{ color: colors.textSecondary, marginVertical: 18 }}>Eight fabricated 40-minute cycling workouts. No account writes, Health permissions or real records.</Text>
    <View>{(['RECORDS', 'EMPTY', 'ERROR'] as const).map(value => action(`History: ${value}${state === value ? ' · selected' : ''}`, () => setState(value)))}</View>
    {action('Create cardio with fabricated history', () => { setFailed(true); setSaved(false); setMode('CARDIO'); })}
    {action('Create hybrid with fabricated history', () => { setFailed(true); setSaved(false); setMode('HYBRID'); })}
    {saved && <Text style={{ color: colors.textPrimary }}>Synthetic proposal saved in memory only</Text>}
    {action('Return to cardio checks', onExit)}
  </ScrollView>;
}
