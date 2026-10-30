import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useCardioBlocks, useCardioWorkouts } from '@/hooks/useCardioTraining';
import { useSportActivities } from '@/hooks/useSportActivities';
import { useRoutines } from '@/hooks/useRoutines';
import { CardioSlotEditor, CardioTimeline } from '@/components/cardio/CardioTimeline';
import { changeCardioSlot, cardioStartContext, datedStrength, endCardioBlock, improveCardioDates } from '@/services/cardio/cardioBlock';
import { startCardioWorkout } from '@/services/cardio/cardioWorkout';
import { cardioStrengthChanged } from '@/services/cardio/savedCardioPlan';
import type { CardioSlot } from '@/models/cardioTraining';
import { CardioProgressionReview } from '@/components/cardio/CardioProgressionReview';

export default function CardioBlockScreen() {
  const { uid } = useAuth(), { id } = useLocalSearchParams<{ id?: string }>();
  return <OwnedBlock key={`${uid}:${id}`} id={id} />;
}
function OwnedBlock({ id }: { id?: string }) {
  const blocks = useCardioBlocks(), workouts = useCardioWorkouts(), sports = useSportActivities(), strength = useRoutines();
  const { t } = useTranslation(), { colors, surfaces, semantic } = useTheme(), insets = useSafeAreaInsets(), router = useRouter();
  const block = blocks.entries.find(b => b.id === id), routine = strength.routines.find(r => r.domain === 'STRENGTH' && r.isActive);
  const assigned = datedStrength(routine, block?.timeZone ?? 'UTC');
  const [busy, setBusy] = useState(false), [error, setError] = useState(false), [editing, setEditing] = useState<CardioSlot | null>(null);
  const live = useRef(false), lock = useRef(false), runId = useRef<string | null>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const usable = blocks.ready && !blocks.error && workouts.ready && !workouts.error && sports.ready && !sports.error && strength.status === 'ready';
  const running = workouts.entries.filter(w => w.status === 'RUNNING' || w.status === 'PAUSED');
  const active = blocks.entries.filter(b => b.endedAt === null);
  const action = async (operation: () => Promise<unknown>) => {
    if (lock.current || !live.current || !usable) return;
    lock.current = true; setBusy(true); setError(false);
    try { await operation(); } catch { if (live.current) setError(true); }
    finally { if (live.current) { lock.current = false; setBusy(false); } }
  };
  const button = (label: string, press: () => void, danger = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={press} style={{ minHeight: 48, justifyContent: 'center', marginVertical: 8 }}>
    <Text style={{ color: danger ? semantic.danger : colors.accentText, fontSize: 17 }}>{label}</Text>
  </Pressable>;
  return <ScrollView style={{ flex: 1, ...surfaces.screen }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    {button(t('generate.back'), () => router.dismissTo('/(tabs)/(train)'))}
    {!blocks.ready ? <ActivityIndicator /> : !block ? <Text style={{ color: colors.textPrimary }}>{t('cardioSaved.loadFailed')}</Text> : <>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 29, fontWeight: '700', marginVertical: 16 }}>{block.proposal.name}</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>{t(block.endedAt === null ? 'cardioTraining.active' : 'cardioTraining.ended')} · {block.startDate} · {block.timeZone}</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>{t('cardioTraining.forecastNotice')}</Text>
      {(active.length > 1 || running.length > 1) && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.conflict')}</Text>}
      {cardioStrengthChanged(block.proposal, routine) && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioSaved.contextChanged')}</Text>}
      {running.map(w => button(`${t('cardioTraining.resume')} · ${t(`cardioPlan.${w.prescription.modality}`)}`, () => router.push({ pathname: '/cardio-workout', params: { id: w.id } })))}
      <CardioProgressionReview block={block} workouts={workouts.entries} enabled={usable && !busy} onSave={(next, previous) => blocks.save(next, previous)} />
      <CardioTimeline block={block} sports={sports.entries} strength={assigned} workouts={workouts.entries}
        onEdit={block.endedAt === null && usable && !busy ? setEditing : undefined}
        onOpen={usable && !busy ? (slot, workout) => {
          if (workout) { router.push({ pathname: '/cardio-workout', params: { id: workout.id } }); return; }
          if (block.endedAt !== null || active.length !== 1 || running.length || workouts.entries.some(w => w.blockId === block.id && w.slotId === slot.id && w.status !== 'DISCARDED')) { setError(true); return; }
          const launch = () => action(async () => {
            runId.current ??= workouts.newId();
            const next = startCardioWorkout(block, slot.id, Date.now(), runId.current);
            await workouts.save(next, null);
            if (live.current) router.push({ pathname: '/cardio-workout', params: { id: next.id } });
            runId.current = null;
          });
          const context = cardioStartContext(block, slot.id, Date.now(), sports.entries, assigned);
          if (context.review) Alert.alert(t('cardioTraining.startNow'), `${t('cardioTraining.startContext', { date: context.date })}\n${context.issues.map(i => t(`cardioTraining.issue_${i}`)).join('\n')}`, [
            { text: t('generate.cancel'), style: 'cancel' }, { text: t('cardioTraining.start'), onPress: launch },
          ]); else void launch();
        } : undefined} />
      {block.endedAt === null && <>
        {button(t('cardioTraining.improve'), () => action(async () => {
          const next = improveCardioDates(block, sports.entries, assigned, workouts.entries, Date.now());
          if (next !== block) await blocks.save(next, block);
        }))}
        {button(t('cardioTraining.end'), () => Alert.alert(t('cardioTraining.end'), t('cardioTraining.confirmEnd'), [
          { text: t('generate.cancel'), style: 'cancel' }, { text: t('cardioTraining.end'), style: 'destructive', onPress: () => action(() => blocks.save(endCardioBlock(block, Date.now()), block)) },
        ]), true, running.some(w => w.blockId === block.id))}
      </>}
      <CardioSlotEditor block={block} slot={editing} sports={sports.entries} onClose={() => setEditing(null)} onSave={async (date, disposition, sport) => {
        if (!usable || lock.current) throw Error('cardioUnavailable');
        await blocks.save(changeCardioSlot(block, editing!.id, date, disposition, sport, workouts.entries, Date.now()), block);
      }} />
      {(blocks.pending || workouts.pending) && <Text style={{ color: colors.textSecondary }}>{t('cardioSaved.pending')}</Text>}
    </>}
    {(error || blocks.error || workouts.error || sports.error || strength.status === 'error') && <>
      <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.saveFailed')}</Text>
      {button(t('home.retry'), () => { blocks.reload(); workouts.reload(); sports.reload(); strength.reload(); })}
    </>}
  </ScrollView>;
}
