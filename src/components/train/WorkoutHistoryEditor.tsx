import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { WorkoutSession } from '@/models';
import { SetType } from '@/models';
import { useTheme } from '@/theme/useTheme';
import { useExerciseName } from '@/hooks/useExerciseName';
import { NumericField } from './NumericField';
import { TrashIcon } from '@/components/icons/ActionIcons';
import type { HistoryEdit } from '@/services/training/historyEditing';
import { isSetCompleted } from '@/services/training/sessionMapper';

export function WorkoutHistoryEditor({ session, onSave, onClose }: { session: WorkoutSession; onSave: (draft: HistoryEdit) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation(); const { colors, spacing, radius, sectionAccent, semantic, typography } = useTheme();
  const insets = useSafeAreaInsets(); const name = useExerciseName();
  const [draft, setDraft] = useState<HistoryEdit>(() => JSON.parse(JSON.stringify(session)));
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const field = { color: colors.textPrimary, backgroundColor: colors.surface, borderRadius: radius.sm, padding: 12 };
  const change = (exerciseIndex: number, setIndex: number, patch: object) => setDraft((old) => ({ ...old, exercises: old.exercises.map((entry, i) => i !== exerciseIndex ? entry :
    { ...entry, sets: entry.sets.map((set, j) => j === setIndex ? { ...set, ...patch } : set) }) }));
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }}>
      <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{t('historyEdit.title')}</Text>
      <TextInput accessibilityLabel={t('historyEdit.name')} value={draft.sessionName ?? ''} onChangeText={(sessionName) => setDraft((old) => ({ ...old, sessionName }))} editable={!busy} style={[field, { marginTop: 16 }]} />
      <TextInput accessibilityLabel={t('notes.SESSION')} multiline value={draft.sessionNote ?? ''} onChangeText={(sessionNote) => setDraft((old) => ({ ...old, sessionNote }))} editable={!busy} style={[field, { minHeight: 80, marginTop: 12 }]} />
      {draft.exercises.map((entry, i) => <View key={entry.id} pointerEvents={busy ? 'none' : 'auto'} style={{ marginTop: 24 }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{entry.exerciseSnapshot ? name(entry.exerciseSnapshot) : entry.exerciseId}</Text>
        {entry.sets.map((set, j) => {
          const mode = set.recording ?? entry.exerciseSnapshot?.recording; const timed = mode?.measure === 'SECONDS';
          return <View key={set.id} style={{ marginTop: 12, padding: 10, gap: 8, backgroundColor: colors.bgElevated, borderRadius: radius.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={t('historyEdit.warmup')} accessibilityState={{ checked: set.setType === SetType.WARMUP }} disabled={busy}
                onPress={() => change(i, j, { setType: set.setType === SetType.WARMUP ? SetType.NORMAL : SetType.WARMUP })} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: colors.textPrimary }}>{j + 1} · {set.setType === SetType.WARMUP ? 'W ✓' : 'W'}</Text></Pressable>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={t('historyEdit.completed')} accessibilityState={{ checked: isSetCompleted(set) }} disabled={busy}
                onPress={() => change(i, j, { completionState: isSetCompleted(set) ? 'PENDING' : 'DONE' })} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: colors.textPrimary }}>{t('historyEdit.completed')} {isSetCompleted(set) ? '✓' : '○'}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('workout.removeSet')} disabled={busy} onPress={() => setDraft((old) => ({ ...old, exercises: old.exercises.map((item, index) => index !== i ? item : { ...item, sets: item.sets.filter((_row, index) => index !== j) }) }))}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><TrashIcon color={semantic.danger} size={22} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {mode?.load !== 'NONE' && <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>{mode?.load === 'LEVEL' ? t('custom.LEVEL') : 'KG'}</Text>
                <NumericField compact accessibilityLabel={t('train.weight')} decimal value={mode?.load === 'LEVEL' ? set.actualLoadLevel : set.actualWeight} onChangeValue={(value) => change(i, j, { [mode?.load === 'LEVEL' ? 'actualLoadLevel' : 'actualWeight']: value })} /></View>}
              <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>{timed ? 's' : t('train.reps')}</Text><NumericField compact accessibilityLabel={timed ? 's' : t('train.reps')} value={timed ? set.actualDurationSeconds : set.actualReps} onChangeValue={(value) => change(i, j, { [timed ? 'actualDurationSeconds' : 'actualReps']: value })} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>RIR</Text><NumericField compact accessibilityLabel="RIR" value={set.actualRIR ?? undefined} onChangeValue={(value) => change(i, j, { actualRIR: value ?? null })} /></View>
              {!timed && <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>+ P</Text><NumericField compact accessibilityLabel={t('workout.partialReps')} value={set.actualPartialReps} onChangeValue={(value) => change(i, j, { actualPartialReps: value })} /></View>}
            </View>
          </View>;
        })}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDraft((old) => ({ ...old, exercises: old.exercises.map((item, index) => index !== i ? item : { ...item,
          sets: [...item.sets, { id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, setType: SetType.NORMAL, targetReps: 10, targetRIR: 2, targetWeight: 0, isAutoFilled: false, completionState: 'PENDING', ...(item.exerciseSnapshot?.recording ? { recording: item.exerciseSnapshot.recording } : {}) }] }) }))}
          style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>+ {t('train.sets')}</Text></Pressable>
      </View>)}
      {error && <Text accessibilityRole="alert" style={{ color: semantic.danger }}>{t('historyEdit.failed')}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={t('custom.save')} disabled={busy} onPress={async () => { setBusy(true); setError(false); try { await onSave(draft); onClose(); } catch { setError(true); } finally { setBusy(false); } }}
        style={{ minHeight: 52, marginTop: 24, backgroundColor: sectionAccent.train, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onAccent, fontWeight: '700' }}>{t('custom.save')}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textPrimary }}>{t('generate.cancel')}</Text></Pressable>
    </ScrollView>
  </Modal>;
}
