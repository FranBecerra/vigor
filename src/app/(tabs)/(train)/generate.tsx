/**
 * Mesocycle generation screen (PRD §8.8).
 *
 * The first screen that reaches the engine. Until now `planMesocycle` had no caller
 * outside tests.
 *
 * ONE SCROLL, NOT A WIZARD
 *   Seven groups of inputs would make a seven-step wizard, which costs a state
 *   machine, back-navigation and progress chrome to show one control at a time. A
 *   single scroll shows the athlete everything they are deciding and how the
 *   decisions interact, which matters here: session count and minutes move the set
 *   budget together, and splitting them across steps hides that.
 *
 * TWO PHASES
 *   Configure, then preview. Nothing is written until the athlete has seen the plan,
 *   because the generated selection is the thing they are actually agreeing to, and
 *   the editor is a first-class requirement rather than a later repair.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { Equipment, ExperienceLevel, SplitStructure } from '@/models';
import { useAuth } from '@/hooks/useAuth';
import {
  Chip,
  ChipRow,
  Section,
  Stepper,
} from '@/components/train/generate/GenerateControls';
import { PlanPreview } from '@/components/train/generate/PlanPreview';
import {
  EXERCISE_CATALOGUE,
  filterCatalogue,
} from '@/services/training/exerciseCatalogue';
import { planMesocycle, type MesocyclePlan } from '@/services/training/mesocyclePlanner';
import { approximateSetCapacity } from '@/services/training/trainingCapacity';
import {
  TrainingGoal,
  VolumeRegion,
  MAX_PRIORITY_REGIONS,
  PRIORITY_SLOT_BUDGET,
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
import { toMesocycleDraft, toRoutineDraft } from '@/services/training/routineMapper';
import { mesocycleRepository, routineRepository } from '@/services/repositories';
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
  Equipment.BANDS,
] as const;

const GOAL_LABEL: Record<TrainingGoal, string> = {
  [TrainingGoal.HYPERTROPHY]: 'generate.goalHypertrophy',
  [TrainingGoal.STRENGTH]: 'generate.goalStrength',
};

export default function GenerateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [plan, setPlan] = useState<MesocyclePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

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

  const toggleEquipment = useCallback((item: Equipment) => {
    setEquipment((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item],
    );
  }, []);

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
    },
    [equipment, level, goal, split, emphasis, sessions, minutes],
  );

  const onGenerate = useCallback(() => generate(seed), [generate, seed]);

  const onReroll = useCallback(() => {
    const next = Math.floor(Math.random() * 1_000_000);
    setSeed(next);
    generate(next);
  }, [generate]);

  const onSave = useCallback(async () => {
    if (plan === null || user === null) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const now = Date.now();
      const routineId = `${user.uid}-${now}`;
      await routineRepository.create({
        id: routineId,
        ...toRoutineDraft({
          userId: user.uid,
          name: name.trim() === '' ? t('generate.namePlaceholder') : name.trim(),
          icon: 'barbell',
          accentColor: sectionAccent.train,
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
        ...toMesocycleDraft({ userId: user.uid, routineId, plan, now }),
      });
      await routineRepository.update(routineId, { activeMesocycleId: mesocycleId });
      router.back();
    } catch {
      // The athlete just spent a minute on this form: keep the plan on screen and let
      // them retry rather than losing it to a transient write failure.
      setSaveFailed(true);
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
    router,
  ]);

  const onCycleRegion = useCallback((region: VolumeRegion) => {
    setEmphasis((current) => cycleChoice(current, region));
  }, []);

  const slots = usedSlots(emphasis);
  const canGenerate = equipment.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
            { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
          ]}
        >
          {t('generate.subtitle')}
        </Text>

        <Section title={t('generate.name')}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('generate.namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[
              typography.body,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderColor: colors.surfaceBorder,
                borderWidth: 1,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg,
                height: 52,
              },
            ]}
          />
        </Section>

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
                  sublabel={
                    choice === 'NORMAL'
                      ? isLowCost(region)
                        ? t('generate.regionCheap')
                        : undefined
                      : t(
                          choice === 'PRIORITY'
                            ? 'generate.emphasisPriority'
                            : 'generate.emphasisDeprioritized',
                        )
                  }
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

        {plan !== null && (
          <Section title={t('generate.preview')}>
            <PlanPreview
              sessions={toMesocycleDraft({
                userId: user?.uid ?? '',
                routineId: '',
                plan,
                now: 0,
              }).plannedSessions!}
              limitedBy={plan.limitedBy}
              performedSets={plan.selection.performedSets}
              exercisesById={exercisesById}
            />
            <Pressable
              onPress={onReroll}
              accessibilityRole="button"
              style={{
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={[typography.body, { color: colors.textPrimary }]}>
                {t('generate.reroll')}
              </Text>
            </Pressable>
          </Section>
        )}

        {saveFailed && (
          <Text
            style={[typography.caption, { color: semantic.danger, marginBottom: spacing.md }]}
          >
            {t('generate.saveError')}
          </Text>
        )}
      </ScrollView>

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
          onPress={() => router.back()}
          accessibilityRole="button"
          style={{ height: 52, justifyContent: 'center', paddingRight: spacing.lg }}
        >
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {t('generate.cancel')}
          </Text>
        </Pressable>
        <Pressable
          onPress={plan === null ? onGenerate : onSave}
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
              {t(plan === null ? 'generate.generate' : 'generate.save')}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
});
