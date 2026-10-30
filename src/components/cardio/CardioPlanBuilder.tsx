import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { NumericField } from '@/components/train/NumericField';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { InfoIcon } from '@/components/icons/ActionIcons';
import type { CardioExperienceStatus } from '@/models/cardio';
import { useAthleteIntakeDefaults, useAthleteIntakeReady } from '@/hooks/AthleteIntakeContext';
import { cardioIntakeDefaults } from '@/services/settings/athleteIntake';
import { AthleteDefaultsLoading } from '@/components/profile/AthleteDefaultsLoading';
import { CardioCycleView } from './CardioCycleView';
import type { RoutineView } from '@/services/training/routineView';
import { CARDIO_MODALITIES, buildCardioPreview, cardioPreviewIssue, strengthPlacements, suggestCardioCapacity, type CardioPreviewInput, type CardioPreview, type CardioStrengthPlacement } from '@/services/cardio/cardioPreview';
import { freshReviewedCardioStart, reviewedCardioDefaults, type ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';

const statuses: CardioExperienceStatus[] = ['NEW', 'RETURNING', 'REGULAR', 'UNSURE'];

type BuilderProps = {
  initialBaseline?: ReviewedCardioStart;
  routine?: RoutineView; ready: boolean; error: boolean; onRetry: () => void; onCancel: () => void;
  onSave?: (name: string, input: CardioPreviewInput, healthSaveAccepted?: boolean) => Promise<void>;
};
export function CardioPlanBuilder(props: BuilderProps) {
  const ready = useAthleteIntakeReady();
  const { t } = useTranslation(), { surfaces, colors, radius } = useTheme();
  if (props.initialBaseline && !freshReviewedCardioStart(props.initialBaseline, Date.now())) return <View style={{ ...surfaces.screen, flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}>
    <Text accessibilityRole="alert" style={{ color: colors.textPrimary, fontSize: 18 }}>{t('healthPlanning.expired')}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('generate.cancel')} onPress={props.onCancel} style={{ ...surfaces.field, padding: 16, minHeight: 48, borderRadius: radius.md }}>
      <Text style={{ color: colors.accentText, fontSize: 17 }}>{t('generate.cancel')}</Text>
    </Pressable></View>;
  return ready ? <OwnedCardioPlanBuilder {...props} /> : <AthleteDefaultsLoading onCancel={props.onCancel} />;
}
function OwnedCardioPlanBuilder({ routine, ready, error, onRetry, onCancel, onSave, initialBaseline }: BuilderProps) {
  const { t } = useTranslation(); const { colors, surfaces, radius, semantic } = useTheme(); const insets = useSafeAreaInsets();
  const source = routine ? strengthPlacements(routine, true) : { sessions: [] as CardioStrengthPlacement[] };
  const initialCycle = initialBaseline?.cycleDays ?? Math.max(7, source.cycleDays ?? 7);
  const [step, setStep] = useState(0), [preview, setPreview] = useState<CardioPreview | null>(null);
  const intake = useAthleteIntakeDefaults();
  const [input, setInput] = useState<CardioPreviewInput>(() => ({ placementPolicy: 'BALANCED_V2', ...cardioIntakeDefaults(intake),
    cycleDays: initialCycle, availableDays: Array.from({ length: initialCycle }, (_, i) => i), sessions: 2, cardioMinutes: 40, sessionMinutes: 20,
    maxActiveDays: Math.min(initialCycle, source.sessions.length + (initialBaseline?.sessions ?? 2)), allowDoubles: false,
    strength: source.sessions.map(s => initialBaseline && s.dayIndex !== undefined && s.dayIndex >= initialCycle ? { ...s, dayIndex: undefined } : s),
    ...(initialBaseline ? reviewedCardioDefaults(initialBaseline, cardioIntakeDefaults(intake).profile) : {}) }));
  const [useStrength, setUseStrength] = useState(true), [strengthChanged, setStrengthChanged] = useState(false);
  const [details, setDetails] = useState<'INFO' | null>(null);
  const [editStrengthDays, setEditStrengthDays] = useState(() => source.sessions.some(s => s.dayIndex === undefined));
  const [name, setName] = useState(''), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(false);
  const [healthSaveAccepted, setHealthSaveAccepted] = useState(false);
  const savingRef = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const signature = JSON.stringify([routine?.id, source]); const previousSource = useRef(signature);
  useEffect(() => {
    if (previousSource.current === signature) return;
    previousSource.current = signature;
    if (useStrength) {
      setInput(old => ({ ...old, strength: source.sessions })); setStrengthChanged(true);
      setEditStrengthDays(source.sessions.some(s => s.dayIndex === undefined));
      setPreview(null); setDetails(null); setStep(value => Math.min(value, 2));
    }
  }, [signature, useStrength]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (savingRef.current) return true;
      if (!step) return false;
      setStep(value => value - 1); return true;
    });
    return () => listener.remove();
  }, [step]);
  const patch = (value: Partial<CardioPreviewInput>) => { setHealthSaveAccepted(false); setInput(old => ({ ...old, ...value })); };
  useEffect(() => { setHealthSaveAccepted(false); }, [input]);
  const issue = cardioPreviewIssue(input);
  let capacitySuggestion: ReturnType<typeof suggestCardioCapacity> | null = null;
  try { capacitySuggestion = suggestCardioCapacity(input); } catch { /* Invalid intake must be corrected before suggesting limits. */ }
  const surface = { ...surfaces.card, borderRadius: radius.lg, padding: 18, marginBottom: 14 };
  const text = { color: colors.textPrimary, fontSize: 16 };
  const caption = { color: colors.textSecondary, fontSize: 13, lineHeight: 19 };
  const label = (value: string) => <Text style={[text, { fontWeight: '600', marginBottom: 12 }]}>{value}</Text>;
  const action = (title: string, press: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={title}
    disabled={disabled || saving} onPress={press} style={{ minHeight: 48, padding: 12, marginTop: 10, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center', ...(primary ? surfaces.primary : surfaces.field), opacity: disabled ? 0.4 : 1 }}>
    <Text style={{ fontSize: 16, fontWeight: '600', color: primary ? colors.onAccent : colors.accentText }}>{title}</Text>
  </Pressable>;
  const chip = (title: string, selected: boolean, onPress: () => void, disabled = false) => <Pressable key={title} accessibilityRole="checkbox" accessibilityLabel={title}
    disabled={disabled} accessibilityState={{ checked: selected, disabled }} onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 13, paddingVertical: 11,
      borderRadius: radius.md, backgroundColor: selected ? colors.accentTint : colors.surface, borderWidth: 1,
      borderColor: selected ? colors.accentText : colors.surfaceBorder, justifyContent: 'center' }}>
    <Text style={{ color: selected ? colors.accentText : colors.textPrimary, fontSize: 14 }}>{title}</Text>
  </Pressable>;
  const changeCycle = (cycleDays: number) => setInput(old => ({ ...old, cycleDays,
    availableDays: Array.from({ length: cycleDays }, (_, day) => day < old.cycleDays ? old.availableDays.includes(day) ? day : -1 : day).filter(day => day >= 0),
    maxActiveDays: Math.min(old.maxActiveDays, cycleDays),
    strength: old.strength.map(s => s.dayIndex !== undefined && s.dayIndex >= cycleDays ? { ...s, dayIndex: undefined } : s) }));
  const review = () => { if (!issue && ready && !error) { setPreview(buildCardioPreview(input)); setStep(3); } };
  const save = async () => {
    if (!onSave || savingRef.current || !name.trim() || !preview?.scheduled.length || !ready || error
      || input.healthBaseline && (!healthSaveAccepted || !freshReviewedCardioStart(input.healthBaseline, Date.now()))) return;
    savingRef.current = true; setSaving(true); setSaveError(false);
    try { if (input.healthBaseline) await onSave(name.trim(), input, true); else await onSave(name.trim(), input); } catch { setSaveError(true); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <View style={{ flex: 1, ...surfaces.screen, paddingTop: insets.top }}>
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('generate.back')} disabled={saving} onPress={() => step ? setStep(step - 1) : onCancel()}
          style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 16 }}>‹ {t('generate.back')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('generate.cancel')} disabled={saving} onPress={onCancel}
          style={{ minHeight: 44, justifyContent: 'center' }}><Text style={caption}>{t('generate.cancel')}</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.accentText, fontSize: 12, marginBottom: 8 }}>{t('cardioPlan.previewLabel')}</Text>
          <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 29, fontWeight: '700' }}>{t(`cardioPlan.step${step}`)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cardioPlan.info')} onPress={() => setDetails('INFO')}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><InfoIcon color={colors.textSecondary} size={22} /></Pressable>
      </View>
      {input.healthBaseline && <View style={surface}>
        <Text style={[text, { fontWeight: '700' }]}>{t('healthPlanning.applied', { sessions: input.healthBaseline.sessions, minutes: input.healthBaseline.sessionMinutes, days: input.healthBaseline.cycleDays })}</Text>
        <Text style={[caption, { marginTop: 8 }]}>{t('healthPlanning.limits')}</Text>
        {step < 3 && action(t('healthPlanning.remove'), () => patch({ healthBaseline: undefined, sessions: 2, sessionMinutes: 20, cardioMinutes: 40,
          maxActiveDays: Math.min(input.cycleDays, input.strength.length + 2) }))}
      </View>}
      {step === 0 && <>
        <Text style={[caption, { marginBottom: 18 }]}>{t('cardioPlan.foundation')}</Text>
        {CARDIO_MODALITIES.map(modality => <View key={modality} style={{ marginBottom: 10 }}>{chip(t(`cardioPlan.${modality}`), input.modalities.includes(modality), () => {
          const modalities = CARDIO_MODALITIES.filter(m => m === modality ? !input.modalities.includes(m) : input.modalities.includes(m));
          patch({ modalities, sessions: Math.max(input.sessions, modalities.length) });
        }, !!input.healthBaseline)}</View>)}
      </>}
      {step === 1 && input.modalities.map(modality => {
        const current = input.profile.modalities[modality] ?? { status: 'UNSURE' as const, qualityExposure: 'UNKNOWN' as const };
        const update = (value: Partial<typeof current>) => patch({ profile: { schemaVersion: 1, modalities: { ...input.profile.modalities, [modality]: { ...current, ...value } } } });
        return <View key={modality} style={surface}>{label(t(`cardioPlan.${modality}`))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>{statuses.map(status => chip(t(`cardioPlan.${status}`), current.status === status, () => update({ status })))}</View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={[text, { flex: 1 }]}>{t('cardioPlan.currentDuration')}</Text>
            <View style={{ width: 85 }}><NumericField compact value={current.typicalSessionMinutes} accessibilityLabel={t('cardioPlan.durationFor', { modality: t(`cardioPlan.${modality}`) })}
              onChangeValue={typicalSessionMinutes => update({ typicalSessionMinutes })} /></View>
          </View><Text style={[caption, { marginTop: 10 }]}>{t('cardioPlan.durationHint')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <Text style={[text, { flex: 1 }]}>{t('cardioGuidance.currentFrequency')}</Text>
            <View style={{ width: 85 }}><NumericField compact value={current.sessionsPerWeek} accessibilityLabel={t('cardioGuidance.frequencyFor', { modality: t(`cardioPlan.${modality}`) })}
              onChangeValue={sessionsPerWeek => update({ sessionsPerWeek })} /></View>
          </View>
        </View>;
      })}
      {step === 2 && <>
        <View style={surface}>
          {action(t('cardioGuidance.suggest'), () => { if (capacitySuggestion) patch(capacitySuggestion); }, false, !capacitySuggestion)}
          <Text style={[caption, { marginTop: 8, marginBottom: 18 }]}>{t('cardioGuidance.startingPoint')}</Text>
          {[
            ['cycle', input.cycleDays, input.healthBaseline?.cycleDays ?? 7, input.healthBaseline?.cycleDays ?? 31, changeCycle],
            ['sessions', input.sessions, input.modalities.length, input.healthBaseline?.sessions ?? 14, (sessions: number) => patch({ sessions })],
            ['cardioBudget', input.cardioMinutes, 5, 1440, (cardioMinutes: number) => patch({ cardioMinutes })],
            ['sessionLimit', input.sessionMinutes, 5, 600, (sessionMinutes: number) => patch({ sessionMinutes })],
            ['activeLimit', input.maxActiveDays, 1, input.cycleDays, (maxActiveDays: number) => patch({ maxActiveDays })],
          ].map(([key, value, min, max, onChange]) => <View key={String(key)} style={{ marginBottom: 10 }}><Stepper label={t(`cardioPlan.${key}`)} value={value as number} min={min as number} max={max as number}
            step={['cardioBudget', 'sessionLimit'].includes(String(key)) ? 5 : 1} onChange={onChange as (n: number) => void} /></View>)}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 }}>
            <Text style={[text, { flex: 1 }]}>{t('cardioPlan.doubles')}</Text><Switch accessibilityLabel={t('cardioPlan.doubles')} value={input.allowDoubles} onValueChange={allowDoubles => patch({ allowDoubles })} />
          </View>
        </View>
        <View style={surface}>{label(t('cardioPlan.availableDays'))}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: input.cycleDays }, (_, day) => chip(t('cardioPlan.day', { day: day + 1 }), input.availableDays.includes(day), () => patch({ availableDays: input.availableDays.includes(day) ? input.availableDays.filter(d => d !== day) : [...input.availableDays, day].sort((a, b) => a - b) })))}
        </View></View>
        {!ready && !error && <Text style={caption}>{t('cardioPlan.loading')}</Text>}
        {error && <View><Text accessibilityRole="alert" style={caption}>{t('home.retry')}</Text>{action(t('home.retry'), onRetry)}</View>}
        {strengthChanged && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginBottom: 12 }}>{t('cardioPlan.strengthChanged')}</Text>}
        {routine && <View style={surface}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ flex: 1 }}>
          {label(t('cardioPlan.strengthContext'))}<Text style={caption}>{routine.name}</Text></View>
          <Switch accessibilityLabel={t('cardioPlan.strengthContext')} value={useStrength} onValueChange={enabled => {
            setUseStrength(enabled); setStrengthChanged(false);
            setEditStrengthDays(enabled && source.sessions.some(s => s.dayIndex === undefined));
            const days = input.healthBaseline ? input.cycleDays : enabled ? Math.max(input.cycleDays, source.cycleDays ?? input.cycleDays) : input.cycleDays;
            setInput(old => ({ ...old, cycleDays: days, availableDays: days === old.cycleDays ? old.availableDays : Array.from({ length: days }, (_, i) => i),
              maxActiveDays: Math.min(days, Math.max(old.maxActiveDays, enabled ? source.sessions.length : 1)), strength: enabled ? source.sessions : [] }));
          }} /></View>
          {useStrength && <>
            <Text style={[caption, { marginTop: 12 }]}>{t('cardioGuidance.strengthRhythm', { names: input.strength.map(s => s.name).join(' → ') })}</Text>
            {action(t(editStrengthDays ? 'cardioGuidance.hidePlacement' : 'cardioGuidance.editPlacement'), () => setEditStrengthDays(value => !value))}
            {(editStrengthDays || input.strength.some(s => s.dayIndex === undefined)) && <><Text style={[caption, { marginTop: 12 }]}>{t('cardioPlan.placementHint')}</Text>
            {input.strength.map((s, index) => <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <Text style={[text, { flex: 1 }]}>{s.name}</Text><View style={{ width: 85 }}><NumericField compact accessibilityLabel={t('cardioPlan.strengthDay', { name: s.name })} value={s.dayIndex === undefined ? undefined : s.dayIndex + 1}
                onChangeValue={value => { setEditStrengthDays(true); patch({ strength: input.strength.map((old, i) => i === index ? { ...old, dayIndex: value === undefined ? undefined : value - 1 } : old) }); }} /></View>
            </View>)}
            </>}
          </>}
        </View>}
      </>}
      {step === 3 && preview && <>
        <CardioCycleView input={input} preview={preview} />
        {action(t('cardioPlan.edit'), () => setStep(2))}
        {onSave && <View style={{ marginTop: 20 }}>
          {label(t('cardioSaved.name'))}<TextInput accessibilityLabel={t('cardioSaved.name')} value={name} onChangeText={setName} maxLength={80} editable={!saving}
            style={{ ...surfaces.field, borderRadius: radius.md, padding: 14, minHeight: 48, ...text }} />
          {input.healthBaseline && <Pressable accessibilityRole="checkbox" accessibilityLabel={t('healthPlanning.saveConsent')}
            accessibilityState={{ checked: healthSaveAccepted, disabled: saving }} disabled={saving} onPress={() => setHealthSaveAccepted(v => !v)}
            style={{ ...surfaces.field, minHeight: 48, padding: 16, marginTop: 12, borderRadius: radius.md, borderWidth: 1, borderColor: healthSaveAccepted ? colors.accentText : colors.surfaceBorder }}>
            <Text style={[text, { fontWeight: healthSaveAccepted ? '700' : '400' }]}>{healthSaveAccepted ? '✓ ' : ''}{t('healthPlanning.saveConsent')}</Text>
            <Text style={[caption, { marginTop: 8 }]}>{t('healthPlanning.saveDisclosure')}</Text>
          </Pressable>}
          {action(t(saving ? 'cardioSaved.saving' : 'cardioSaved.save'), save, true, !name.trim() || !preview.scheduled.length || !ready || error || !!input.healthBaseline && !healthSaveAccepted)}
          {saveError && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t('cardioSaved.saveFailed')}</Text>}
        </View>}
        <Text style={[caption, { marginTop: 16 }]}>{t('cardioPlan.draftOnly')}</Text>
      </>}
      {step < 3 && <>
        {issue && (step === 2 || step === 1 && issue === 'PROFILE') && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 8 }}>{t(`cardioPlan.issue_${issue}`)}</Text>}
        {action(t(step === 2 ? 'cardioPlan.review' : 'exerciseWizard.next'), () => step === 2 ? review() : setStep(step + 1), true,
          step === 0 ? !input.modalities.length : step === 1 ? issue === 'PROFILE' : !!issue || !ready || error)}
      </>}
    </ScrollView>
    <Modal visible={details !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetails(null)}>
      <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: insets.bottom + 30 }}>
        {action(t('workout.done'), () => setDetails(null))}
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginVertical: 22 }}>{t('cardioPlan.info')}</Text>
        <Text style={[text, { lineHeight: 25 }]}>{t('cardioPlan.infoBody')}</Text>
      </ScrollView>
    </Modal>
  </View>;
}
