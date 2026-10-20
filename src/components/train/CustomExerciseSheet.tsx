/** A single native presentation with small, draft-preserving creation steps. */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Equipment, ExerciseProfile, MovementVector, MuscleGroup, type Exercise, type ExerciseRecording } from '@/models';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useTheme } from '@/theme/useTheme';

const STEPS = ['identity', 'muscles', 'equipment', 'patterns', 'review'] as const;
export function CustomExerciseSheet({ open, initialName = '', embedded = false, onClose, onCreated }: {
  open: boolean; initialName?: string; embedded?: boolean; onClose: () => void; onCreated: (exercise: Exercise) => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets(); const { create } = useExerciseCatalogue();
  const scroll = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [measure, setMeasure] = useState<ExerciseRecording['measure']>('REPETITIONS');
  const [load, setLoad] = useState<ExerciseRecording['load']>('NONE');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [secondary, setSecondary] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState(Equipment.UNSPECIFIED);
  const [profile, setProfile] = useState(ExerciseProfile.UNCLASSIFIED);
  const [vectors, setVectors] = useState<MovementVector[]>([]);
  const [perSide, setPerSide] = useState(false);
  const [notes, setNotes] = useState(''); const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) {
    setStep(0); setName(initialName); setMeasure('REPETITIONS'); setLoad('NONE'); setMuscles([]); setSecondary([]);
    setEquipment(Equipment.UNSPECIFIED); setProfile(ExerciseProfile.UNCLASSIFIED); setVectors([]);
    setPerSide(false); setNotes(''); setReference(''); setError(''); setBusy(false);
  } }, [open, initialName]);
  const move = (next: number) => {
    if (step === 0 && next > step && !name.trim()) { setError('invalidName'); return; }
    setError(''); setStep(next); scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const field = { ...typography.body, color: colors.textPrimary, backgroundColor: colors.bgElevated,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm, minHeight: 48 };
  const heading = (label: string, hint?: string) => <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{label}</Text>
    {hint && <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>{hint}</Text>}
  </View>;
  const choices = <T extends string,>(values: readonly T[], selected: readonly T[], choose: (value: T) => void,
    label: (value: T) => string, multiple = false) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
    {values.map((value) => { const checked = selected.includes(value); return <Pressable key={value} disabled={busy}
      accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={label(value)}
      accessibilityState={{ checked }} onPress={() => choose(value)} style={{ width: '48%', minHeight: 52, padding: spacing.md,
        borderRadius: radius.md, borderWidth: 1, borderColor: checked ? sectionAccent.train : colors.surfaceBorder,
        backgroundColor: colors.bgElevated, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text style={{ color: checked ? sectionAccent.train : colors.textMuted }}>{checked ? '✓' : '○'}</Text>
      <Text style={[typography.body, { flex: 1, color: colors.textPrimary }]}>{label(value)}</Text>
    </Pressable>; })}
  </View>;
  const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  const save = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const exercise = await create({ name, recording: { measure, load }, primaryMuscles: muscles, secondaryMuscles: secondary,
        equipment, profile, movementVectors: vectors, notes, referenceUrl: reference, laterality: perSide ? 'PER_SIDE' : 'BILATERAL' });
      onCreated(exercise);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'saveFailed'); }
    finally { setBusy(false); }
  };
  const content = <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom }}>
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('custom.title')}</Text>
        <Pressable disabled={busy} onPress={onClose} style={{ padding: spacing.sm }}>
          <Text style={[typography.body, { color: sectionAccent.train }]}>{t('generate.cancel')}</Text>
        </Pressable>
      </View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{t('exerciseWizard.progress', { current: step + 1, total: STEPS.length })}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>{STEPS.map((value, index) =>
        <View key={value} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: index <= step ? sectionAccent.train : colors.surfaceBorder }} />)}</View>
    </View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
      <Text style={[typography.h2, { color: colors.textPrimary }]}>{t(`exerciseWizard.${STEPS[step]}`)}</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>{t(`exerciseWizard.${STEPS[step]}Hint`)}</Text>
      {step === 0 && <>
        {heading(t('custom.name'))}
        <TextInput value={name} onChangeText={setName} maxLength={120} accessibilityLabel={t('custom.name')}
          placeholder={t('custom.name')} placeholderTextColor={colors.textMuted} style={field} />
        {heading(t('custom.recording'), t('exerciseWizard.recordingHint'))}
        {choices(['REPETITIONS', 'SECONDS'], [measure], setMeasure, (value) => t(`custom.${value}`))}
        {heading(t('custom.loadConvention'), t('exerciseWizard.loadHint'))}
        {choices(['NONE', 'TOTAL_KG', 'PER_HAND_KG', 'ADDED_KG', 'ASSISTANCE_KG', 'LEVEL'], [load], setLoad, (value) => t(`custom.${value}`))}
      </>}
      {step === 1 && <>
        {heading(t('custom.muscle'), t('custom.multipleMusclesHint'))}
        {choices(Object.values(MuscleGroup).filter((value) => value !== MuscleGroup.UNCLASSIFIED), muscles, (value) => {
          setMuscles((old) => toggle(old, value));
          setSecondary((old) => muscles.length === 1 && muscles.includes(value) ? [] : old.filter((entry) => entry !== value));
        }, (value) => t(`muscle.${value}`), true)}
        {muscles.length > 0 && <>
          {heading(t('custom.secondary'), t('exerciseWizard.secondaryHint'))}
          {choices(Object.values(MuscleGroup).filter((value) => value !== MuscleGroup.UNCLASSIFIED && !muscles.includes(value)), secondary,
            (value) => setSecondary((old) => toggle(old, value)), (value) => t(`muscle.${value}`), true)}
        </>}
      </>}
      {step === 2 && <>
        {heading(t('custom.equipment'))}
        {choices(Object.values(Equipment), [equipment], setEquipment, (value) => value === Equipment.UNSPECIFIED ? t('custom.unspecifiedEquipment') : t(`generate.equipment${value}`))}
        {heading(t('custom.profile'), t('exerciseWizard.profileHint'))}
        {choices(Object.values(ExerciseProfile), [profile], setProfile, (value) => t(`custom.${value}`))}
        {heading(t('custom.execution'))}
        {choices(['PER_SIDE'], perSide ? ['PER_SIDE'] : [], () => setPerSide(!perSide), () => t('custom.perSide'), true)}
      </>}
      {step === 3 && <>
        {heading(t('custom.movement'), t('exerciseWizard.patternsHint'))}
        {choices(Object.values(MovementVector).filter((value) => value !== MovementVector.UNCLASSIFIED), vectors,
          (value) => setVectors((old) => toggle(old, value)), (value) => t(`custom.movements.${value}`), true)}
      </>}
      {step === 4 && <>
        <View style={{ backgroundColor: colors.bgElevated, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, marginTop: spacing.lg }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{name.trim()}</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`custom.${measure}`)} · {t(`custom.${load}`)}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{muscles.length ? muscles.map((value) => t(`muscle.${value}`)).join(' · ') : t('custom.UNCLASSIFIED')}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{vectors.length ? vectors.map((value) => t(`custom.movements.${value}`)).join(' · ') : t('custom.UNCLASSIFIED')}</Text>
        </View>
        {heading(t('custom.notes'))}
        <TextInput value={notes} onChangeText={setNotes} maxLength={2000} multiline accessibilityLabel={t('custom.notes')}
          placeholder={t('custom.notes')} placeholderTextColor={colors.textMuted} style={[field, { minHeight: 100 }]} />
        {heading(t('custom.reference'))}
        <TextInput value={reference} onChangeText={setReference} maxLength={1000} autoCapitalize="none" accessibilityLabel={t('custom.reference')}
          placeholder="https://…" placeholderTextColor={colors.textMuted} style={field} />
        <Text style={[typography.caption, { color: colors.textMuted, marginVertical: spacing.lg }]}>{t('custom.manualOnly')}</Text>
      </>}
    </ScrollView>
    {!!error && <Text accessibilityRole="alert" style={[typography.caption, { color: colors.textPrimary, paddingHorizontal: spacing.lg }]}>{t(`custom.${error}`, { defaultValue: t('custom.saveFailed') })}</Text>}
    <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg }}>
      {step > 0 && <Pressable disabled={busy} onPress={() => move(step - 1)} style={{ padding: spacing.md }}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{t('exerciseWizard.back')}</Text>
      </Pressable>}
      <Pressable disabled={busy} onPress={step === STEPS.length - 1 ? save : () => move(step + 1)} style={{ flex: 1, padding: spacing.md,
        alignItems: 'center', borderRadius: radius.md, backgroundColor: sectionAccent.train }}>
        <Text style={[typography.body, { color: colors.bg, fontWeight: '600' }]}>{t(step === STEPS.length - 1 ? busy ? 'custom.saving' : 'custom.save' : 'exerciseWizard.next')}</Text>
      </Pressable>
    </View>
  </View>;
  return embedded ? content : <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) { if (step > 0) move(step - 1); else onClose(); } }}>{content}</Modal>;
}
