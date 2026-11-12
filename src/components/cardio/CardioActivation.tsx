import { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { useCardioBlocks, useCardioWorkouts } from '@/hooks/useCardioTraining';
import { useSportActivities } from '@/hooks/useSportActivities';
import { cardioStrengthChanged, type SavedCardioPlan } from '@/services/cardio/savedCardioPlan';
import type { RoutineView } from '@/services/training/routineView';
import type { CardioBlock, CardioSlot } from '@/models/cardioTraining';
import { changeCardioSlot, coordinateCardioBlock, createCardioBlock, datedStrength, dateInZone, improveCardioDates } from '@/services/cardio/cardioBlock';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { CardioSlotEditor, CardioTimeline } from './CardioTimeline';
import { withCardioProgression } from '@/services/cardio/cardioProgression';
import { reviewHybridCapacity } from '@/services/cardio/hybridCapacity';
import { HybridCapacityPanel } from './HybridCapacityPanel';

export function CardioActivation({ plan, routine, ready }: { plan: SavedCardioPlan; routine?: RoutineView; ready: boolean }) {
  const blocks = useCardioBlocks(), workouts = useCardioWorkouts(), sports = useSportActivities(); const router = useRouter();
  return <CardioActivationPanel plan={plan} routine={routine} ready={ready} blocks={blocks} workouts={workouts} sports={sports}
    onActivated={id => router.replace({ pathname: '/cardio-block', params: { id } })} />;
}

/** Shared production/acceptance presentation; native fixtures supply memory-only stores. */
export function CardioActivationPanel({ plan, routine, ready, blocks, workouts, sports, onActivated }: {
  plan: SavedCardioPlan; routine?: RoutineView; ready: boolean;
  blocks: ReturnType<typeof useCardioBlocks>; workouts: Pick<ReturnType<typeof useCardioWorkouts>, 'ready' | 'error' | 'reload'>;
  sports: Pick<ReturnType<typeof useSportActivities>, 'entries' | 'ready' | 'error' | 'reload'>;
  onActivated: (id: string) => void;
}) {
  const { t } = useTranslation(); const { colors, surfaces, radius, semantic } = useTheme();
  const [start, setStart] = useState(new Date()), [cycles, setCycles] = useState(4), [draft, setDraft] = useState<CardioBlock | null>(null);
  const [acknowledgedFor, setAcknowledgedFor] = useState<string | null>(null), [error, setError] = useState(false), [busy, setBusy] = useState(false), [editing, setEditing] = useState<CardioSlot | null>(null);
  const live = useRef(false), lock = useRef(false), identity = useRef<string | null>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const active = blocks.entries.filter(b => b.endedAt === null), strength = datedStrength(routine, draft?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const usable = ready && blocks.ready && !blocks.error && workouts.ready && !workouts.error && sports.ready && !sports.error;
  const changed = cardioStrengthChanged(plan, routine);
  const context = JSON.stringify([plan, routine, sports.entries, draft, usable, active.map(b => b.id)]);
  const acknowledged = acknowledgedFor === context;
  const latestContext = useRef(context); latestContext.current = context;
  let capacity: ReturnType<typeof reviewHybridCapacity> | null = null, capacityFailed = false;
  const hybrid = routine?.hybrid?.cardioPlanId === plan.id ? routine.hybrid : null;
  if (draft && hybrid && usable) {
    try { capacity = reviewHybridCapacity(draft, hybrid, sports.entries, strength); }
    catch { capacityFailed = true; }
  }
  const capacityBlocked = !!hybrid && (!capacity?.fits || capacityFailed);
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || busy} onPress={action}
    style={{ ...surfaces.field, borderRadius: radius.md, padding: 14, minHeight: 48, opacity: disabled ? 0.45 : 1 }}><Text style={{ color: colors.accentText, fontSize: 17 }}>{label}</Text></Pressable>;
  return <View style={{ marginTop: 24, gap: 14 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 23, fontWeight: '700' }}>{t('cardioTraining.activateTitle')}</Text>
    <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>{t('cardioProgression.policy')}</Text>
    {!!active.length && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.activeExists')}</Text>}
    {changed && <Text style={{ color: semantic.warning }}>{t('cardioSaved.contextChanged')}</Text>}
    <DateTimePicker value={start} mode="date" display="compact" onValueChange={(_event, date) => { setStart(date); setDraft(null); setAcknowledgedFor(null); }} />
    <Stepper label={t('cardioTraining.cycles')} value={cycles} min={1} max={8} step={1} onChange={n => { setCycles(n); setDraft(null); setAcknowledgedFor(null); }} />
    {button(t('cardioTraining.reviewDates'), () => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const next = withCardioProgression(createCardioBlock('draft', plan, dateInZone(start.getTime(), zone), cycles, zone, Date.now()));
      setDraft(plan.policy === 'CARDIO_MANUAL_V1' ? next : improveCardioDates(next, sports.entries, strength, [], Date.now())); setAcknowledgedFor(null);
    }, !usable || changed || !!active.length)}
    {draft && <>
      <Text style={{ color: colors.textSecondary }}>{t('cardioTraining.forecastNotice')}</Text>
      {capacity && hybrid && <HybridCapacityPanel review={capacity} budget={hybrid.totalMinutesPerCycle} />}
      {hybrid && (!usable || capacityFailed) && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('hybridCapacity.unavailable')}</Text>}
      <CardioTimeline block={draft} sports={sports.entries} strength={strength} workouts={[]} onEdit={setEditing} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: colors.textPrimary, flex: 1 }}>{t(coordinateCardioBlock(draft, sports.entries, strength).some(r => r.issues.length) ? 'cardioTraining.ackIssues' : 'cardioTraining.ackDates')}</Text>
        <Switch accessibilityLabel={t('cardioTraining.ackDates')} value={acknowledged} onValueChange={value => setAcknowledgedFor(value ? context : null)} />
      </View>
      {button(t('cardioTraining.activate'), async () => {
        if (lock.current || !live.current || latestContext.current !== context || !usable || changed || active.length || !acknowledged || capacityBlocked) return;
        lock.current = true; setBusy(true); setError(false);
        try {
          identity.current ??= blocks.newId();
          await blocks.save({ ...draft, id: identity.current, revision: 1 }, null);
          if (live.current) onActivated(identity.current);
        } catch { if (live.current) setError(true); }
        finally { if (live.current) { setBusy(false); lock.current = false; } }
      }, !usable || changed || !!active.length || !acknowledged || capacityBlocked)}
      <CardioSlotEditor block={draft} slot={editing} sports={sports.entries} onClose={() => setEditing(null)} onSave={async (date, disposition, sport) => {
        setDraft(changeCardioSlot(draft, editing!.id, date, disposition, sport, [], Date.now())); setAcknowledgedFor(null);
      }} />
    </>}
    {(error || blocks.error || workouts.error || sports.error) && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.saveFailed')}</Text>}
    {(blocks.error || workouts.error || sports.error) && button(t('home.retry'), () => { blocks.reload(); workouts.reload(); sports.reload(); })}
  </View>;
}
