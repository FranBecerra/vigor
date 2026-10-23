/** A single native presentation with small, draft-preserving creation steps. */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Equipment, ExerciseApparatus, ExerciseProfile, MovementVector, MuscleGroup, type Exercise, type ExerciseRecording, type ExerciseCriteria } from '@/models';
import { CRITERIA_KEYS, exerciseEditInput } from '@/services/training/exerciseEditing';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useTheme } from '@/theme/useTheme';

const STEPS = ['identity', 'muscles', 'equipment', 'patterns', 'review'] as const;
export function CustomExerciseSheet({ open, initialName = '', embedded = false, exercise, onClose, onCreated }: {
  open: boolean; initialName?: string; embedded?: boolean; exercise?: Exercise; onClose: () => void; onCreated: (exercise: Exercise) => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets(); const { create, edit } = useExerciseCatalogue();
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
  const [criteria, setCriteria] = useState<ExerciseCriteria | null>(null);
  const [apparatus, setApparatus] = useState<ExerciseApparatus[] | null>(null);
  const [showApparatus, setShowApparatus] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) {
    setStep(0); setName(initialName); setMeasure('REPETITIONS'); setLoad('NONE'); setMuscles([]); setSecondary([]);
    setEquipment(Equipment.UNSPECIFIED); setProfile(ExerciseProfile.UNCLASSIFIED); setVectors([]);
    setPerSide(false); setNotes(''); setReference(''); setError(''); setBusy(false);
    setCriteria(null); setApparatus(null); setShowApparatus(false);
    if (exercise) {
      const input = exerciseEditInput(exercise);
      setName(input.name); setMeasure(input.recording.measure); setLoad(input.recording.load); setMuscles(input.primaryMuscles ?? []);
      setSecondary(input.secondaryMuscles ?? []); setEquipment(input.equipment!); setProfile(input.profile!); setVectors(input.movementVectors ?? []);
      setPerSide(input.laterality === 'PER_SIDE'); setNotes(input.notes ?? ''); setReference(input.referenceUrl ?? '');
      setCriteria(input.criteria ?? null); setApparatus(input.requiredApparatus ?? null);
    }
  } }, [open, initialName, exercise?.id]);
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
      <Text style={{ color: checked ? colors.accentText : colors.textMuted }}>{checked ? '✓' : '○'}</Text>
      <Text style={[typography.body, { flex: 1, color: colors.textPrimary }]}>{label(value)}</Text>
    </Pressable>; })}
  </View>;
  const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  const save = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const input = { name, recording: { measure, load }, primaryMuscles: muscles, secondaryMuscles: secondary,
        equipment, profile, movementVectors: vectors, notes, referenceUrl: reference, laterality: perSide ? 'PER_SIDE' as const : 'BILATERAL' as const };
      const saved = exercise ? await edit(exercise, { ...input, criteria, ...(apparatus === null ? {} : { requiredApparatus: apparatus }) }) : await create(input);
      onCreated(saved);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'saveFailed'); }
    finally { setBusy(false); }
  };
  const content = <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom }}>
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>{t(exercise ? 'library.edit' : 'custom.title')}</Text>
        <Pressable disabled={busy} onPress={onClose} style={{ padding: spacing.sm }}>
          <Text style={[typography.body, { color: colors.accentText }]}>{t('generate.cancel')}</Text>
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
        {exercise && <>
          <Pressable accessibilityRole="button" onPress={() => setShowApparatus(!showApparatus)} style={{ minHeight: 48, justifyContent: 'center', marginTop: 12 }}>
            <Text style={[typography.body, { color: colors.accentText }]}>{t('library.apparatus')} {showApparatus ? '−' : '+'}</Text>
          </Pressable>
          {showApparatus && choices(Object.values(ExerciseApparatus), apparatus ?? [], (value) => setApparatus((old) => toggle(old ?? [], value)),
            (value) => t(`library.apparatusNames.${value}`, { defaultValue: value.toLowerCase().replace(/_/g, ' ') }), true)}
        </>}
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
        {heading(t(exercise ? 'library.description' : 'custom.notes'))}
        <TextInput value={notes} onChangeText={setNotes} maxLength={2000} multiline accessibilityLabel={t(exercise ? 'library.description' : 'custom.notes')}
          placeholder={t('custom.notes')} placeholderTextColor={colors.textMuted} style={[field, { minHeight: 100 }]} />
        {heading(t('custom.reference'))}
        <TextInput value={reference} onChangeText={setReference} maxLength={1000} autoCapitalize="none" accessibilityLabel={t('custom.reference')}
          placeholder="https://…" placeholderTextColor={colors.textMuted} style={field} />
        <Text style={[typography.caption, { color: colors.textMuted, marginVertical: spacing.lg }]}>{t(exercise ? 'library.privateHint' : 'custom.manualOnly')}</Text>
        {exercise && <>
          {heading(t('library.ratings'), t('library.ratingHint'))}
          <Pressable accessibilityRole="button" onPress={() => setCriteria(criteria ? null : Object.fromEntries(CRITERIA_KEYS.map((key) => [key, 3])) as unknown as ExerciseCriteria)} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text style={[typography.body, { color: colors.accentText }]}>{t(criteria ? 'library.clearRatings' : 'library.addRatings')}</Text>
          </Pressable>
          {criteria && CRITERIA_KEYS.map((key) => <View key={key} style={{ marginVertical: spacing.sm }}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>{t(`library.criteria.${key}`)}</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginVertical: 6 }]}>{t(`library.criteriaHints.${key}`)}</Text>
            <View style={{ flexDirection: 'row', gap: 7 }}>{([1, 2, 3, 4, 5] as const).map((value) => <Pressable key={value} accessibilityRole="radio"
              accessibilityLabel={`${t(`library.criteria.${key}`)}: ${value}`} accessibilityState={{ checked: criteria[key] === value }}
              disabled={busy} onPress={() => setCriteria((old) => ({ ...old!, [key]: value }))} style={{ flex: 1, minHeight: 48, borderRadius: radius.md,
                alignItems: 'center', justifyContent: 'center', backgroundColor: criteria[key] === value ? sectionAccent.train : colors.surface }}>
              <Text style={[typography.body, { color: criteria[key] === value ? colors.onAccent : colors.textPrimary }]}>{value}</Text>
            </Pressable>)}</View>
          </View>)}
        </>}
      </>}
    </ScrollView>
    {!!error && <Text accessibilityRole="alert" style={[typography.caption, { color: colors.textPrimary, paddingHorizontal: spacing.lg }]}>{t(error === 'invalidCriteria' ? 'library.invalidCriteria' : `custom.${error}`, { defaultValue: t('custom.saveFailed') })}</Text>}
    <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg }}>
      {step > 0 && <Pressable disabled={busy} onPress={() => move(step - 1)} style={{ padding: spacing.md }}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{t('exerciseWizard.back')}</Text>
      </Pressable>}
      <Pressable disabled={busy} onPress={step === STEPS.length - 1 ? save : () => move(step + 1)} style={{ flex: 1, padding: spacing.md,
        alignItems: 'center', borderRadius: radius.md, backgroundColor: sectionAccent.train }}>
        <Text style={[typography.body, { color: colors.onAccent, fontWeight: '600' }]}>{t(step === STEPS.length - 1 ? busy ? 'custom.saving' : 'custom.save' : 'exerciseWizard.next')}</Text>
      </Pressable>
    </View>
  </View>;
  return embedded ? content : <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) { if (step > 0) move(step - 1); else onClose(); } }}>{content}</Modal>;
}
