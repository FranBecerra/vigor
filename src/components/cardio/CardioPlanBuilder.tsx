import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { NumericField } from '@/components/train/NumericField';
import { CardioSelectRow } from './CardioSelectRow';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { CheckIcon, InfoIcon, WandIcon } from '@/components/icons/ActionIcons';
import type { CardioExperienceStatus } from '@/models/cardio';
import { useAthleteIntakeDefaults, useAthleteIntakeReady } from '@/hooks/AthleteIntakeContext';
import { cardioIntakeDefaults } from '@/services/settings/athleteIntake';
import { AthleteDefaultsLoading } from '@/components/profile/AthleteDefaultsLoading';
import { CardioCycleView } from './CardioCycleView';
import type { RoutineView } from '@/services/training/routineView';
import { CARDIO_MODALITIES, buildCardioPreview, cardioPreviewIssue, hybridLegSets, strengthPlacements, suggestCardioCapacity, type CardioPreviewInput, type CardioPreview, type CardioStrengthPlacement } from '@/services/cardio/cardioPreview';
import { freshReviewedCardioStart, reviewedCardioDefaults, type ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';
import { HybridRhythmCancelled, suggestHybridRhythm } from '@/services/cardio/hybridRhythm';
import type { HybridPriority } from '@/services/cardio/hybridAuthoring';
import { validHybridAvailability, withHybridAvailability, type HybridAvailability } from '@/services/cardio/hybridAvailability';
import { CardioPlanningHistoryPrompt } from './CardioPlanningHistoryPrompt';
import { historyReviewInput } from '@/services/cardio/planningHistory';

const statuses: CardioExperienceStatus[] = ['NEW', 'RETURNING', 'REGULAR', 'UNSURE'];

type BuilderProps = {
  progress?: ReactNode;
  active?: boolean;
  sharedAvailability?: HybridAvailability;
  recommendedSessions?: number;
  /** Hybrid authoring keeps the accepted strength prescription mandatory. */
  hybrid?: { name: string; priority?: HybridPriority; onReview?: (input: CardioPreviewInput) => void };
  onBack?: () => void;
  initialBaseline?: ReviewedCardioStart;
  routine?: RoutineView; ready: boolean; error: boolean; onRetry: () => void; onCancel: () => void;
  onSave?: (name: string, input: CardioPreviewInput) => Promise<void>;
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
function OwnedCardioPlanBuilder({ routine, ready, error, onRetry, onCancel, onSave, initialBaseline, hybrid, onBack, sharedAvailability, recommendedSessions, progress, active = true }: BuilderProps) {
  const { t } = useTranslation(); const { colors, surfaces, radius, semantic, typography } = useTheme(); const insets = useSafeAreaInsets();
  const source = routine ? strengthPlacements(routine, true) : { sessions: [] as CardioStrengthPlacement[] };
  const isHybrid = !!hybrid;
  const legSets = useMemo(() => isHybrid && routine ? hybridLegSets(routine) : undefined, [isHybrid, routine]);
  const initialCycle = sharedAvailability?.cycleDays ?? initialBaseline?.cycleDays ?? Math.max(7, source.cycleDays ?? 7);
  const [step, setStep] = useState<0 | 3>(0), [preview, setPreview] = useState<CardioPreview | null>(null);
  const intake = useAthleteIntakeDefaults();
  const [input, setInput] = useState<CardioPreviewInput>(() => {
    const initial: CardioPreviewInput = { familiarizationPolicy: 'BEGINNER_RUN_WALK_V1', placementPolicy: 'BALANCED_V2', spacingPolicy: 'SPREAD_EASY_V1', ...cardioIntakeDefaults(intake),
    cycleDays: initialCycle, availableDays: Array.from({ length: initialCycle }, (_, i) => i), sessions: 2, cardioMinutes: 40, sessionMinutes: 20,
    maxActiveDays: Math.min(initialCycle, source.sessions.length + (initialBaseline?.sessions ?? 2)), allowDoubles: false,
    strength: source.sessions.map(s => initialBaseline && s.dayIndex !== undefined && s.dayIndex >= initialCycle ? { ...s, dayIndex: undefined } : s),
    ...(initialBaseline ? { ...reviewedCardioDefaults(initialBaseline, cardioIntakeDefaults(intake).profile),
      sessionMinutes: initialBaseline.sessionMinutes, cardioMinutes: initialBaseline.totalMinutes } : {}) };
    return sharedAvailability && validHybridAvailability(sharedAvailability) ? withHybridAvailability(initial, sharedAvailability) : initial;
  });
  const [useStrength, setUseStrength] = useState(true), [strengthChanged, setStrengthChanged] = useState(false);
  const [details, setDetails] = useState<'INFO' | null>(null);
  const [editStrengthDays, setEditStrengthDays] = useState(() => source.sessions.some(s => s.dayIndex === undefined));
  const [name, setName] = useState(hybrid?.name ?? ''), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(false);
  const [vigorDose, setVigorDose] = useState<ReturnType<typeof suggestCardioCapacity> | null>(null);
  const savingRef = useRef(false);
  const availabilityEdited = useRef(false);
  const explicitDose = useRef(false);
  const placementEdited = useRef(false), rhythmTask = useRef<{ cancelled: boolean } | null>(null);
  const [optimizing, setOptimizing] = useState(false), [rhythmNotice, setRhythmNotice] = useState<'changed' | 'unchanged' | 'failed' | null>(null);
  const cancelRhythm = () => { if (rhythmTask.current) rhythmTask.current.cancelled = true; rhythmTask.current = null; setOptimizing(false); };
  useEffect(() => () => { if (rhythmTask.current) rhythmTask.current.cancelled = true; rhythmTask.current = null; }, []);
  const scroll = useRef<ScrollView>(null);
  const sharedSignature = JSON.stringify(sharedAvailability);
  useEffect(() => {
    if (!sharedAvailability || !validHybridAvailability(sharedAvailability)) return;
    cancelRhythm(); setPreview(null); setRhythmNotice(null); setStep(0);
    setInput(old => withHybridAvailability(old, sharedAvailability));
  }, [sharedSignature]);
  const signature = JSON.stringify([routine?.id, source, legSets && [...legSets]]); const previousSource = useRef(signature);
  useEffect(() => {
    if (previousSource.current === signature) return;
    cancelRhythm(); placementEdited.current = false; setRhythmNotice(null);
    previousSource.current = signature;
    if (useStrength) {
      setInput(old => ({ ...old, strength: source.sessions })); setStrengthChanged(true);
      setEditStrengthDays(source.sessions.some(s => s.dayIndex === undefined));
      setPreview(null); setDetails(null); setStep(0);
    }
  }, [signature, useStrength]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (savingRef.current) return true;
      cancelRhythm();
      if (!step) return false;
      setStep(0); return true;
    });
    return () => listener.remove();
  }, [step]);
  const patch = (value: Partial<CardioPreviewInput>, explicitAvailability = true) => {
    cancelRhythm(); setRhythmNotice(null);
    if (explicitAvailability && step !== 3) {
      if (['sessions', 'cardioMinutes', 'sessionMinutes'].some(key => key in value)) explicitDose.current = true;
      if (['sessions', 'cardioMinutes', 'sessionMinutes', 'maxActiveDays', 'allowDoubles', 'availableDays'].some(key => key in value)) availabilityEdited.current = true;
    }
    setInput(old => {
      const next = { ...old, ...value };
      if ('sessions' in value || 'sessionMinutes' in value) next.cardioMinutes = Math.min(1440, next.sessions * next.sessionMinutes);
      return sharedAvailability ? withHybridAvailability(next, sharedAvailability) : next;
    });
  };
  useEffect(() => { }, [input]);
  const issue = cardioPreviewIssue(input);
  // Before standalone availability is entered, use only the engine's storage bounds.
  // Shared authoring already has an explicit per-workout ceiling. Neither is a dose.
  const historyInput = useMemo(() => historyReviewInput(input, sharedAvailability, explicitDose.current), [input, sharedSignature]);
  const unavailableStrength = !!hybrid && input.strength.some(s => !input.availableDays.includes(s.dayIndex!));
  let capacitySuggestion: ReturnType<typeof suggestCardioCapacity> | null = null;
  try {
    if (sharedAvailability && !validHybridAvailability(sharedAvailability)) throw Error('invalidSharedAvailability');
    capacitySuggestion = input.healthBaseline ? suggestCardioCapacity(input) : vigorDose ?? suggestCardioCapacity(input);
    if (hybrid?.priority && sharedAvailability && !input.healthBaseline && !vigorDose) {
      const slots = sharedAvailability.trainingDays - (sharedAvailability.allowDoubles ? 0 : input.strength.length);
      // Keep all requested modalities visible even when the athlete must revise availability.
      const sessions = Math.max(input.modalities.length, Math.min(slots, recommendedSessions ?? slots, capacitySuggestion.sessions));
      capacitySuggestion = { ...capacitySuggestion, sessions };
    }
  } catch { /* Invalid intake must be corrected before suggesting limits. */ }
  // Only untouched defaults follow a changed declared profile. An explicit limit or
  // reviewed history survives profile edits and navigation until recommendation is invoked.
  const profileSignature = JSON.stringify([input.modalities, input.profile, sharedSignature, source, hybrid?.priority, recommendedSessions]);
  useEffect(() => {
    if (initialBaseline || input.healthBaseline || availabilityEdited.current || !capacitySuggestion
      || sharedAvailability && !validHybridAvailability(sharedAvailability)) return;
    setInput(old => sharedAvailability ? withHybridAvailability({ ...old, ...capacitySuggestion! }, sharedAvailability) : { ...old, ...capacitySuggestion! });
  }, [profileSignature]);
  const surface = { marginBottom: 24 };
  const sectionCard = { ...surfaces.card, borderRadius: 18, padding: 16, marginBottom: 16 };
  const text = { color: colors.textPrimary, fontSize: 16 };
  const caption = { color: colors.textSecondary, fontSize: 13, lineHeight: 19 };
  const label = (value: string) => <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 12 }]}>{value}</Text>;
  const action = (title: string, press: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={title}
    disabled={disabled || saving || optimizing} onPress={press} style={{ minHeight: 48, padding: 12, marginTop: 10, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center', ...(primary ? surfaces.primary : surfaces.field), opacity: disabled ? 0.4 : 1 }}>
    <Text style={{ fontSize: 16, fontWeight: '600', color: primary ? colors.onAccent : colors.accentText }}>{title}</Text>
  </Pressable>;
  const chip = (title: string, selected: boolean, onPress: () => void, disabled = false) => <Pressable key={title} accessibilityRole="checkbox" accessibilityLabel={title}
    disabled={disabled} accessibilityState={{ checked: selected, disabled }} onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 13, paddingVertical: 11,
      borderRadius: radius.md, backgroundColor: selected ? colors.accentTint : colors.surface, borderWidth: 1,
      borderColor: selected ? colors.accentText : colors.surfaceBorder, justifyContent: 'center' }}>
    <Text style={{ color: selected ? colors.accentText : colors.textPrimary, fontSize: 14 }}>{title}</Text>
  </Pressable>;
  const changeCycle = (cycleDays: number) => { cancelRhythm(); setRhythmNotice(null); availabilityEdited.current = true; setInput(old => ({ ...old, cycleDays,
    availableDays: Array.from({ length: cycleDays }, (_, day) => day < old.cycleDays ? old.availableDays.includes(day) ? day : -1 : day).filter(day => day >= 0),
    maxActiveDays: Math.min(old.maxActiveDays, cycleDays),
    strength: old.strength.map(s => s.dayIndex !== undefined && s.dayIndex >= cycleDays ? { ...s, dayIndex: undefined } : s) })); };
  const review = async (forceRedistribute = false) => {
    if (issue || unavailableStrength || !ready || error || rhythmTask.current || savingRef.current) return;
    if (!hybrid || placementEdited.current && !forceRedistribute) {
      setPreview(buildCardioPreview(input));
      if (hybrid?.onReview) { availabilityEdited.current = true; hybrid.onReview(input); } else setStep(3);
      return;
    }
    const task = { cancelled: false }; rhythmTask.current = task; setOptimizing(true); setRhythmNotice(null);
    try {
      const result = await suggestHybridRhythm(input, { legSets, priority: hybrid.priority, isCancelled: () => task.cancelled });
      if (task.cancelled || rhythmTask.current !== task) return;
      setInput(result.input); setPreview(result.preview); setRhythmNotice(result.changed ? 'changed' : 'unchanged');
      if (hybrid.onReview) { availabilityEdited.current = true; hybrid.onReview(result.input); } else setStep(3);
    } catch (failure) {
      if (!task.cancelled && !(failure instanceof HybridRhythmCancelled)) setRhythmNotice('failed');
    } finally { if (rhythmTask.current === task) { rhythmTask.current = null; setOptimizing(false); } }
  };
  const save = async () => {
    if (!onSave || savingRef.current || rhythmTask.current || !name.trim() || !preview?.scheduled.length || !ready || error
      || input.healthBaseline && !freshReviewedCardioStart(input.healthBaseline, Date.now())) return;
    savingRef.current = true; setSaving(true); setSaveError(false);
    try { await onSave(name.trim(), input); } catch { setSaveError(true); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <View style={{ flex: 1, ...surfaces.screen, paddingTop: insets.top }}>
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('generate.back')} disabled={saving} onPress={() => { cancelRhythm(); step === 3 ? setStep(0) : (onBack ?? onCancel)(); }}
          style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 16 }}>‹ {t('generate.back')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('generate.cancel')} disabled={saving} onPress={() => { cancelRhythm(); onCancel(); }}
          style={{ minHeight: 44, justifyContent: 'center' }}><Text style={caption}>{t('generate.cancel')}</Text></Pressable>
      </View>
      {progress}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.accentText, fontSize: 12, marginBottom: 8 }}>{t(step === 3 ? 'cardioPlan.previewLabel' : hybrid ? 'hybridPlan.title' : 'cardioPlan.create')}</Text>
          <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700', letterSpacing: -.7 }}>{t(step === 3 ? 'cardioPlan.step3' : 'cardioSections.title')}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cardioPlan.info')} onPress={() => setDetails('INFO')}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><InfoIcon color={colors.textSecondary} size={22} /></Pressable>
      </View>
      {input.healthBaseline && <View style={surface}>
        <Text style={[text, { fontWeight: '700' }]}>{t('healthPlanning.applied', { sessions: input.healthBaseline.sessions, minutes: input.healthBaseline.sessionMinutes, days: input.healthBaseline.cycleDays })}</Text>
        <Text style={[caption, { marginTop: 8 }]}>{t('healthPlanning.limits')}</Text>
        {step < 3 && action(t('healthPlanning.remove'), () => {
          const modality = input.healthBaseline!.modality;
          const current = input.profile.modalities[modality];
          explicitDose.current = false;
          patch({ healthBaseline: undefined, sessions: 2, sessionMinutes: 20, cardioMinutes: 40,
            maxActiveDays: Math.min(input.cycleDays, input.strength.length + 2),
            profile: { ...input.profile, modalities: { ...input.profile.modalities, [modality]: current
              ? { ...current, typicalSessionMinutes: undefined } : undefined } } }, false);
        })}
      </View>}
      {step !== 3 && <View testID="cardio-setup-sections" style={sectionCard}>
        {label(t('cardioSections.activity'))}

        <View style={{ marginBottom: 12 }}>{CARDIO_MODALITIES.map(modality => <Pressable key={modality} accessibilityRole="checkbox" accessibilityLabel={t(`cardioPlan.${modality}`)}
          accessibilityState={{ checked: input.modalities.includes(modality), disabled: !!input.healthBaseline }} disabled={!!input.healthBaseline}
          onPress={() => { setVigorDose(null); const modalities = CARDIO_MODALITIES.filter(m => m === modality ? !input.modalities.includes(m) : input.modalities.includes(m));
            patch({ modalities, sessions: Math.max(input.sessions, modalities.length) }, false); }}
          style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder }}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, flex: 1 }}>{t(`cardioPlan.${modality}`)}</Text>
          <View accessible={false} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            {input.modalities.includes(modality) && <CheckIcon size={18} color={colors.accentText} />}
          </View>
        </Pressable>)}</View>
      </View>}
      {step !== 3 && <View style={sectionCard}>{label(t('cardioSections.startingPoint'))}
      {input.modalities.map(modality => {
        const current = input.profile.modalities[modality] ?? { status: 'UNSURE' as const, qualityExposure: 'UNKNOWN' as const };
        const update = (value: Partial<typeof current>) => patch({ profile: { schemaVersion: 1, modalities: { ...input.profile.modalities, [modality]: { ...current, ...value } } } });
        return <View key={modality} style={surface}>{input.modalities.length > 1 && label(t(`cardioPlan.${modality}`))}
          <CardioSelectRow label={t('cardioSections.experience')} value={current.status} options={statuses.map(status => ({ value: status, label: t(`cardioPlan.${status}`) }))}
            onSelect={status => update({ status: status as CardioExperienceStatus })} />
        </View>;
      })}
      <CardioPlanningHistoryPrompt plain input={historyInput} applied={!!input.healthBaseline}
        allowAutomatic={active && !availabilityEdited.current && ready && !error} onApply={next => {
        availabilityEdited.current = true;
        if (!next.healthBaseline) setVigorDose({ sessions: next.sessions, sessionMinutes: next.sessionMinutes, cardioMinutes: next.cardioMinutes, maxActiveDays: next.maxActiveDays });
        cancelRhythm(); setPreview(null);
        setInput(sharedAvailability ? withHybridAvailability(next, sharedAvailability) : next);
      }} />
      {!input.healthBaseline && !vigorDose && input.modalities.map(modality => {
        const current = input.profile.modalities[modality] ?? { status: 'UNSURE' as const, qualityExposure: 'UNKNOWN' as const };
        const update = (value: Partial<typeof current>) => patch({ profile: { schemaVersion: 1, modalities: { ...input.profile.modalities, [modality]: { ...current, ...value } } } });
        return <View key={modality} style={surface}>
          {input.modalities.length > 1 && label(t(`cardioPlan.${modality}`))}
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
      })}</View>}
      {step !== 3 && <>
        <View style={sectionCard}>
          {label(t('cardioSections.allocation'))}
          <Pressable accessibilityRole="button" accessibilityLabel={t('cardioGuidance.suggest')}
            accessibilityState={{ disabled: !capacitySuggestion || saving || optimizing }} disabled={!capacitySuggestion || saving || optimizing}
            onPress={() => {
              if (capacitySuggestion) {
                availabilityEdited.current = true;
                const { maxActiveDays, ...dose } = capacitySuggestion;
                patch(input.healthBaseline || vigorDose ? dose : { ...dose, maxActiveDays }, false);
              }
            }}
            style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              marginBottom: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, opacity: !capacitySuggestion ? .4 : 1 }}>
            <Text style={{ color: colors.accentText, fontSize: 17, fontWeight: '600', flex: 1 }}>{t('cardioGuidance.suggest')}</Text>
            <View accessible={false}><WandIcon size={22} color={colors.accentText} /></View>
          </Pressable>


          {[
            ['cycle', input.cycleDays, input.healthBaseline?.cycleDays ?? 7, input.healthBaseline?.cycleDays ?? 31, changeCycle],
            ['sessions', input.sessions, input.modalities.length, input.healthBaseline?.sessions ?? 14, (sessions: number) => patch({ sessions })],
            ['sessionLimit', input.sessionMinutes, 5, 600, (sessionMinutes: number) => patch({ sessionMinutes })],
            ['activeLimit', input.maxActiveDays, 1, input.cycleDays, (maxActiveDays: number) => patch({ maxActiveDays })],
          ].filter(([key]) => !sharedAvailability || key === 'sessions').map(([key, value, min, max, onChange]) => <View key={String(key)} style={{ marginBottom: 10 }}><Stepper plain label={t(`cardioPlan.${key}`)} value={value as number} min={min as number} max={max as number}
            step={String(key) === 'sessionLimit' ? 5 : 1} onChange={onChange as (n: number) => void} /></View>)}
          {sharedAvailability && <Stepper plain label={t('cardioSections.duration')} value={input.sessionMinutes} min={5}
            max={Math.min(sharedAvailability.minutesPerSession, input.healthBaseline?.sessionMinutes ?? 600)} step={5}
            onChange={sessionMinutes => patch({ sessionMinutes })} />}
          {sharedAvailability && <Text style={caption}>{t('sharedAvailability.cardioDose', { sessions: input.sessions, minutes: input.sessionMinutes })}</Text>}
          {!sharedAvailability && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 }}>
            <Text style={[text, { flex: 1 }]}>{t('cardioPlan.doubles')}</Text><Switch accessibilityLabel={t('cardioPlan.doubles')} value={input.allowDoubles} onValueChange={allowDoubles => patch({ allowDoubles })} />
          </View>}
        </View>
        {!sharedAvailability && <View style={surface}>{label(t(hybrid ? 'hybridPlan.availableDays' : 'cardioPlan.availableDays'))}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: input.cycleDays }, (_, day) => chip(t('cardioPlan.day', { day: day + 1 }), input.availableDays.includes(day), () => patch({ availableDays: input.availableDays.includes(day) ? input.availableDays.filter(d => d !== day) : [...input.availableDays, day].sort((a, b) => a - b) })))}
        </View></View>}
        {!ready && !error && <Text style={caption}>{t('cardioPlan.loading')}</Text>}
        {error && <View><Text accessibilityRole="alert" style={caption}>{t('home.retry')}</Text>{action(t('home.retry'), onRetry)}</View>}
        {strengthChanged && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginBottom: 12 }}>{t('cardioPlan.strengthChanged')}</Text>}
        {routine && <View style={surface}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ flex: 1 }}>
          {label(t(hybrid ? 'hybridPlan.strengthContext' : 'cardioPlan.strengthContext'))}<Text style={caption}>{routine.name}</Text></View>
          <Switch accessibilityLabel={t(hybrid ? 'hybridPlan.strengthContext' : 'cardioPlan.strengthContext')} disabled={!!hybrid} value={useStrength} onValueChange={enabled => {
            if (hybrid) return;
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
                onChangeValue={value => { placementEdited.current = true; setEditStrengthDays(true); patch({ strength: input.strength.map((old, i) => i === index ? { ...old, dayIndex: value === undefined ? undefined : value - 1 } : old) }); }} /></View>
            </View>)}
            </>}
          </>}
        </View>}
      </>}
      {step === 3 && preview && <>
        <CardioCycleView input={input} preview={preview} strengthRoutine={useStrength ? routine : undefined} />
        {hybrid && action(t('hybridRhythm.improve'), () => { void review(true); })}
        {rhythmNotice && <Text accessibilityRole={rhythmNotice === 'failed' ? 'alert' : undefined} style={[caption, { marginTop: 12, color: rhythmNotice === 'failed' ? semantic.warning : colors.textSecondary }]}>{t(`hybridRhythm.${rhythmNotice}`)}</Text>}
        {action(t('cardioPlan.edit'), () => setStep(0))}
        {onSave && <View style={{ marginTop: 20 }}>
          {label(t('cardioSaved.name'))}<TextInput accessibilityLabel={t('cardioSaved.name')} value={name} onChangeText={setName} maxLength={80} editable={!saving}
            style={{ ...surfaces.field, borderRadius: radius.md, padding: 14, minHeight: 48, ...text }} />
          {action(t(saving ? 'cardioSaved.saving' : hybrid ? 'hybridPlan.review' : 'cardioSaved.save'), save, true, !name.trim() || !preview.scheduled.length || !ready || error || !!input.healthBaseline && !freshReviewedCardioStart(input.healthBaseline, Date.now()))}
          {saveError && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t('cardioSaved.saveFailed')}</Text>}
        </View>}
        <Text style={[caption, { marginTop: 16 }]}>{t('cardioPlan.draftOnly')}</Text>
      </>}
      {step !== 3 && <>
        {issue && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 8 }}>{t(`cardioPlan.issue_${issue}`)}</Text>}
        {unavailableStrength && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 8 }}>{t('hybridPlan.unavailableStrength')}</Text>}
      </>}
      {optimizing && <Text accessibilityRole="progressbar" style={[caption, { marginTop: 10 }]}>{t('hybridRhythm.working')}</Text>}
      {step !== 3 && rhythmNotice === 'failed' && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('hybridRhythm.failed')}</Text>}
    </ScrollView>
    {step !== 3 && <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 12, ...surfaces.screen,
      borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}>
      {action(t('cardioPlan.review'), () => review(), true, !!issue || unavailableStrength || !ready || error)}
    </View>}
    <Modal visible={details !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetails(null)}>
      <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: insets.bottom + 30 }}>
        {action(t('workout.done'), () => setDetails(null))}
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginVertical: 22 }}>{t('cardioPlan.info')}</Text>
        <Text style={[text, { lineHeight: 25 }]}>{t('cardioPlan.infoBody')}</Text>
        <Text style={[text, { lineHeight: 25, marginTop: 16 }]}>{t('cardioGuidance.startingPoint')}</Text>
      </ScrollView>
    </Modal>
  </View>;
}
