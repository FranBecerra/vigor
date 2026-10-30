import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SetType, type RehabBlock, type RehabLog, type Exercise } from '@/models';
import { useRehabilitation } from '@/hooks/useRehabilitation';
import { useTheme } from '@/theme/useTheme';
import { finishRehabLog, localDateKey, newRehabLog, skipRehabLog, updateRehabSet, nextRehabItem } from '@/services/training/rehabilitation';
import { ExercisePage } from './ExercisePage';
import { WheelOverlayProvider } from './WheelOverlay';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WorkoutExerciseStrip } from './WorkoutExerciseStrip';
import { WorkoutClock } from './WorkoutClock';
import { ActionMenuSheet } from './ActionMenuSheet';
import { ExerciseQuickMenu } from './ExerciseQuickMenu';
import type { ExerciseMenuAnchor } from '@/services/training/exerciseMenuLayout';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import { ExerciseSwapSheet } from './generate/ExerciseSwapSheet';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { rehabRows, patchRehabRow, reshapeRehab, rehabSupersets, linkRehabSuperset } from '@/services/training/rehabExecution';
import { isNewSetCompletion } from '@/services/training/workoutExecution';
import { supersetTransition } from '@/services/training/workoutStructure';
import { recordingOf } from '@/services/training/customExercises';
import { supportsExtensions } from '@/services/training/advancedSets';
import { RestTimer } from './RestTimer';
import { IDLE_REST_TIMER, adjustRest, cancelRest, restartRest, setRestDuration, startRest, type RestTimerState } from '@/services/training/restTimer';
import { useExerciseName } from '@/hooks/useExerciseName';
import { clearWorkoutRestAlerts } from '@/services/training/restAlerts';

export function RehabRunner({ block, workoutKey, embedded = false, onClose }: { block: RehabBlock; workoutKey?: string; embedded?: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { logs, blocks, saveLog, saveBlock } = useRehabilitation();
  const exerciseName = useExerciseName();
  const today = localDateKey(new Date());
  const existing = logs.find((entry) => entry.blockId === block.id && entry.date === today);
  const [log, setLog] = useState<RehabLog>(() => existing ?? newRehabLog(block, today, Date.now(), workoutKey));
  const latest = useRef(log);
  latest.current = log;
  const { surfaces, colors, spacing, radius, sectionAccent, typography } = useTheme();
  const { width } = useWindowDimensions(); const { catalogue } = useExerciseCatalogue();
  const [menu, setMenu] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<ExerciseMenuAnchor>();
  const [typeRow, setTypeRow] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [detail, setDetail] = useState<'info' | 'note' | null>(null);
  const insets = useSafeAreaInsets();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const persistRef = useRef(saveLog);
  persistRef.current = saveLog;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && dirty.current) void persistRef.current(latest.current).catch(() => setError(t('rehab.saveFailed')));
    });
    return () => { subscription.remove(); if (dirty.current) void persistRef.current(latest.current).catch(() => {}); };
  }, []);
  const persist = async (value: RehabLog) => {
    try { await saveLog(value); setError(''); return true; }
    catch { setError(t('rehab.saveFailed')); return false; }
  };
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => { void persist(latest.current); }, 600);
    return () => clearTimeout(timer);
  }, [log]);
  const commit = (value: RehabLog) => {
    const owned = workoutKey ? { ...value, workoutKey } : value;
    dirty.current = true; latest.current = owned; setLog(owned);
  };
  const close = async () => { setBusy(true); if (!dirty.current || await persist(latest.current)) onClose(); setBusy(false); };
  const text = { color: colors.textPrimary };
  const button = { padding: spacing.md, backgroundColor: colors.bgElevated, borderRadius: radius.md, marginVertical: 8 };
  const activeId = log.activeItemId ?? nextRehabItem(log) ?? log.blockSnapshot.items[0]?.id;
  const active = log.blockSnapshot.items.find((item) => item.id === activeId) ?? log.blockSnapshot.items[0];
  const timer = log.restTimer ?? IDLE_REST_TIMER;
  const restItem = log.blockSnapshot.items.find((item) => log.sets.some((set) => set.itemId === item.id && `${set.itemId}:${set.index}` === timer.anchorSetId)) ?? active;
  const updateTimer = (value: RestTimerState) => commit({ ...latest.current, restTimer: value, updatedAt: Date.now() });
  const items = log.blockSnapshot.items;
  const railExercises = items.map((item) => ({ ...item.exerciseSnapshot, id: item.id }));
  const grouped = rehabSupersets(items);
  const reshape = (next: typeof items) => commit(reshapeRehab(latest.current, next, Date.now()));
  const update: React.ComponentProps<typeof ExercisePage>['onUpdateSet'] = (_id, setId, patch) => {
    if (busy || log.status === 'COMPLETED') return;
    try {
      const before = rehabRows(latest.current, active).find((row) => row.id === setId);
      const updated = patchRehabRow(latest.current, active, setId, patch, Date.now());
      const after = rehabRows(updated, active).find((row) => row.id === setId);
      const transition = after?.setType === SetType.WARMUP ? { next: active.id, rest: true }
        : supersetTransition(items.map((item) => item.id), grouped, Object.fromEntries(items.map((item) => [item.id, rehabRows(updated, item)])), active.id);
      commit(isNewSetCompletion(before, after) ? { ...updated, activeItemId: transition.next ?? nextRehabItem(updated) ?? active.id,
        restTimer: active.restSeconds > 0 ? startRest(setId, active.restSeconds, Date.now()) : IDLE_REST_TIMER } : updated);
    } catch { setError(t('rehab.invalidActual')); }
  };
  const remove = (itemId: string) => {
    const apply = () => reshape(items.filter((item) => item.id !== itemId).map(({ circuitWithPrevious: _, ...item }) => item));
    if (log.sets.some((set) => set.itemId === itemId && set.completed)) Alert.alert(t('executionUpdates.removeExercise'), t('executionUpdates.removeRecorded'), [
      { text: t('generate.cancel'), style: 'cancel' }, { text: t('executionUpdates.removeExercise'), style: 'destructive', onPress: apply },
    ]); else apply();
  };
  if (!active) {
    const empty = <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: insets.top + spacing.lg }}>
      <Text style={[typography.emphasis, text]}>{log.blockSnapshot.name}</Text>
      <WorkoutExerciseStrip exercises={[]} activeId={undefined} onSelect={() => {}} onAdd={() => setPicker('ADD')} onReorder={() => {}} />
      <Pressable onPress={() => { void close(); }} style={button}><Text style={text}>{t('rehab.saveProgress')}</Text></Pressable>
      <ExerciseSwapSheet open={picker === 'ADD'} mode="add" current={null} candidates={catalogue} onClose={() => setPicker(null)} onSelect={(exercise) => {
        reshape([{ id: `rehab:${Date.now()}`, exerciseId: exercise.id, exerciseSnapshot: exercise, sets: 1, min: 10, max: 10, restSeconds: 0, notes: '' }]); setPicker(null);
      }} />
    </View>;
    return embedded ? empty : <Modal visible animationType="slide" onRequestClose={() => { void close(); }}>{empty}</Modal>;
  }
  const content = <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg }}>
      <View style={{ flex: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('workout.pause')} onPress={() => { void close(); }}><Text style={{ color: colors.accentText, fontSize: 24 }}>‹</Text></Pressable>
        <Text numberOfLines={1} style={[typography.emphasis, text]}>{log.blockSnapshot.name}</Text>
        <WorkoutClock startedAt={log.startedAt ?? log.updatedAt} completedAt={log.completedAt} />
      </View>
      <RestTimer state={timer} prescribedSeconds={restItem?.restSeconds} exerciseName={restItem ? exerciseName(restItem.exerciseSnapshot) : ''}
        onAdjust={(delta) => updateTimer(adjustRest(timer, delta))} onRestart={() => updateTimer(restartRest(timer, Date.now()))}
        onCancel={() => updateTimer(cancelRest())} onSetDuration={(seconds) => updateTimer(setRestDuration(timer, seconds))}
        onSetPrescription={async (restSeconds) => {
          if (!restItem) return;
          const current = blocks.find((entry) => entry.id === block.id) ?? block;
          await saveBlock({ ...current, items: current.items.map((item) => item.id === restItem.id ? { ...item, restSeconds } : item), updatedAt: Date.now() });
          commit({ ...latest.current, blockSnapshot: { ...latest.current.blockSnapshot, items: latest.current.blockSnapshot.items.map((item) => item.id === restItem.id ? { ...item, restSeconds } : item) },
            restTimer: setRestDuration(latest.current.restTimer ?? IDLE_REST_TIMER, restSeconds), updatedAt: Date.now() });
        }} />
    </View>
    <WorkoutExerciseStrip exercises={railExercises} activeId={active.id} supersets={grouped}
      onSelect={(index) => commit({ ...latest.current, activeItemId: items[index].id })} onExerciseMenu={(id, anchor) => { setMenuAnchor(anchor); setMenu(id); }}
      onAdd={() => setPicker('ADD')} onReorder={(order) => reshape(order.map((entry) => { const { circuitWithPrevious: _, ...item } = items.find((item) => item.id === entry.id)!; return item; }))} />
    <View style={{ flexDirection: 'row', gap: 10, padding: spacing.lg }}><Text style={{ color: colors.textSecondary }}>{t('train.sets')}</Text>
      <Text style={{ color: colors.accentText, fontWeight: '700' }}>{log.sets.filter((set) => set.completed).length}/{log.sets.length}</Text>
      {!!grouped[active.id] && <Text style={{ color: colors.accentText }}>{t('executionUpdates.superset')}</Text>}
    </View>
    <ExercisePage editable={log.status !== 'COMPLETED'} exercise={{ ...active.exerciseSnapshot, id: active.id }} sets={rehabRows(log, active)} scale="RIR" width={width} bottomInset={0}
      note={active.notes} onUpdateSet={update} onPressSetType={(_id, id) => setTypeRow(id)}
      onAction={(_id, action) => action === 'swap' ? setPicker(active.id) : setDetail(action)}
      onAddSet={() => { if (active.sets < 20) reshape(items.map((item) => item.id === active.id ? { ...item, sets: item.sets + 1 } : item)); }}
      onRemoveSet={(_id, setId) => {
        const removed = rehabRows(log, active).findIndex((row) => row.id === setId);
        const reduced = reshapeRehab(latest.current, items.map((item) => item.id === active.id ? { ...item, sets: item.sets - 1 } : item), Date.now());
        const kept = log.sets.filter((set) => set.itemId === active.id).filter((_, index) => index !== removed).map((set, index) => ({ ...set, index }));
        commit({ ...reduced, sets: reduced.sets.map((set) => set.itemId === active.id ? kept[set.index] : set), restTimer: IDLE_REST_TIMER });
      }} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.textPrimary, paddingHorizontal: spacing.lg }}>{error}</Text>}
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 8 }}>
      {log.status !== 'COMPLETED' && <Pressable disabled={busy || !log.sets.length || !log.sets.every((set) => set.completed)} style={{ ...button, backgroundColor: sectionAccent.train }} onPress={async () => {
        setBusy(true);
        try { const completed = { ...finishRehabLog(latest.current, Date.now()), restTimer: IDLE_REST_TIMER }; commit(completed); if (await persist(completed)) { await clearWorkoutRestAlerts().catch(() => undefined); onClose(); } }
        catch { setError(t('rehab.incompleteBlock')); } finally { setBusy(false); }
      }}><Text style={{ color: colors.onAccent, textAlign: 'center', fontWeight: '700' }}>{t('rehab.finish')}</Text></Pressable>}
      <Pressable disabled={busy} onPress={() => { void close(); }} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={text}>{t('rehab.saveProgress')}</Text></Pressable>
      {log.status !== 'COMPLETED' && <Pressable disabled={busy} onPress={async () => {
        setBusy(true); const skipped = skipRehabLog({ ...latest.current, restTimer: IDLE_REST_TIMER, ...(workoutKey ? { workoutKey } : {}) }, Date.now());
        commit(skipped); if (await persist(skipped)) { await clearWorkoutRestAlerts().catch(() => undefined); onClose(); } setBusy(false);
      }} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textSecondary }}>{t('rehab.skip')}</Text></Pressable>}
    </View>
    <ActionMenuSheet title={typeRow ? t('workout.setType') : null} onClose={() => setTypeRow(null)} actions={Object.values(SetType).map((setType) => ({
      label: t(`setType.${setType}`), onPress: () => { if (typeRow) update(active.id, typeRow, { setType, ...(supportsExtensions(setType) ? { extensions: [{}] } : { extensions: [] }) }); },
    }))} />
    <ExerciseQuickMenu exercise={menu && items.some((item) => item.id === menu) ? { id: menu, name: exerciseName(items.find((item) => item.id === menu)!.exerciseSnapshot) } : null}
      anchor={menuAnchor} partners={items.filter((item) => item.id !== menu).map((item) => ({ id: item.id, name: exerciseName(item.exerciseSnapshot) }))}
      grouped={!!(menu && grouped[menu])} onClose={() => setMenu(null)} onRemove={() => { if (menu) remove(menu); }}
      onSwap={() => { if (menu) { commit({ ...latest.current, activeItemId: menu }); setPicker(menu); } }}
      onLink={(partner) => { if (menu) reshape(linkRehabSuperset(items, menu, partner)); }}
      onUnlink={() => { if (menu) reshape(linkRehabSuperset(items, menu)); }} />
    <ExerciseDetailSheet exercise={detail ? active.exerciseSnapshot : null} mode={detail ?? 'info'} note={active.notes} onClose={() => setDetail(null)}
      onNote={(notes) => reshape(items.map((item) => item.id === active.id ? { ...item, notes } : item))} />
    <ExerciseSwapSheet open={picker !== null} mode={picker === 'ADD' ? 'add' : 'swap'} current={picker === 'ADD' ? null : active.exerciseSnapshot} candidates={catalogue}
      onClose={() => setPicker(null)} onSelect={(exercise) => {
        const apply = () => {
          const sameMeasure = recordingOf(exercise).measure === recordingOf(active.exerciseSnapshot).measure;
          const item = { id: `rehab:${Date.now()}`, exerciseId: exercise.id, exerciseSnapshot: exercise, sets: picker === 'ADD' ? 1 : active.sets,
            min: sameMeasure ? active.min : 10, max: sameMeasure ? active.max : 10, restSeconds: active.restSeconds, notes: '' };
          reshape(picker === 'ADD' ? [...items, item] : items.map((old) => old.id === picker ? item : old)); setPicker(null);
        };
        if (picker !== 'ADD' && log.sets.some((set) => set.itemId === picker && set.completed)) Alert.alert(t('train.swap'), t('executionUpdates.replaceRecorded'), [
          { text: t('generate.cancel'), style: 'cancel' }, { text: t('train.swap'), style: 'destructive', onPress: apply },
        ]); else apply();
      }} />
  </View>;
  const scoped = <WheelOverlayProvider>{content}</WheelOverlayProvider>;
  return embedded ? scoped : <Modal visible animationType="slide" onRequestClose={() => { if (!busy) void close(); }}>
    <GestureHandlerRootView style={{ flex: 1 }}>{scoped}</GestureHandlerRootView>
  </Modal>;
}
