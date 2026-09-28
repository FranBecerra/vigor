/**
 * Mesocycle generation screen (PRD §8.8).
 *
 * The first screen that reaches the engine. Until now `planMesocycle` had no caller
 * outside tests.
 *
 * TWO PAGES, ONE PER PHASE
 *   Configure, then preview, as two horizontally-paged views with explicit forward
 *   and back actions. The seven INPUT groups still share a single scroll, because
 *   session count and minutes move the set budget together and splitting them across
 *   steps would hide that. The generated plan is not an eighth input group: it is the
 *   result of the other seven, and appending it to the same scroll meant the primary
 *   action produced no visible movement on the one tap that matters most.
 *
 *   Both pages stay mounted, so going back to change a setting keeps the athlete's
 *   place in the form and keeps their preview edits. Regenerating is reachable from
 *   either page.
 *
 * NOTHING IS WRITTEN UNTIL THE PREVIEW IS ACCEPTED
 *   The generated selection is the thing the athlete is actually agreeing to, and the
 *   editor is a first-class requirement rather than a later repair.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { Equipment, ExperienceLevel, SplitStructure, type Exercise, type PlannedSession } from '@/models';
import { useAuth } from '@/hooks/useAuth';
import {
  Chip,
  ChipRow,
  Section,
  Stepper,
} from '@/components/train/generate/GenerateControls';
import { PlanPreview } from '@/components/train/generate/PlanPreview';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import {
  EXERCISE_CATALOGUE,
  filterCatalogue,
} from '@/services/training/exerciseCatalogue';
import { planMesocycle, type MesocyclePlan } from '@/services/training/mesocyclePlanner';
import {
  recommendCapacity,
  type CapacityRecommendation,
} from '@/services/training/capacityRecommendation';
import {
  approximateSetCapacity,
  exerciseMinutes,
  SESSION_OVERHEAD_MINUTES,
} from '@/services/training/trainingCapacity';
import {
  TrainingGoal,
  VolumeRegion,
  MAX_PRIORITY_REGIONS,
  PRIORITY_SLOT_BUDGET,
  TOTAL_SETS_RANGE,
} from '@/services/training/volumePlan';
import {
  choiceOf,
  cycleChoice,
  EMPTY_EMPHASIS,
  GENERATOR_EMPHASIS_REGIONS,
  isLowCost,
  prioritizeBlockedReason,
  usedSlots,
  type EmphasisSelection,
} from '@/services/training/emphasisSelection';
import {
  MAX_ROUTINE_NAME_LENGTH,
  normalizeRoutineName,
  routineNameProblem,
  type RoutineNameProblem,
  shouldActivateNewRoutine,
  toMesocycleDraft,
  toPlannedSessions,
  toRoutineDraft,
} from '@/services/training/routineMapper';
import {
  isPlanStale,
  primaryActionFor,
  settingsSignature,
  type GenerationPhase,
  type GenerationSettings,
  type PrimaryAction,
} from '@/services/training/generationPhase';
import { rankSwapCandidates } from '@/services/training/swapEngine';
import {
  applyPreviewEdits,
  previewEditKey,
  representativeSet,
  type PreviewEdits,
} from '@/services/training/previewEditing';
import { mesocycleRepository, routineRepository, workoutSessionRepository } from '@/services/repositories';
import { e1RMByExerciseFromHistory } from '@/services/training/e1rmHistory';
import {
  DEFAULT_GENERATOR_EQUIPMENT,
  DEFAULT_GENERATOR_GOAL,
  DEFAULT_GENERATOR_LEVEL,
  DEFAULT_GENERATOR_MINUTES,
  DEFAULT_GENERATOR_SESSIONS,
  DEFAULT_GENERATOR_SPLIT,
} from '@/services/training/generatorDefaults';
import {
  FLOATING_TAB_BAR_HEIGHT,
  floatingTabBarBottom,
} from '@/components/navigation/tabBarMetrics';

/** Bounds of the two capacity controls. Wide enough to be honest, narrow enough to stay sane. */
const MIN_SESSIONS = 2;
const MAX_SESSIONS = 7;
const MIN_MINUTES = 30;
const MAX_MINUTES = 120;
const MINUTES_STEP = 5;

const GOALS = [TrainingGoal.HYPERTROPHY, TrainingGoal.STRENGTH] as const;
const LEVELS = [
  ExperienceLevel.BEGINNER,
  ExperienceLevel.INTERMEDIATE,
  ExperienceLevel.ADVANCED,
] as const;
const SPLITS = [
  SplitStructure.AUTO,
  SplitStructure.FULL_BODY,
  SplitStructure.UPPER_LOWER,
  SplitStructure.PUSH_PULL_LEGS,
  SplitStructure.PUSH_PULL_LEGS_UPPER,
] as const;
const EQUIPMENT = [
  Equipment.BARBELL,
  Equipment.DUMBBELL,
  Equipment.MACHINE,
  Equipment.CABLE,
  Equipment.SMITH_MACHINE,
  Equipment.BODYWEIGHT,
  Equipment.KETTLEBELL,
  Equipment.BANDS,
] as const;

const GOAL_LABEL: Record<TrainingGoal, string> = {
  [TrainingGoal.HYPERTROPHY]: 'generate.goalHypertrophy',
  [TrainingGoal.STRENGTH]: 'generate.goalStrength',
};

/** What the fixed primary button says. The action decides; the screen only reads it. */
const PRIMARY_LABEL: Record<PrimaryAction, string> = {
  generate: 'generate.generate',
  regenerate: 'generate.regenerate',
  view: 'generate.viewPlan',
  save: 'generate.save',
};

/** Page transition, matched to the stack's own push so the flow feels continuous. */
const PHASE_SLIDE_MS = 260;

/**
 * The reason a save failed, as something readable.
 *
 * A generic retry message is useless here: the two realistic failures are a rejected
 * write and no connection, and only one of them is worth retrying. React Native
 * Firebase puts the discriminator on `code`, e.g. `firestore/permission-denied`.
 */
function saveFailureCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reroll, rendered on BOTH pages: on the form it is the only way to redraw settings
 * that have not moved, and on the preview the reason to want another draw is usually
 * something just read in the list.
 */function RerollButton({
  onPress,
  disabled = false,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { colors, typography, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        styles.rerollButton,
        {
          borderColor: colors.surfaceBorder,
          backgroundColor: colors.surface,
          borderRadius: radius.pill,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Text style={[typography.body, { color: colors.textPrimary }]}>{t('generate.reroll')}</Text>
    </Pressable>
  );
}

export default function GenerateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, typography, spacing, radius, sectionAccent, semantic } = useTheme();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [goal, setGoal] = useState<TrainingGoal>(DEFAULT_GENERATOR_GOAL);
  const [level, setLevel] = useState<ExperienceLevel>(DEFAULT_GENERATOR_LEVEL);
  const [sessions, setSessions] = useState(DEFAULT_GENERATOR_SESSIONS);
  const [minutes, setMinutes] = useState(DEFAULT_GENERATOR_MINUTES);
  const [split, setSplit] = useState<SplitStructure>(DEFAULT_GENERATOR_SPLIT);
  const [equipment, setEquipment] = useState<Equipment[]>([...DEFAULT_GENERATOR_EQUIPMENT]);
  const [emphasis, setEmphasis] = useState<EmphasisSelection>(EMPTY_EMPHASIS);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [phase, setPhase] = useState<GenerationPhase>('configure');
  const [plan, setPlan] = useState<MesocyclePlan | null>(null);
  // Settings the plan on screen was built from, so going back to LOOK at a setting is
  // told apart from changing one.
  const [planSignature, setPlanSignature] = useState<string | null>(null);
  const [previewEdits, setPreviewEdits] = useState<PreviewEdits>({});
  const [swapTarget, setSwapTarget] = useState<{ sessionIndex: number; order: number } | null>(null);
  const [saving, setSaving] = useState(false);
  /** Shown only after a save attempt, so an untouched field is not an error yet. */
  const [nameProblem, setNameProblem] = useState<RoutineNameProblem | null>(null);
  const previewScrollRef = useRef<ScrollView>(null);
  /** The name field sits at the top of the plan; a problem with it must be seen. */
  const reportNameProblem = useCallback((problem: RoutineNameProblem) => {
    setNameProblem(problem);
    previewScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState<CapacityRecommendation | null>(null);
  const [e1rmByExerciseId, setE1rmByExerciseId] = useState<ReadonlyMap<string, number>>(new Map());

  // Load only completed, actual sets. A generated target is not evidence for a
  // load; the history map remains empty until the athlete has performed work.
  useEffect(() => {
    if (user === null) {
      setE1rmByExerciseId(new Map());
      return;
    }
    let cancelled = false;
    workoutSessionRepository.listByUser(user.uid)
      .then((history) => {
        if (!cancelled) setE1rmByExerciseId(e1RMByExerciseFromHistory(history));
      })
      .catch((error: unknown) => {
        // Generation remains usable offline: no history means RIR-only targets.
        console.warn('[generate] e1RM history unavailable', error);
        if (!cancelled) setE1rmByExerciseId(new Map());
      });
    return () => { cancelled = true; };
  }, [user]);

  const settings = useMemo<GenerationSettings>(
    () => ({
      goal,
      level,
      split,
      sessionsPerMicrocycle: sessions,
      minutesPerSession: minutes,
      availableEquipment: equipment,
      priorityRegions: emphasis.priority,
      deprioritizedRegions: emphasis.deprioritized,
    }),
    [goal, level, split, sessions, minutes, equipment, emphasis],
  );
  const stale = isPlanStale(planSignature, settings);
  const primary = primaryActionFor({ phase, hasPlan: plan !== null, stale });

  // The pages slide instead of swapping, so the tap that generates is visibly a step
  // forward rather than a silent content change further down a scroll.
  const slide = useSharedValue(0);
  useEffect(() => {
    slide.value = withTiming(phase === 'preview' ? 1 : 0, { duration: PHASE_SLIDE_MS });
  }, [phase, slide]);
  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -slide.value * width }],
  }));

  // Live capacity readout, recomputed as the two controls move, which is the point of
  // keeping them on one screen. BOTH figures are shown because each control moves a
  // different one: minutes change what fits in a session, session count changes the
  // microcycle total. Showing only the total would make the minutes control look inert.
  const setBudget = useMemo(
    () => ({
      perSession: approximateSetCapacity({
        sessionsPerMicrocycle: 1,
        minutesPerSession: minutes,
      }),
      total: approximateSetCapacity({
        sessionsPerMicrocycle: sessions,
        minutesPerSession: minutes,
      }),
    }),
    [sessions, minutes],
  );

  const exercisesById = useMemo(
    () => new Map(EXERCISE_CATALOGUE.map((exercise) => [exercise.id, exercise])),
    [],
  );
  const availableCatalogue = useMemo(
    () => filterCatalogue(EXERCISE_CATALOGUE, { availableEquipment: equipment }),
    [equipment],
  );

  const toggleEquipment = useCallback((item: Equipment) => {
    setEquipment((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item],
    );
  }, []);

  /**
   * Let the engine choose the capacity. The search runs the generator across fifteen
   * capacities, so the busy state is set and the work deferred by a frame: otherwise
   * the thread blocks before the spinner ever paints and the button looks dead.
   */
  const onRecommendCapacity = useCallback(() => {
    setRecommending(true);
    setTimeout(() => {
      const best = recommendCapacity({
        level,
        goal,
        catalogue: availableCatalogue,
        split,
        priorityRegions: emphasis.priority,
        deprioritizedRegions: emphasis.deprioritized,
      });
      setSessions(best.sessionsPerMicrocycle);
      setMinutes(best.minutesPerSession);
      setRecommendation(best);
      setRecommending(false);
    }, 0);
  }, [availableCatalogue, emphasis, goal, level, split]);

  const generate = useCallback(
    (withSeed: number) => {
      const catalogue = filterCatalogue(EXERCISE_CATALOGUE, {
        availableEquipment: equipment,
      });
      setPlan(
        planMesocycle({
          level,
          goal,
          catalogue,
          seed: withSeed,
          split,
          priorityRegions: emphasis.priority,
          deprioritizedRegions: emphasis.deprioritized,
          capacity: { sessionsPerMicrocycle: sessions, minutesPerSession: minutes },
        }),
      );
      setPlanSignature(settingsSignature(settings));
      setPreviewEdits({});
      setSwapTarget(null);
      setPhase('preview');
    },
    [equipment, level, goal, split, emphasis, sessions, minutes, settings],
  );

  const onReroll = useCallback(() => {
    const next = Math.floor(Math.random() * 1_000_000);
    setSeed(next);
    generate(next);
  }, [generate]);

  const plannedSessions = useMemo<PlannedSession[]>(() => {
    if (plan === null) return [];
    const base = toPlannedSessions(plan, false, { e1rmByExerciseId });
    return applyPreviewEdits(base, previewEdits).map((session) => ({
      ...session,
      estimatedWorkMinutes: session.exercises.reduce((total, exercise) => {
        const catalogueExercise = exercisesById.get(exercise.exerciseId);
        return catalogueExercise === undefined
          ? total
          : total + exerciseMinutes(catalogueExercise, exercise.sets.length, exercise.restSeconds);
      }, 0),
    }));
  }, [e1rmByExerciseId, exercisesById, plan, previewEdits]);
  const plannedSetCount = useMemo(
    () => plannedSessions.reduce(
      (total, session) => total + session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
      0,
    ),
    [plannedSessions],
  );
  const hasPreviewEdits = Object.keys(previewEdits).length > 0;
  const overTimeSessionIndexes = useMemo(() => {
    if (!hasPreviewEdits) return [];
    const workBudget = Math.max(0, minutes - SESSION_OVERHEAD_MINUTES);
    return plannedSessions
      .filter((session) => session.estimatedWorkMinutes > workBudget)
      .map((session) => session.index);
  }, [hasPreviewEdits, minutes, plannedSessions]);
  const volumeOutsideRange = useMemo(() => {
    if (!hasPreviewEdits || plan?.plan.capacityCapped === true) return false;
    const [minimum, maximum] = TOTAL_SETS_RANGE[goal][level];
    return plannedSetCount < minimum || plannedSetCount > maximum;
  }, [goal, hasPreviewEdits, level, plan?.plan.capacityCapped, plannedSetCount]);

  const swapCurrent = useMemo<Exercise | null>(() => {
    if (swapTarget === null) return null;
    const planned = plannedSessions
      .find((session) => session.index === swapTarget.sessionIndex)
      ?.exercises.find((exercise) => exercise.order === swapTarget.order);
    return planned === undefined ? null : (exercisesById.get(planned.exerciseId) ?? null);
  }, [exercisesById, plannedSessions, swapTarget]);

  const swapCandidates = useMemo(() => {
    if (swapCurrent === null) return [];
    const used = new Set(
      plannedSessions.flatMap((session) =>
        session.exercises.map((exercise) => exercise.exerciseId),
      ),
    );
    return rankSwapCandidates(swapCurrent, availableCatalogue).filter(
      (exercise) => !used.has(exercise.id),
    );
  }, [availableCatalogue, plannedSessions, swapCurrent]);

  const onSelectSwap = useCallback(
    (exercise: Exercise) => {
      if (swapTarget === null) return;
      const key = previewEditKey(swapTarget.sessionIndex, swapTarget.order);
      setPreviewEdits((current) => ({
        ...current,
        [key]: { ...current[key], exerciseId: exercise.id },
      }));
      setSwapTarget(null);
    },
    [swapTarget],
  );

  const onChangePreviewSets = useCallback(
    (sessionIndex: number, order: number, value: number | undefined) => {
      if (value === undefined) return;
      const sets = Math.max(1, Math.min(30, Math.trunc(value)));
      const key = previewEditKey(sessionIndex, order);
      setPreviewEdits((current) => ({ ...current, [key]: { ...current[key], sets } }));
    },
    [],
  );

  const onChangePreviewRepMin = useCallback(
    (sessionIndex: number, order: number, value: number | undefined) => {
      if (value === undefined) return;
      const planned = plannedSessions
        .find((session) => session.index === sessionIndex)
        ?.exercises.find((exercise) => exercise.order === order);
      const firstSet = representativeSet(planned?.sets ?? []);
      if (firstSet === undefined) return;
      const targetRepsMin = Math.max(1, Math.min(100, Math.trunc(value)));
      const targetReps = Math.max(targetRepsMin, firstSet.targetReps);
      const key = previewEditKey(sessionIndex, order);
      setPreviewEdits((current) => ({
        ...current,
        [key]: { ...current[key], targetRepsMin, targetReps },
      }));
    },
    [plannedSessions],
  );

  const onChangePreviewRepMax = useCallback(
    (sessionIndex: number, order: number, value: number | undefined) => {
      if (value === undefined) return;
      const planned = plannedSessions
        .find((session) => session.index === sessionIndex)
        ?.exercises.find((exercise) => exercise.order === order);
      const firstSet = representativeSet(planned?.sets ?? []);
      if (firstSet === undefined) return;
      const targetReps = Math.max(1, Math.min(100, Math.trunc(value)));
      const targetRepsMin = Math.min(firstSet.targetRepsMin ?? firstSet.targetReps, targetReps);
      const key = previewEditKey(sessionIndex, order);
      setPreviewEdits((current) => ({
        ...current,
        [key]: { ...current[key], targetRepsMin, targetReps },
      }));
    },
    [plannedSessions],
  );

  const onSave = useCallback(async () => {
    if (plan === null || user === null) return;
    const chosenName = normalizeRoutineName(name);
    if (chosenName === null) {
      reportNameProblem('empty');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const now = Date.now();
      const routineId = `${user.uid}-${now}`;
      const existing = await routineRepository.listByUser(user.uid);
      const problem = routineNameProblem(chosenName, existing.map((routine) => routine.name));
      if (problem !== null) {
        reportNameProblem(problem);
        return;
      }
      await routineRepository.create({
        id: routineId,
        ...toRoutineDraft({
          userId: user.uid,
          name: chosenName,
          icon: 'barbell',
          accentColor: sectionAccent.train,
          isActive: shouldActivateNewRoutine(existing),
          generation: {
            goal,
            experienceLevel: level,
            split,
            sessionsPerMicrocycle: sessions,
            minutesPerSession: minutes,
            availableEquipment: equipment,
            priorityRegions: [...emphasis.priority],
            deprioritizedRegions: [...emphasis.deprioritized],
            vetoedExerciseIds: [],
            seed,
          },
          now,
        }),
      });
      const mesocycleId = `${routineId}-m0`;
      await mesocycleRepository.create({
        id: mesocycleId,
        ...toMesocycleDraft({
          userId: user.uid,
          routineId,
          plan,
          plannedSessions,
          now,
        }),
      });
      await routineRepository.update(routineId, { activeMesocycleId: mesocycleId });
      router.back();
    } catch (error) {
      // The athlete just spent a minute on this form: keep the plan on screen and let
      // them retry rather than losing it to a transient write failure. The code is
      // shown because a rejected write and a lost connection need different actions.
      console.error('[generate] save failed', error);
      setSaveError(saveFailureCode(error));
    } finally {
      setSaving(false);
    }
  }, [
    plan,
    user,
    name,
    t,
    sectionAccent,
    goal,
    level,
    split,
    sessions,
    minutes,
    equipment,
    emphasis,
    seed,
    plannedSessions,
    router,
    reportNameProblem,
  ]);

  const onCycleRegion = useCallback((region: VolumeRegion) => {
    setEmphasis((current) => cycleChoice(current, region));
  }, []);

  const onPrimary = useCallback(() => {
    if (primary === 'save') {
      void onSave();
      return;
    }
    // `view` returns to a plan the settings still describe, so it must NOT regenerate:
    // that would silently discard the athlete's preview edits.
    if (primary === 'view') {
      setPhase('preview');
      return;
    }
    generate(seed);
  }, [generate, onSave, primary, seed]);

  const onLeftAction = useCallback(() => {
    if (phase === 'preview') {
      setPhase('configure');
      return;
    }
    router.back();
  }, [phase, router]);

  const slots = usedSlots(emphasis);
  const canGenerate = equipment.length > 0;
  // The recommendation is only worth showing while the controls still hold it: once a
  // stepper moves, the numbers on screen are the athlete's and not the engine's.
  const showsRecommendation =
    recommendation !== null &&
    recommendation.sessionsPerMicrocycle === sessions &&
    recommendation.minutesPerSession === minutes;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }}>
      {/* A swipe back from the preview would pop the whole screen and discard an
          unsaved plan with its edits, so while the preview is up the phase owns going
          back and the gesture is off. */}
      <Stack.Screen options={{ gestureEnabled: phase === 'configure' }} />
      <Animated.View style={[styles.pages, { width: width * 2 }, pagesStyle]}>
        <View
          style={{ width }}
          pointerEvents={phase === 'configure' ? 'auto' : 'none'}
          accessibilityElementsHidden={phase !== 'configure'}
          importantForAccessibility={phase === 'configure' ? 'auto' : 'no-hide-descendants'}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + spacing.lg,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[typography.h1, { color: colors.textPrimary }]}>{t('generate.title')}</Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.sm },
              ]}
            >
              {t('generate.subtitle')}
            </Text>

            {/* Once a plan exists, this page has to say what is waiting on the other
                one, and whether the settings have moved under it since. */}
            {plan !== null && (
              <View style={{ marginTop: spacing.lg }}>
                <Text
                  style={[
                    typography.caption,
                    { color: stale ? semantic.warning : sectionAccent.train },
                  ]}
                >
                  {stale
                    ? t('generate.planStale')
                    : t('generate.planReady', { sets: plannedSetCount })}
                </Text>
                <RerollButton
                  onPress={onReroll}
                  disabled={!canGenerate}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}
            <View style={{ height: spacing.xl }} />

            <Section title={t('generate.goal')}>
              <ChipRow>
                {GOALS.map((entry) => (
                  <Chip
                    key={entry}
                    label={t(GOAL_LABEL[entry])}
                    selected={goal === entry}
                    onPress={() => setGoal(entry)}
                  />
                ))}
              </ChipRow>
            </Section>

            <Section title={t('generate.level')}>
              <ChipRow>
                {LEVELS.map((entry) => (
                  <Chip
                    key={entry}
                    label={t(`generate.level${entry}`)}
                    sublabel={t(`generate.levelHint${entry}`)}
                    selected={level === entry}
                    onPress={() => setLevel(entry)}
                  />
                ))}
              </ChipRow>
            </Section>

            <Section
              title={t('generate.capacity')}
              hint={t('generate.capacityBudget', {
                perSession: setBudget.perSession,
                total: setBudget.total,
              })}
            >
              <View style={{ gap: spacing.md }}>
                <Stepper
                  label={t('generate.sessions')}
                  value={sessions}
                  min={MIN_SESSIONS}
                  max={MAX_SESSIONS}
                  onChange={setSessions}
                />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('generate.sessionsHint')}
                </Text>
                <Stepper
                  label={t('generate.minutes')}
                  value={minutes}
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  step={MINUTES_STEP}
                  onChange={setMinutes}
                />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('generate.minutesHint')}
                </Text>

                {/* The anti-"more is better" control. A beginner who sets six sessions
                    is not training more, only spreading the same recoverable volume
                    thinner, and this is where the app says so. */}
                <Pressable
                  onPress={onRecommendCapacity}
                  disabled={!canGenerate || recommending}
                  accessibilityRole="button"
                  accessibilityLabel={t('generate.capacityAuto')}
                  style={[
                    styles.autoCapacityButton,
                    {
                      borderColor: sectionAccent.train,
                      backgroundColor: colors.surface,
                      borderRadius: radius.pill,
                      opacity: !canGenerate || recommending ? 0.4 : 1,
                    },
                  ]}
                >
                  {recommending ? (
                    <ActivityIndicator color={sectionAccent.train} />
                  ) : (
                    <Text style={[typography.body, { color: sectionAccent.train }]}>
                      {t('generate.capacityAuto')}
                    </Text>
                  )}
                </Pressable>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('generate.capacityAutoHint')}
                </Text>
                {showsRecommendation && (
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: recommendation.reachesRecoverableVolume
                          ? sectionAccent.train
                          : semantic.warning,
                      },
                    ]}
                  >
                    {t(
                      recommendation.reachesRecoverableVolume
                        ? 'generate.capacityAutoResult'
                        : 'generate.capacityAutoLimited',
                      {
                        sessions: recommendation.sessionsPerMicrocycle,
                        minutes: recommendation.minutesPerSession,
                        sets: recommendation.sets,
                      },
                    )}
                  </Text>
                )}
              </View>
            </Section>

            <Section
              title={t('generate.split')}
              hint={split === SplitStructure.AUTO ? t('generate.splitAutoHint') : undefined}
            >
              <ChipRow>
                {SPLITS.map((entry) => (
                  <Chip
                    key={entry}
                    label={t(`generate.split${entry}`)}
                    selected={split === entry}
                    onPress={() => setSplit(entry)}
                  />
                ))}
              </ChipRow>
            </Section>

            <Section
              title={t('generate.equipment')}
              hint={equipment.length === 0 ? t('generate.equipmentEmpty') : undefined}
            >
              <ChipRow>
                {EQUIPMENT.map((entry) => (
                  <Chip
                    key={entry}
                    label={t(`generate.equipment${entry}`)}
                    selected={equipment.includes(entry)}
                    onPress={() => toggleEquipment(entry)}
                  />
                ))}
              </ChipRow>
            </Section>

            <Section
              title={t('generate.emphasis')}
              hint={t('generate.emphasisHint')}
              trailing={t('generate.slotsLeft', { used: slots, total: PRIORITY_SLOT_BUDGET })}
              trailingTone={slots >= PRIORITY_SLOT_BUDGET ? 'warning' : 'normal'}
            >
              <ChipRow>
                {GENERATOR_EMPHASIS_REGIONS.map((region) => {
                  const choice = choiceOf(emphasis, region);
                  const blocked = prioritizeBlockedReason(emphasis, region);
                  return (
                    <Chip
                      key={region}
                      label={t(`region.${region}`)}
                      style={styles.emphasisChip}
                      cornerBadge={isLowCost(region) ? '½' : '1'}
                      centerLabel
                      raised
                      accessibilityLabel={`${t(`region.${region}`)} · ${t('generate.priorityCost', {
                        cost: isLowCost(region) ? '½' : '1',
                      })} · ${t(
                        choice === 'PRIORITY'
                          ? 'generate.emphasisPriority'
                          : choice === 'DEPRIORITIZED'
                            ? 'generate.emphasisDeprioritized'
                            : 'generate.emphasisBase',
                      )}`}
                      selected={choice !== 'NORMAL'}
                      tint={choice === 'PRIORITY' ? sectionAccent.train : semantic.deload}
                      onPress={() => onCycleRegion(region)}
                    />
                  );
                })}
              </ChipRow>
              {/* Explain the block instead of leaving a control dead with no cause. */}
              {slots >= PRIORITY_SLOT_BUDGET && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textMuted, marginTop: spacing.md },
                  ]}
                >
                  {t('generate.blockedSlotBudget')}
                </Text>
              )}
              {emphasis.priority.length >= MAX_PRIORITY_REGIONS && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textMuted, marginTop: spacing.xs },
                  ]}
                >
                  {t('generate.blockedRegionCap', { max: MAX_PRIORITY_REGIONS })}
                </Text>
              )}
            </Section>
          </ScrollView>
        </View>

        {/* Preview page. It only exists once there is a plan, and it stays mounted
            afterwards so a trip back to the form costs neither the athlete's place in
            it nor their edits here. */}
        <View
          style={{ width }}
          pointerEvents={phase === 'preview' ? 'auto' : 'none'}
          accessibilityElementsHidden={phase !== 'preview'}
          importantForAccessibility={phase === 'preview' ? 'auto' : 'no-hide-descendants'}
        >
          {plan !== null && (
            <ScrollView
              ref={previewScrollRef}
              contentContainerStyle={{
                paddingTop: insets.top + spacing.lg,
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.xl,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[typography.h1, { color: colors.textPrimary }]}>
                {t('generate.preview')}
              </Text>
              {/* Rerolling belongs here as well as on the form: the reason to want
                  another draw is usually something just read in this list. */}
              <RerollButton
                onPress={onReroll}
                style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
              />
              {/* Named here, not on the form: the name belongs to the plan being kept. */}
              <Section title={t('generate.name')}>
                <TextInput
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    setNameProblem(null);
                  }}
                  maxLength={MAX_ROUTINE_NAME_LENGTH}
                  placeholder={t('generate.namePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  accessibilityHint={t('generate.nameRequired')}
                  style={[
                    typography.body,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                      borderColor: nameProblem === null ? colors.surfaceBorder : semantic.danger,
                      borderWidth: 1,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.lg,
                      height: 52,
                    },
                  ]}
                />
                {nameProblem !== null && (
                  <Text style={[typography.caption, { color: semantic.danger, marginTop: spacing.xs }]}>
                    {t(nameProblem === 'empty' ? 'generate.nameRequired' : 'generate.nameDuplicate')}
                  </Text>
                )}
              </Section>
              {plan.strength?.missingBarbell === true && (
                <Text
                  style={[
                    typography.caption,
                    { color: semantic.warning, marginBottom: spacing.md },
                  ]}
                >
                  {t('generate.strengthNoBarbell')}
                </Text>
              )}
              <PlanPreview
                sessions={plannedSessions}
                limitedBy={plan.limitedBy}
                performedSets={plannedSetCount}
                exercisesById={exercisesById}
                onSwap={(sessionIndex, order) => setSwapTarget({ sessionIndex, order })}
                onChangeSets={onChangePreviewSets}
                onChangeRepMin={onChangePreviewRepMin}
                onChangeRepMax={onChangePreviewRepMax}
                overTimeSessionIndexes={overTimeSessionIndexes}
                volumeOutsideRange={volumeOutsideRange}
              />
              {saveError !== null && (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.caption, { color: semantic.danger }]}>
                    {t('generate.saveError')}
                  </Text>
                  <Text
                    selectable
                    style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}
                  >
                    {saveError}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Animated.View>

      <ExerciseSwapSheet
        current={swapCurrent}
        candidates={swapCandidates}
        onSelect={onSelectSwap}
        onClose={() => setSwapTarget(null)}
      />

      {/* Fixed action bar: the form is long and the primary action must not require
          scrolling to the bottom to find. */}
      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
            marginBottom:
              floatingTabBarBottom(insets.bottom) + FLOATING_TAB_BAR_HEIGHT + spacing.sm,
            backgroundColor: colors.bg,
            borderTopColor: colors.surfaceBorder,
          },
        ]}
      >
        <Pressable
          onPress={onLeftAction}
          accessibilityRole="button"
          style={{ height: 52, justifyContent: 'center', paddingRight: spacing.lg }}
        >
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {t(phase === 'preview' ? 'generate.back' : 'generate.cancel')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onPrimary}
          disabled={!canGenerate || saving}
          accessibilityRole="button"
          style={{
            flex: 1,
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: sectionAccent.train,
            opacity: !canGenerate || saving ? 0.4 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={[typography.title, { color: '#16191C' }]}>
              {t(PRIMARY_LABEL[primary])}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pages: { flex: 1, flexDirection: 'row' },
  emphasisChip: { width: '47%', minWidth: 0 },
  rerollButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  autoCapacityButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
});
