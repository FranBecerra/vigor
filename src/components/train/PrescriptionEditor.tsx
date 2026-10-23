import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { SetType, type PlannedExercise, type PlannedSet } from '@/models';
import { editNumericDraft } from '@/services/training/workoutExecution';
import { parseNumericText } from '@/services/training/numericDraft';
import { prescriptionPatch, type PrescriptionField } from '@/services/training/prescriptionEntry';
import { SELECTABLE_SET_TYPES, setTypeLabel } from './setTypeLabel';

type Selection = { index: number; field: PrescriptionField };
interface Props {
  exercise: PlannedExercise; restSeconds: number;
  onChangeSet: (index: number, patch: Partial<PlannedSet>) => void;
  onChangeCount?: (count: number) => void;
  onChangeRest?: (seconds: number) => void;
}

/** A single line per set, with one persistent keypad for the entire exercise. */
export function PrescriptionEditor({ exercise, restSeconds, onChangeSet, onChangeCount, onChangeRest }: Props) {
  const { t } = useTranslation(); const { colors, radius } = useTheme();
  const [selection, setSelection] = useState<Selection | null>(null);
  const workCount = exercise.sets.filter((set) => set.setType !== SetType.TOP_SINGLE).length;
  const timed = exercise.sets.some((set) => set.targetDurationSeconds !== undefined);
  const cell = (label: string, value: string, onPress: () => void, disabled = false, flex = 1) =>
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={{ flex, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.bgElevated, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </Pressable>;
  return <View style={{ gap: 6, marginTop: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {onChangeRest && cell(t('calendar.restSeconds'), `${t('calendar.rest')} · ${restSeconds}s`, () => setSelection({ index: 0, field: 'rest' }), false, 2)}
      {onChangeCount && <>
        {cell(t('prescription.removeSet'), '−', () => onChangeCount(workCount - 1), workCount <= 1)}
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{workCount}</Text>
        {cell(t('train.addSet'), '+', () => onChangeCount(workCount + 1), workCount >= 30)}
      </>}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
      <Text style={{ width: 32, color: colors.textMuted, fontSize: 12 }}>SET</Text>
      <Text style={{ flex: 2, textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>{t(timed ? 'rehab.seconds' : 'train.reps')}</Text>
      {!timed && <Text style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>RIR</Text>}
    </View>
    {exercise.sets.map((set, index) => <View key={index} testID={`prescription-row-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('prescription.setType')} ${index + 1}`} disabled={set.setType === SetType.TOP_SINGLE}
        onPress={() => setSelection({ index, field: 'type' })} style={{ width: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElevated, borderRadius: radius.sm }}>
        <Text style={{ color: colors.accentText, fontSize: 14, fontWeight: '700' }}>{setTypeLabel(set.setType) || index + 1}</Text>
      </Pressable>
      {cell(`${t('train.reps')} ${index + 1}`, set.targetDurationSeconds !== undefined ? `${set.targetDurationSeconds}s`
        : (set.targetRepsMin ?? set.targetReps) === set.targetReps ? String(set.targetReps) : `${set.targetRepsMin}–${set.targetReps}`,
      () => setSelection({ index, field: set.targetDurationSeconds !== undefined ? 'seconds' : 'reps' }), set.setType === SetType.TOP_SINGLE, 2)}
      {!timed && cell(`RIR ${index + 1}`, String(set.targetRIR), () => setSelection({ index, field: 'rir' }), set.setType === SetType.TOP_SINGLE)}
    </View>)}
    {selection && <PrescriptionEntrySheet {...{ exercise, restSeconds, onChangeSet, onChangeRest }} selection={selection} onClose={() => setSelection(null)} />}
  </View>;
}

function PrescriptionEntrySheet({ exercise, restSeconds, selection, onChangeSet, onChangeRest, onClose }: Props & { selection: Selection; onClose: () => void }) {
  const { t } = useTranslation(); const { colors, radius, sectionAccent } = useTheme(); const insets = useSafeAreaInsets();
  const [sets, setSets] = useState(() => exercise.sets.map((set) => ({ ...set })));
  const [rest, setRest] = useState(restSeconds);
  const [active, setActive] = useState(selection);
  const valueOf = (where: Selection, list = sets, seconds = rest) => {
    const set = list[where.index];
    return where.field === 'rest' ? seconds : where.field === 'rir' ? set.targetRIR : where.field === 'seconds' ? set.targetDurationSeconds
      : where.field === 'min' ? set.targetRepsMin ?? set.targetReps : set.targetReps;
  };
  const [text, setText] = useState(() => String(valueOf(selection) ?? ''));
  const [replace, setReplace] = useState(true);
  const dirty = useRef(false);
  const commit = (input = text, force = false) => {
    if ((!dirty.current && !force) || active.field === 'type') return { list: sets, seconds: rest };
    dirty.current = false;
    const value = parseNumericText(input, false);
    if (value === undefined) return { list: sets, seconds: rest };
    if (active.field === 'rest') {
      const seconds = Math.max(0, Math.min(3600, Math.trunc(value))); setRest(seconds); onChangeRest?.(seconds);
      return { list: sets, seconds };
    }
    const patch = prescriptionPatch(sets[active.index], active.field, value);
    const list = sets.map((set, index) => index === active.index ? { ...set, ...patch } : set);
    setSets(list); onChangeSet(active.index, patch); return { list, seconds: rest };
  };
  const select = (next: Selection) => {
    const { list, seconds } = commit(); setActive(next); setText(String(valueOf(next, list, seconds) ?? '')); setReplace(true);
  };
  const close = () => { commit(); onClose(); };
  const label = (field: PrescriptionField) => field === 'rir' ? 'RIR' : t(field === 'min' ? 'prescription.minReps' : field === 'max' ? 'prescription.maxReps'
    : field === 'rest' ? 'calendar.restSeconds' : field === 'seconds' ? 'rehab.seconds' : 'train.reps');
  const timed = sets[active.index]?.targetDurationSeconds !== undefined;
  const fields: PrescriptionField[] = active.field === 'rest' ? ['rest'] : timed ? ['seconds'] : ['reps', 'min', 'max', 'rir'];
  const validIndexes = sets.flatMap((set, index) => set.setType === SetType.TOP_SINGLE ? [] : [index]);
  const position = validIndexes.indexOf(active.index);
  const invalid = sets.some((set) => set.targetDurationSeconds === undefined && (set.targetRepsMin ?? set.targetReps) > set.targetReps);
  return <Modal visible transparent animationType="slide" onRequestClose={close}>
    <Pressable accessibilityLabel={t('workout.done')} onPress={close} style={{ flex: 1, backgroundColor: '#0005' }} />
    <View accessibilityViewIsModal style={{ padding: 12, gap: 8, paddingBottom: Math.max(8, insets.bottom), backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {active.field !== 'rest' && <Pressable accessibilityLabel={t('prescription.previousSet')} disabled={position <= 0}
          onPress={() => select({ ...active, index: validIndexes[position - 1] })} style={{ padding: 12, opacity: position <= 0 ? 0.3 : 1 }}><Text style={{ color: colors.textPrimary, fontSize: 22 }}>‹</Text></Pressable>}
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 16 }}>{active.field === 'rest' ? t('calendar.rest') : t('prescription.setOf', { current: position + 1, total: validIndexes.length })}</Text>
        {active.field !== 'rest' && <Pressable accessibilityRole="button" accessibilityLabel={t('prescription.setType')} onPress={() => select({ ...active, field: 'type' })} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' }}>
          <Text style={{ color: colors.accentText }}>{setTypeLabel(sets[active.index].setType) || t('setType.NORMAL')}</Text>
        </Pressable>}
        {active.field !== 'rest' && <Pressable accessibilityLabel={t('prescription.nextSet')} disabled={position >= validIndexes.length - 1}
          onPress={() => select({ ...active, index: validIndexes[position + 1] })} style={{ padding: 12, opacity: position >= validIndexes.length - 1 ? 0.3 : 1 }}><Text style={{ color: colors.accentText, fontSize: 22 }}>›</Text></Pressable>}
        <Pressable accessibilityLabel={t('workout.done')} onPress={close} style={{ padding: 12 }}><Text style={{ color: colors.accentText, fontSize: 18 }}>✓</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>{fields.map((field) => <Pressable key={field} accessibilityRole="tab" accessibilityLabel={label(field)} accessibilityState={{ selected: active.field === field }}
        onPress={() => select({ ...active, field })} style={{ flex: 1, height: 76, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: active.field === field ? sectionAccent.train : colors.surfaceBorder, borderRadius: radius.sm }}>
        <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', minHeight: 28 }}>{label(field)}</Text>
        <Text testID={`prescription-value-${field}`} style={{ color: active.field === field ? colors.accentText : colors.textPrimary, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{active.field === field ? text || '—' : valueOf({ ...active, field }) ?? '—'}</Text>
      </Pressable>)}</View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, minHeight: 18 }}>{invalid ? t('exerciseEditor.invalidRange') : active.field === 'type' ? t('prescription.setType') : active.field === 'rir' && sets[active.index].setType === SetType.FAILURE ? t('prescription.failureRIR') : ' '}</Text>
      <View testID="prescription-keypad" style={{ height: 184, gap: 6 }}>
      {active.field === 'type' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{SELECTABLE_SET_TYPES.map((type) => <Pressable key={type} accessibilityRole="button" accessibilityLabel={t(`setType.${type}`)} accessibilityState={{ selected: sets[active.index].setType === type }}
        onPress={() => {
          const patch = { setType: type, ...(type === SetType.FAILURE ? { targetRIR: 0 } : {}) };
          setSets((previous) => previous.map((set, index) => index === active.index ? { ...set, ...patch } : set)); onChangeSet(active.index, patch);
        }} style={{ width: '48%', minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surface }}>
        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{t(`setType.${type}`)}</Text></Pressable>)}</View>
        : ['123', '456', '789', ' 0⌫'].map((row) => <View key={row} style={{ flexDirection: 'row', gap: 6 }}>{[...row].map((key) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === '⌫' ? t('workout.eraseDigit') : key}
          disabled={key === ' ' || active.field === 'rir' && (sets[active.index].setType === SetType.FAILURE || Number(key) > 5)}
          onPress={() => { dirty.current = true; setText(editNumericDraft(replace && /^\d$/.test(key) ? '' : text, key === '⌫' ? 'backspace' : key, false)); setReplace(active.field === 'rir'); }}
          onLongPress={key === '⌫' ? () => { dirty.current = true; setText(''); setReplace(false); } : undefined}
          style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: key === ' ' ? 'transparent' : colors.surface }}>
          <Text style={{ color: active.field === 'rir' && Number(key) > 5 ? colors.textMuted : colors.textPrimary, fontSize: 22 }}>{key}</Text></Pressable>)}</View>)}
      </View>
    </View>
  </Modal>;
}
