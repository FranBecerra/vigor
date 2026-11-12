import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Exercise } from '@/models';
import { useAthleteIntakeDefaults } from '@/hooks/AthleteIntakeContext';
import { strengthIntakeDefaults } from '@/services/settings/athleteIntake';
import { useExerciseName } from '@/hooks/useExerciseName';
import { suggestHybridStructure } from '@/services/cardio/hybridStructure';
import { hybridLegAlternative } from '@/services/cardio/hybridLegAlternative';
import { useTheme } from '@/theme/useTheme';
import { useProtectTrainingDraft } from '@/hooks/useTrainingDraftGuard';
import { NumericField } from '@/components/train/NumericField';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { CardioPlanBuilder } from './CardioPlanBuilder';
import { DumbbellIcon } from '@/components/icons';
import { CheckIcon, ConvergenceIcon } from '@/components/icons/ActionIcons';
import { CardioRouteIcon, CycleCalendarIcon, CycleChevron } from '@/components/icons/CycleReviewIcons';
import { HybridProgress, type HybridStage } from './HybridProgress';
import { CardioCycleView } from './CardioCycleView';
import { strengthPlacements, type CardioPreviewInput } from '@/services/cardio/cardioPreview';
import { ManualCardioEditor } from './ManualCardioEditor';
import { prepareHybridBundle, reviewHybridAuthoring, type HybridBundle, type HybridPriority, type HybridStrengthDraft } from '@/services/cardio/hybridAuthoring';
import { availabilityHybridSettings, strengthHybridTarget, suggestHybridFrequency, validHybridAvailability, type HybridAvailability } from '@/services/cardio/hybridAvailability';
import { toRoutineView } from '@/services/training/routineView';
import { cardioInputForSave } from '@/services/cardio/savedCardioPlan';
import { freshReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';

type Props = { exercises: ReadonlyMap<string, Exercise>; onCancel: () => void; onSave: (bundle: HybridBundle) => Promise<void>;
  renderStrength?: (props: { onPrepared: (draft: HybridStrengthDraft) => void; onExit: () => void; sharedAvailability: HybridAvailability; recommendedSessions?: number; hybridPriority?: HybridPriority; progress?: ReactNode; revision?: HybridStrengthDraft }) => ReactNode;
  /** Only disposable native acceptance supplies a fabricated starting prescription. */
  manual?: boolean;
  initialStrength?: HybridStrengthDraft };

/** One bounded, owner-mounted draft. No independent strength or cardio save occurs. */
export function HybridPlanBuilder({ exercises, onCancel, onSave, initialStrength, renderStrength, manual = false }: Props) {
  const { t } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme(), insets = useSafeAreaInsets();
  const intake = strengthIntakeDefaults(useAthleteIntakeDefaults());
  const [stage, setStage] = useState<HybridStage>('SETUP');
  const [setupPage, setSetupPage] = useState<'PRIORITY' | 'AVAILABILITY'>(initialStrength ? 'AVAILABILITY' : 'PRIORITY');
  const [unrestricted, setUnrestricted] = useState(false);
  const [strength, setStrength] = useState(initialStrength ?? null), [cardio, setCardio] = useState<CardioPreviewInput | null>(null);
  const [revision, setRevision] = useState<{ draft: HybridStrengthDraft } | null>(null);
  const [strengthLocked, setStrengthLocked] = useState(false);
  const [startedStrength, setStartedStrength] = useState(false), [startedCardio, setStartedCardio] = useState(false);
  const [priority, setPriority] = useState<HybridPriority>('BALANCED');
  const [customAvailability, setAvailability] = useState<HybridAvailability>({ cycleDays: initialStrength?.mesocycle.scheduleTemplate?.days ?? 7,
    trainingDays: 4, minutesPerSession: 60, allowDoubles: false });
  const availability = useMemo(() => unrestricted ? { ...customAvailability, trainingDays: Math.min(6, customAvailability.cycleDays),
    minutesPerSession: 60, allowDoubles: false } : customAvailability, [unrestricted, customAvailability]);
  const availabilityValid = validHybridAvailability(availability);
  const allocation = availabilityValid ? suggestHybridFrequency(availability, priority, unrestricted || intake.level ? strengthHybridTarget(intake.level) : undefined) : null;
  const settings = useMemo(() => availabilityValid ? availabilityHybridSettings(availability, priority) : null, [availability, availabilityValid, priority]);
  const localizedExercise = useExerciseName();
  const [chosenAlternative, chooseAlternative] = useState<{ strength: HybridStrengthDraft; cardio: CardioPreviewInput; settings: typeof settings } | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const live = useRef(true), saving = useRef(false), frozen = useRef<HybridBundle | null>(null);
  useProtectTrainingDraft(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { frozen.current = null; setFailed(false); }, [strength, cardio, settings, exercises]);
  const exit = () => { if (!saving.current) Alert.alert(t('generate.cancelCreation'), t('generate.cancelCreationHint'), [
    { text: t('generate.keepCreating'), style: 'cancel' }, { text: t('generate.cancelCreation'), style: 'destructive', onPress: () => { if (live.current && !saving.current) onCancel(); } },
  ]); };
  useEffect(() => {
    const event = BackHandler.addEventListener('hardwareBackPress', () => {
      if (revision) {
        setRevision(null);
        setStage(cardio ? 'REVIEW' : 'CARDIO');
      } else if (stage === 'SETUP' && setupPage === 'AVAILABILITY' && !initialStrength) setSetupPage('PRIORITY');
      else exit();
      return true;
    });
    return () => event.remove();
  });
  const labels = useMemo(() => ({ focus: (focus: string) => t(`generate.focus${focus}`), goal: (goal: string) => t(`goal.${goal}`) }), [t]);
  const view = useMemo(() => strength ? toRoutineView(strength.routine, strength.mesocycle, exercises, labels) : null, [strength, exercises, labels]);
  const baseReview = useMemo(() => {
    if (stage !== 'REVIEW' || !strength || !cardio || !settings) return null;
    try { return reviewHybridAuthoring(strength, cardio, settings, exercises, labels); }
    catch { return null; }
  }, [stage, strength, cardio, settings, exercises, labels]);
  const structure = useMemo(() => !strengthLocked && baseReview && strength && cardio && settings
    ? suggestHybridStructure(strength, cardio, settings, exercises, labels, baseReview) : null,
    [baseReview, strength, cardio, settings, exercises, labels, strengthLocked]);
  const transfer = useMemo(() => !strengthLocked && !structure && baseReview && strength && cardio && settings
    ? hybridLegAlternative(strength, cardio, settings, exercises, labels, baseReview) : null,
    [structure, baseReview, strength, cardio, settings, exercises, labels, strengthLocked]);
  const alternative = structure ?? transfer;
  const toggled = chosenAlternative?.strength === strength && chosenAlternative?.cardio === cardio && chosenAlternative?.settings === settings;
  const applied = (structure ? !toggled : toggled) ? alternative : null;
  const review = applied?.review ?? baseReview;
  const selectedStrength = applied?.strength ?? strength, selectedCardio = applied?.cardio ?? cardio;
  useEffect(() => { frozen.current = null; }, [!!applied]);
  const currentDraft = useRef({ strength, cardio, settings, stage, revision, chosenAlternative, exercises });
  currentDraft.current = { strength, cardio, settings, stage, revision, chosenAlternative, exercises };
  const action = (key: string, onPress: () => void, disabled = false, primary = false) => <Pressable accessibilityRole="button" accessibilityLabel={t(key)} disabled={disabled || busy}
    onPress={onPress} style={{ ...(primary ? surfaces.primary : surfaces.field), padding: 16, minHeight: 48, borderRadius: radius.md, marginTop: 12, opacity: disabled || busy ? .45 : 1 }}>
    <Text style={{ color: primary ? colors.onAccent : colors.accentText, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{t(key)}</Text></Pressable>;
  const save = async () => {
    if (!selectedStrength || !selectedCardio || !settings || !review || review.issues.length || saving.current || !live.current
      || currentDraft.current.stage !== 'REVIEW' || currentDraft.current.strength !== strength
      || currentDraft.current.chosenAlternative !== chosenAlternative || currentDraft.current.exercises !== exercises
      || currentDraft.current.cardio !== cardio || currentDraft.current.settings !== settings
      || selectedCardio.healthBaseline && !freshReviewedCardioStart(selectedCardio.healthBaseline, Date.now())) return;
    saving.current = true; setBusy(true); setFailed(false);
    try { frozen.current ??= prepareHybridBundle(selectedStrength, cardioInputForSave(selectedCardio, Date.now()), settings, exercises, labels, Date.now()); await onSave(frozen.current); }
    catch { if (live.current) setFailed(true); }
    finally { saving.current = false; if (live.current) setBusy(false); }
  };
  const openStrengthRevision = (draft: HybridStrengthDraft) => {
    setRevision({ draft });
    setStage('STRENGTH');
  };
  const canFinishRevision = () => live.current && !saving.current
    && currentDraft.current.stage === 'STRENGTH'
    && currentDraft.current.revision === revision
    && currentDraft.current.strength === strength && currentDraft.current.settings === settings;
  const returnFromRevision = () => {
    setRevision(null);
    setStage(cardio ? 'REVIEW' : 'CARDIO');
  };
  const strengthProgress = <HybridProgress stage="STRENGTH" />;
  return <View style={{ flex: 1, ...surfaces.screen }}>
    {startedStrength && !initialStrength && <View style={{ flex: 1, display: stage === 'STRENGTH' && !revision ? 'flex' : 'none' }} accessibilityElementsHidden={stage !== 'STRENGTH' || !!revision} importantForAccessibility={stage === 'STRENGTH' && !revision ? 'auto' : 'no-hide-descendants'}>
      {renderStrength?.({ progress: strengthProgress, sharedAvailability: availability, recommendedSessions: allocation?.strength, hybridPriority: priority, onExit: () => {
        if (live.current && !saving.current && currentDraft.current.stage === 'STRENGTH' && !currentDraft.current.revision
          && currentDraft.current.strength === strength && currentDraft.current.settings === settings) setStage('SETUP');
      }, onPrepared: draft => {
        if (!live.current || saving.current || currentDraft.current.stage !== 'STRENGTH' || currentDraft.current.revision
          || currentDraft.current.strength !== strength || currentDraft.current.settings !== settings) return;
        // Invalidate the accepted calendar, not the mounted cardio editor's authored inputs.
        if (draft !== strength) { setStrength(draft); setCardio(null); setStrengthLocked(false); }
        setStartedCardio(true); setStage('CARDIO');
      } })}
    </View>}
    {revision && stage === 'STRENGTH' && <View style={{ flex: 1 }}>
      {renderStrength?.({
        revision: revision.draft, progress: strengthProgress, sharedAvailability: availability, hybridPriority: priority,
        onExit: () => { if (canFinishRevision()) returnFromRevision(); },
        onPrepared: draft => {
          if (!canFinishRevision()) return;
          if (draft === revision.draft) { returnFromRevision(); return; }
          setRevision(null);
          setStrength(draft);
          setStrengthLocked(true);
          setCardio(null);
          setStage('CARDIO');
        },
      })}
    </View>}
    {startedCardio && view && <View style={{ flex: 1, display: stage === 'CARDIO' ? 'flex' : 'none' }} accessibilityElementsHidden={stage !== 'CARDIO'} importantForAccessibility={stage === 'CARDIO' ? 'auto' : 'no-hide-descendants'}>
      {manual ? <ManualCardioEditor name={view.name} progress={<HybridProgress stage="CARDIO" />}
        availability={availability} strength={strengthPlacements(view, true).sessions}
        onBack={() => { if (strength) openStrengthRevision(strength); }} onCancel={exit}
        onReview={input => {
          if (!live.current || saving.current || currentDraft.current.stage !== 'CARDIO'
            || currentDraft.current.strength !== strength || currentDraft.current.settings !== settings) return;
          setCardio(input); setStage('REVIEW');
        }} /> : <CardioPlanBuilder active={stage === 'CARDIO'} progress={<HybridProgress stage="CARDIO" />} routine={view} sharedAvailability={availability}
        recommendedSessions={allocation?.cardio} hybrid={{ name: view.name, priority, onReview: input => {
        if (!live.current || saving.current || currentDraft.current.stage !== 'CARDIO'
          || currentDraft.current.strength !== strength || currentDraft.current.settings !== settings) return;
        setCardio(input); setStage('REVIEW');
      } }} ready error={false} onRetry={() => undefined} onCancel={exit}
        onBack={() => {
          if (strengthLocked && strength && renderStrength) openStrengthRevision(strength);
          else setStage(initialStrength ? 'SETUP' : 'STRENGTH');
        }} />}
    </View>}
    {(stage === 'SETUP' || stage === 'REVIEW') && <ScrollView key={stage === 'SETUP' ? setupPage : stage} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        {stage === 'REVIEW' && <Pressable accessibilityRole="button" accessibilityLabel={t('generate.back')} disabled={busy} onPress={() => setStage('CARDIO')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.accentText, fontSize: 16 }}>‹ {t('combinedReview.plan')}</Text>
        </Pressable>}
        {stage === 'SETUP' && setupPage === 'AVAILABILITY' && <Pressable accessibilityRole="button" accessibilityLabel={t('generate.back')}
          onPress={() => setSetupPage('PRIORITY')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.accentText, fontSize: 16 }}>‹ {t('generate.back')}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={t('generate.cancel')} disabled={busy} onPress={exit} style={{ minHeight: 44, justifyContent: 'center', marginLeft: 'auto' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('generate.cancel')}</Text>
        </Pressable>
      </View>
      <HybridProgress stage={stage} />
      {stage === 'REVIEW' && <Text style={{ color: colors.textSecondary, fontSize: 12, letterSpacing: 1.4, marginBottom: 7 }}>{t('combinedReview.eyebrow')}</Text>}
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 29, fontWeight: stage === 'REVIEW' ? '500' : '700', letterSpacing: -1, marginBottom: 12 }}>{t(stage === 'SETUP' ? setupPage === 'PRIORITY' ? 'hybridPlan.priority' : 'sharedAvailability.title' : 'combinedReview.hybridTitle')}</Text>
      {stage === 'REVIEW' && <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 22 }}>{t('combinedReview.subtitle')}</Text>}
      {stage === 'SETUP' ? setupPage === 'PRIORITY' ? <>
        <View style={{ ...surfaces.card, borderRadius: radius.lg, padding: 18, gap: 10 }}>
          {(['STRENGTH', 'BALANCED', 'CARDIO'] as const).map(choice => {
            const Icon = { STRENGTH: DumbbellIcon, BALANCED: ConvergenceIcon, CARDIO: CardioRouteIcon }[choice];
            return <Pressable key={choice} accessibilityRole="radio" accessibilityLabel={t(`hybridPlan.${choice}`)}
            accessibilityState={{ selected: priority === choice }} onPress={() => { if (choice !== priority) { setPriority(choice); setCardio(null); } }}
            style={{ minHeight: 52, paddingVertical: 10, gap: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder }}>
            <Icon size={20} color={colors.accentText} />
            <View style={{ flex: 1 }}>
            <Text style={{ color: priority === choice ? colors.accentText : colors.textPrimary, fontSize: 17, fontWeight: priority === choice ? '700' : '400' }}>{t(`hybridPlan.${choice}`)}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{t(`hybridPlan.priorityDetail_${choice}`)}</Text>
            </View>
            <View accessible={false} style={{ width: 20 }}>{priority === choice && <CheckIcon size={20} color={colors.accentText} />}</View>
          </Pressable>; })}
        </View>
        {action('sharedAvailability.continue', () => setSetupPage('AVAILABILITY'), false, true)}
      </> : <>
        <View style={{ ...surfaces.card, borderRadius: radius.lg, padding: 18, gap: 10 }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: unrestricted }} accessibilityLabel={t('sharedAvailability.unrestricted')}
            onPress={() => { setUnrestricted(value => !value); setCardio(null); }}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View accessible={false} style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.accentText, alignItems: 'center', justifyContent: 'center' }}>
              {unrestricted && <CheckIcon size={18} color={colors.accentText} />}
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 16, flex: 1 }}>{t('sharedAvailability.unrestricted')}</Text>
          </Pressable>
          {unrestricted ? <Text style={{ color: colors.textSecondary }}>{t('sharedAvailability.unrestrictedSummary', { days: availability.trainingDays, minutes: availability.minutesPerSession })}</Text> : <>
          <Stepper labelAbove label={t('sharedAvailability.days')} value={availability.trainingDays} min={2} max={availability.cycleDays} onChange={trainingDays => {
            setAvailability(old => ({ ...old, trainingDays })); setCardio(null);
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, flex: 1 }}>{t('sharedAvailability.minutes')}</Text>
            <View style={{ width: 85 }}><NumericField compact value={availability.minutesPerSession} accessibilityLabel={t('sharedAvailability.minutes')}
              onChangeValue={value => { setAvailability(old => ({ ...old, minutesPerSession: value ?? 0 })); setCardio(null); }} /></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, flex: 1 }}>{t('sharedAvailability.doubles')}</Text>
            <Switch accessibilityLabel={t('sharedAvailability.doubles')} value={availability.allowDoubles} onValueChange={allowDoubles => {
              setAvailability(old => ({ ...old, allowDoubles })); setCardio(null);
            }} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('sharedAvailability.separateSlots')}</Text>
          </>}
          {!availabilityValid && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('sharedAvailability.invalid')}</Text>}
        </View>
        {allocation && <Text style={{ color: colors.textSecondary, lineHeight: 21, marginTop: 12 }}>{t('hybridPlan.priorityScope', allocation)}</Text>}
        {action(strength ? 'hybridPlan.resume' : 'hybridPlan.buildStrength', () => {
          if (!availabilityValid) return;
          if (cardio) setStage('REVIEW'); else if (startedStrength && !initialStrength && !strengthLocked) setStage('STRENGTH'); else if (strength) { setStartedCardio(true); setStage('CARDIO'); } else { setStartedStrength(true); setStage('STRENGTH'); }
        }, !availabilityValid, true)}
      </> : <>
        {review && selectedCardio && cardio ? <>
          {alternative && <Pressable accessibilityRole="checkbox" testID="hybrid-leg-alternative" accessibilityState={{ checked: !!applied }} disabled={busy}
            onPress={() => chooseAlternative(toggled ? null : { strength: strength!, cardio, settings })} style={{ ...surfaces.field, padding: 14, marginBottom: 14, borderRadius: radius.md }}>
            <Text style={{ color: applied ? colors.accentText : colors.textPrimary }}>{applied ? '☑ ' : '☐ '}{structure
              ? t('hybridPlan.structureChoice') : t('hybridPlan.legTransfer', {
                exercise: localizedExercise(transfer!.exercise), from: transfer!.fromDay, to: transfer!.toDay })}</Text>
            {structure?.split && <Text style={{ color: colors.textSecondary }}>{t(`generate.split${structure.split}`)}</Text>}
            {structure?.moves.map(move => <Text key={move.exercise.id + '-' + move.fromDay + '-' + move.toDay} style={{ color: colors.textSecondary, marginTop: 5 }}>
              {t('hybridPlan.structureMove', { exercise: localizedExercise(move.exercise), from: move.fromDay, to: move.toDay })}
            </Text>)}
          </Pressable>}
          <CardioCycleView input={selectedCardio} preview={review.preview} strengthRoutine={review.view} sessionCeiling={availability.minutesPerSession} />
          {review.issues.map(issue => <Text key={issue} accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t(`hybridPlan.issue_${issue}`)}</Text>)}
          {cardio.allowDoubles && <Text style={{ color: colors.textSecondary, marginTop: 12, lineHeight: 21, fontSize: 13 }}>{t(`hybridPlan.${review.sameDayOrder}`)}</Text>}
          <Text style={{ color: colors.textSecondary, marginTop: 18, fontSize: 13, lineHeight: 20 }}>{selectedStrength!.routine.name} · {t('combinedReview.saveScope')}</Text>
          {cardio.healthBaseline && !freshReviewedCardioStart(cardio.healthBaseline, Date.now()) &&
            <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t('healthPlanning.expired')}</Text>}
        </> : <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('hybridPlan.invalidReview')}</Text>}
        {failed && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t('hybridPlan.saveFailed')}</Text>}
        <View style={{ marginTop: 20, borderTopWidth: 1, borderColor: colors.surfaceBorder }}>
          {([
            { key: 'editStrength', Icon: DumbbellIcon, visible: !!renderStrength && !!selectedStrength,
              onPress: () => { if (selectedStrength) openStrengthRevision(selectedStrength); } },
            { key: 'editCardio', Icon: CardioRouteIcon, visible: true, onPress: () => setStage('CARDIO') },
            { key: 'editAvailability', Icon: CycleCalendarIcon, visible: true, onPress: () => setStage('SETUP') },
          ]).filter(row => row.visible).map(({ key, Icon, onPress }) => <Pressable key={key}
            accessibilityRole="button" accessibilityLabel={t(`hybridPlan.${key}`)} disabled={busy}
            onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
              borderBottomWidth: 1, borderColor: colors.surfaceBorder, paddingVertical: 10 }}>
            <Icon size={18} color={colors.accentText} />
            <Text style={{ flex: 1, color: colors.accentText, fontSize: 16 }}>{t(`hybridPlan.${key}`)}</Text>
            <CycleChevron size={18} color={colors.accentText} />
          </Pressable>)}
        </View>
        {review && cardio && action('hybridPlan.save', () => void save(), !!review.issues.length
          || !!cardio.healthBaseline && !freshReviewedCardioStart(cardio.healthBaseline, Date.now()), true)}
      </>}
    </ScrollView>}
  </View>;
}
