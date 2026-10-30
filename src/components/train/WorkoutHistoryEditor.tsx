import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { WorkoutSession } from '@/models';
import { SetType } from '@/models';
import { useTheme } from '@/theme/useTheme';
import { useExerciseName } from '@/hooks/useExerciseName';
import { useTrainingUnits } from '@/hooks/useTrainingUnits';
import { NumericField } from './NumericField';
import { CheckIcon, TrashIcon } from '@/components/icons/ActionIcons';
import type { HistoryEdit } from '@/services/training/historyEditing';
import { isSetCompleted } from '@/services/training/sessionMapper';
import { ActionMenuSheet } from './ActionMenuSheet';
import { SELECTABLE_SET_TYPES, setTypeLabel } from './setTypeLabel';
import { supportsExtensions } from '@/services/training/advancedSets';
import { SessionEffortInput } from './SessionEffortInput';
import { sessionEffortValue } from '@/services/training/sessionFeedback';

export function WorkoutHistoryEditor({ session, onSave, onClose, onSavedClose = onClose, inline = false, onDirtyChange, onBusyChange }: {
  session: WorkoutSession; onSave: (draft: HistoryEdit, reviewProgression?: boolean) => Promise<void>; onClose: () => void;
  inline?: boolean; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void;
  onSavedClose?: () => void;
}) {
  const { t } = useTranslation(); const { surfaces, colors, spacing, radius, sectionAccent, semantic, typography } = useTheme();
  const insets = useSafeAreaInsets(); const name = useExerciseName();
  const [draft, setDraft] = useState<HistoryEdit>(() => ({ ...JSON.parse(JSON.stringify(session)), sessionEffort: sessionEffortValue(session.sessionFeedback) }));
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(!inline);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const original = useRef(JSON.stringify(draft));
  useEffect(() => { onDirtyChange?.(JSON.stringify(draft) !== original.current); }, [draft, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const units = useTrainingUnits();
  const [typePicker, setTypePicker] = useState<{ exercise: number; set: number } | null>(null);
  const field = { color: colors.textPrimary, ...surfaces.field, backgroundColor: colors.surface, borderRadius: radius.sm, padding: 12 };
  const change = (exerciseIndex: number, setIndex: number, patch: object) => setDraft((old) => ({ ...old, exercises: old.exercises.map((entry, i) => i !== exerciseIndex ? entry :
    { ...entry, sets: entry.sets.map((set, j) => j === setIndex ? { ...set, ...patch } : set) }) }));
  const save = async (reviewProgression = false) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setError(false);
    try { await onSave(draft, reviewProgression); if (mounted.current) onSavedClose(); } catch { if (mounted.current) setError(true); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  };
  const Container = inline ? View : ScrollView;
  const actions = <View style={{ flexDirection: 'row', gap: 12, marginVertical: 12 }}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: 'center' }}><Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('generate.cancel')}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('custom.save')} disabled={busy} onPress={() => save()}
      style={{ minHeight: 48, flex: 1, ...surfaces.primary, backgroundColor: sectionAccent.train, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 16 }}>{t('custom.save')}</Text></Pressable>
  </View>;
  const content = <>
    <Container {...(inline ? {} : { keyboardShouldPersistTaps: 'handled' as const, contentContainerStyle: { padding: spacing.lg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 } })}
      style={{ ...surfaces.screen, backgroundColor: colors.bg }}>
      {inline ? actions : <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{t('historyEdit.title')}</Text>}
      {inline && <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('editorFlow.actuals')}</Text>}
      {inline && <Pressable accessibilityRole="button" accessibilityState={{ expanded: metadataOpen }}
        accessibilityLabel={t('editorFlow.sessionDetails')} disabled={busy} onPress={() => setMetadataOpen(value => !value)}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('editorFlow.sessionDetails')}</Text>
        <Text style={{ color: colors.textMuted }}>{metadataOpen ? '⌃' : '⌄'}</Text>
      </Pressable>}
      {metadataOpen && <>
      <TextInput accessibilityLabel={t('historyEdit.name')} value={draft.sessionName ?? ''} onChangeText={(sessionName) => setDraft((old) => ({ ...old, sessionName }))} editable={!busy} style={[field, { marginTop: 16 }]} />
      <TextInput accessibilityLabel={t('notes.SESSION')} multiline value={draft.sessionNote ?? ''} onChangeText={(sessionNote) => setDraft((old) => ({ ...old, sessionNote }))} editable={!busy} style={[field, { minHeight: 80, marginTop: 12 }]} />
      <SessionEffortInput value={draft.sessionEffort ?? null} disabled={busy} onChange={(sessionEffort) => setDraft((old) => ({ ...old, sessionEffort }))} />
      </>}
      {draft.exercises.map((entry, i) => {
        const recording = entry.sets[0]?.recording ?? entry.exerciseSnapshot?.recording;
        const headings = [recording?.load === 'NONE' ? null : recording?.load === 'LEVEL' ? t('custom.LEVEL') : units.unit.toUpperCase(),
          recording?.measure === 'SECONDS' ? t('rehab.seconds') : t('train.reps'), 'RIR'].filter(Boolean);
        return <View key={entry.id} pointerEvents={busy ? 'none' : 'auto'} style={{ marginTop: 24 }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{entry.exerciseSnapshot ? name(entry.exerciseSnapshot) : entry.exerciseId}</Text>
        {inline && <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          <Text style={{ width: 34, color: colors.textMuted, fontSize: 12 }}>SET</Text>
          {headings.map(label => <Text key={label} style={{ flex: 1, color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>{label}</Text>)}
          <View style={{ width: 76 }} />
        </View>}
        {entry.sets.map((set, j) => {
          const mode = set.recording ?? entry.exerciseSnapshot?.recording; const timed = mode?.measure === 'SECONDS';
          return <View key={set.id} style={{ marginTop: 12, padding: inline ? 0 : 10, gap: 8,
            ...(inline ? {} : surfaces.field), backgroundColor: inline ? 'transparent' : colors.bgElevated, borderRadius: radius.md }}>
            <View style={inline ? { flexDirection: 'row', gap: 6, alignItems: 'center' } : undefined}>
            <View style={inline ? { width: 34 } : { flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('prescription.setType')} disabled={busy}
                onPress={() => setTypePicker({ exercise: i, set: j })} style={{ minWidth: inline ? 34 : 44, minHeight: 44, justifyContent: 'center', alignItems: inline ? 'center' : undefined, flex: inline ? undefined : 1 }}>
                <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>{inline ? setTypeLabel(set.setType) || j + 1 : `${j + 1} · ${t(`setType.${set.setType}`)} ▾`}</Text></Pressable>
              {!inline && <Pressable accessibilityRole="checkbox" accessibilityLabel={t('historyEdit.completed')} accessibilityState={{ checked: isSetCompleted(set) }} disabled={busy}
                onPress={() => change(i, j, { completionState: isSetCompleted(set) ? 'PENDING' : 'DONE' })} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: colors.textPrimary }}>{t('historyEdit.completed')} {isSetCompleted(set) ? '✓' : '○'}</Text></Pressable>}
              {!inline && <Pressable accessibilityRole="button" accessibilityLabel={t('workout.removeSet')} disabled={busy} onPress={() => setDraft((old) => ({ ...old, exercises: old.exercises.map((item, index) => index !== i ? item : { ...item, sets: item.sets.filter((_row, index) => index !== j) }) }))}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><TrashIcon color={semantic.danger} size={22} /></Pressable>}
            </View>
            <View style={{ flexDirection: 'row', gap: inline ? 6 : 8, flex: inline ? 1 : undefined }}>
              {mode?.load !== 'NONE' && <View style={{ flex: 1 }}>{!inline && <Text style={{ color: colors.textSecondary }}>{mode?.load === 'LEVEL' ? t('custom.LEVEL') : units.unit.toUpperCase()}</Text>}
                <NumericField compact accessibilityLabel={t('train.weight')} decimal value={mode?.load === 'LEVEL' ? set.actualLoadLevel : units.display(set.actualWeight)} onChangeValue={(value) => change(i, j, { [mode?.load === 'LEVEL' ? 'actualLoadLevel' : 'actualWeight']: mode?.load === 'LEVEL' ? value : units.store(value) })} /></View>}
              <View style={{ flex: 1 }}>{!inline && <Text style={{ color: colors.textSecondary }}>{timed ? 's' : t('train.reps')}</Text>}<NumericField compact accessibilityLabel={timed ? 's' : t('train.reps')} value={timed ? set.actualDurationSeconds : set.actualReps} onChangeValue={(value) => change(i, j, { [timed ? 'actualDurationSeconds' : 'actualReps']: value })} /></View>
              <View style={{ flex: 1 }}>{!inline && <Text style={{ color: colors.textSecondary }}>RIR</Text>}<NumericField compact editable={set.setType !== SetType.FAILURE} accessibilityLabel="RIR" value={set.setType === SetType.FAILURE ? 0 : set.actualRIR ?? undefined} onChangeValue={(value) => change(i, j, { actualRIR: value ?? null })} /></View>
            </View>
            {inline && <>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={t('historyEdit.completed')} accessibilityState={{ checked: isSetCompleted(set) }} disabled={busy}
                onPress={() => change(i, j, { completionState: isSetCompleted(set) ? 'PENDING' : 'DONE' })} style={{ width: 38, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: isSetCompleted(set) ? sectionAccent.train : 'transparent', borderWidth: 1, borderColor: colors.accentText, alignItems: 'center', justifyContent: 'center' }}>
                  {isSetCompleted(set) && <CheckIcon color={colors.onAccent} size={20} />}
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('workout.removeSet')} disabled={busy}
                onPress={() => setDraft(old => ({ ...old, exercises: old.exercises.map((item, index) => index !== i ? item : { ...item, sets: item.sets.filter((_row, index) => index !== j) }) }))}
                style={{ width: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><TrashIcon color={colors.textSecondary} size={20} /></Pressable>
            </>}
            </View>
            {!timed && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, color: colors.textSecondary }}>{t('trainingUpdates.partials')}</Text><View style={{ width: 88 }}><NumericField compact accessibilityLabel={t('workout.partialReps')} value={set.actualPartialReps} onChangeValue={(value) => change(i, j, { actualPartialReps: value })} /></View>
            </View>}
            {supportsExtensions(set.setType) && <View style={{ gap: 8 }}>
              {(set.extensions ?? []).map((extra, k) => <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ flex: 1, color: colors.textSecondary }}>{t('train.extension')} {k + 1}</Text>
                {mode?.load !== 'NONE' && <View style={{ width: 80 }}><Text style={{ color: colors.textSecondary }}>{units.unit.toUpperCase()}</Text><NumericField compact decimal value={units.display(extra.weight)} accessibilityLabel={`KG ${k + 1}`}
                  onChangeValue={(weight) => change(i, j, { extensions: set.extensions?.map((value, n) => n === k ? { ...value, weight: units.store(weight) } : value) })} /></View>}
                <View style={{ width: 80 }}><Text style={{ color: colors.textSecondary }}>{t('train.reps')}</Text><NumericField compact value={extra.reps} accessibilityLabel={`${t('train.extension')} ${k + 1}`}
                  onChangeValue={(reps) => change(i, j, { extensions: set.extensions?.map((value, n) => n === k ? { ...value, reps } : value) })} /></View>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('workout.removeSet')} ${k + 1}`} onPress={() => change(i, j, { extensions: set.extensions?.filter((_value, n) => n !== k) })} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><TrashIcon color={semantic.danger} size={20} /></Pressable>
              </View>)}
              <Pressable accessibilityRole="button" onPress={() => change(i, j, { extensions: [...(set.extensions ?? []), {}] })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>+ {t('train.extension')}</Text></Pressable>
            </View>}
          </View>;
        })}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDraft((old) => ({ ...old, exercises: old.exercises.map((item, index) => index !== i ? item : { ...item,
          sets: [...item.sets, { id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, setType: SetType.NORMAL, targetReps: 10, targetRIR: 2, targetWeight: 0, isAutoFilled: false, completionState: 'PENDING', ...(item.exerciseSnapshot?.recording ? { recording: item.exerciseSnapshot.recording } : {}) }] }) }))}
          style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>+ {t('train.sets')}</Text></Pressable>
      </View>; })}
      {error && <Text accessibilityRole="alert" style={{ color: semantic.danger }}>{t('historyEdit.failed')}</Text>}
      {!inline && <Pressable accessibilityRole="button" accessibilityLabel={t('custom.save')} disabled={busy} onPress={() => save()}
        style={{ minHeight: 52, marginTop: 24, ...surfaces.primary, backgroundColor: sectionAccent.train, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onAccent, fontWeight: '700' }}>{t('custom.save')}</Text></Pressable>
      }
      {session.mesocycleId && session.plannedSessionIndex !== undefined && <Pressable accessibilityRole="button" accessibilityLabel={t('historyProgression.saveReview')}
        disabled={busy} onPress={() => save(true)} style={{ minHeight: 52, marginTop: 12, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.accentText, fontWeight: '600' }}>{t('historyProgression.saveReview')}</Text>
      </Pressable>}
      {!inline && <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textPrimary }}>{t('generate.cancel')}</Text></Pressable>}
    </Container>
    <ActionMenuSheet title={typePicker ? t('prescription.setType') : null} onClose={() => setTypePicker(null)} actions={SELECTABLE_SET_TYPES.map((setType) => ({ label: t(`setType.${setType}`), onPress: () => {
      if (!typePicker) return;
      const row = draft.exercises[typePicker.exercise].sets[typePicker.set];
      change(typePicker.exercise, typePicker.set, { setType, ...(setType === SetType.FAILURE ? { actualRIR: 0 } : {}),
        extensions: supportsExtensions(setType) ? row.extensions?.length ? row.extensions : [{}] : undefined });
    } }))} />
  </>;
  return inline ? content : <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>{content}</Modal>;
}
