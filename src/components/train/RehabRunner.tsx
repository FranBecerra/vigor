import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { RehabBlock, RehabLog } from '@/models';
import { useRehabilitation } from '@/hooks/useRehabilitation';
import { useTheme } from '@/theme/useTheme';
import { finishRehabLog, localDateKey, newRehabLog, skipRehabLog, updateRehabSet } from '@/services/training/rehabilitation';
import { NumericField } from './NumericField';

export function RehabRunner({ block, workoutKey, embedded = false, onClose }: { block: RehabBlock; workoutKey?: string; embedded?: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { logs, saveLog } = useRehabilitation();
  const today = localDateKey(new Date());
  const existing = logs.find((entry) => entry.blockId === block.id && entry.date === today);
  const [log, setLog] = useState<RehabLog>(() => existing ?? newRehabLog(block, today, Date.now(), workoutKey));
  const latest = useRef(log);
  latest.current = log;
  const { colors, spacing, radius, sectionAccent } = useTheme();
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
  const content = <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg,
      padding: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 40 }}>
      <Text style={{ ...text, fontSize: 25, fontWeight: '700' }}>{log.blockSnapshot.name}</Text>
      <Text style={{ color: colors.textMuted }}>{t('rehab.userPrescription')}</Text>
      {log.blockSnapshot.items.map((item) => <View key={item.id} style={button}>
        <Text style={{ ...text, fontSize: 18, fontWeight: '600' }}>{item.exerciseSnapshot.name}</Text>
        {!!item.notes && <Text style={text}>{item.notes}</Text>}
        <Text style={{ color: colors.textMuted }}>{item.min}–{item.max} {t(item.exerciseSnapshot.recording?.measure === 'SECONDS' ? 'rehab.seconds' : 'train.reps')}
          {item.exerciseSnapshot.laterality === 'PER_SIDE' ? ` · ${t('custom.perSide')}` : ''} · {t('rehab.rest')}: {item.restSeconds}s</Text>
        {log.sets.filter((set) => set.itemId === item.id).map((set) => <View key={set.index}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
          <Text style={text}>{set.index + 1}</Text>
          <View style={{ width: 64 }}><NumericField value={set.actual} editable={!busy && log.status !== 'COMPLETED'} accessibilityLabel={t(set.recording.measure === 'SECONDS' ? 'rehab.seconds' : 'train.reps')}
            onChangeValue={(actual) => commit(updateRehabSet(latest.current, item.id, set.index, { actual }, Date.now()))} /></View>
          {set.recording.load !== 'NONE' && <View style={{ width: 90 }}><Text style={{ color: colors.textMuted }}>{t(`custom.${set.recording.load}`)}</Text>
            <NumericField value={set.load} decimal editable={!busy && log.status !== 'COMPLETED'}
              accessibilityLabel={t(`custom.${set.recording.load}`)}
              onChangeValue={(load) => commit(updateRehabSet(latest.current, item.id, set.index, { load }, Date.now()))} />
          </View>}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.completed }} disabled={busy || log.status === 'COMPLETED'}
            onPress={() => {
              try { commit(updateRehabSet(latest.current, item.id, set.index,
                { actual: set.actual ?? item.max, ...(set.recording.load === 'NONE' ? {} : { load: set.load ?? item.load }), completed: !set.completed }, Date.now())); }
              catch { setError(t('rehab.invalidActual')); }
            }} style={{ padding: 12 }}><Text style={{ color: colors.accentText, fontSize: 22 }}>{set.completed ? '✓' : '○'}</Text></Pressable>
        </View>)}
      </View>)}
      {!!error && <Text accessibilityRole="alert" style={text}>{error}</Text>}
      {log.status !== 'COMPLETED' && <Pressable disabled={busy || !log.sets.every((set) => set.completed)} style={{ ...button, backgroundColor: sectionAccent.train }} onPress={async () => {
        setBusy(true);
        try { const completed = finishRehabLog(latest.current, Date.now()); commit(completed); if (await persist(completed)) onClose(); }
        catch { setError(t('rehab.incompleteBlock')); }
        finally { setBusy(false); }
      }}><Text style={{ color: colors.onAccent, textAlign: 'center', fontWeight: '700' }}>{t('rehab.finish')}</Text></Pressable>}
      <Pressable disabled={busy} style={button} onPress={() => { void close(); }}><Text style={{ ...text, textAlign: 'center' }}>{t('rehab.saveProgress')}</Text></Pressable>
      {log.status !== 'COMPLETED' && <Pressable disabled={busy} style={button} onPress={async () => {
        setBusy(true); const skipped = skipRehabLog({ ...latest.current, ...(workoutKey ? { workoutKey } : {}) }, Date.now());
        commit(skipped); if (await persist(skipped)) onClose(); setBusy(false);
      }}><Text style={{ ...text, textAlign: 'center' }}>{t('rehab.skip')}</Text></Pressable>}
    </ScrollView>;
  return embedded ? content : <Modal visible animationType="slide" onRequestClose={() => { if (!busy) void close(); }}>{content}</Modal>;
}
