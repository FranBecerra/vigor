import { Equipment, ExperienceLevel, MuscleGroup, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '@/services/training/exerciseCatalogue';
import { selectExercises } from '@/services/training/exerciseSelection';
import {
  allocateDoseFirst, completeDoseWithinCapacity, planDoseFirstMesocycle,
  planMesocycle, rerollMesocycle, repairDosePlacement, evaluateDoseFrontier, type MesocyclePlanInput,
} from '@/services/training/mesocyclePlanner';
import { buildVolumePlan, TrainingGoal, VolumeRegion } from '@/services/training/volumePlan';
import { workloadTemplateRecovery } from '@/services/training/scheduleTemplate';
import { sessionSequencingWarnings } from '@/services/training/sessionDistribution';

jest.setTimeout(60000);

const base: MesocyclePlanInput = {
  level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  catalogue: EXERCISE_CATALOGUE, seed: 1,
  capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 65 },
};

const dose = (plan: ReturnType<typeof planMesocycle>) => ({
  targets: plan.plan, originalTargets: plan.uncappedPlan, squeeze: plan.squeeze,
  performed: plan.selection.performedSets, attributed: plan.selection.attributedByMuscle,
  sessions: plan.distribution.sessions.map((session) => {
    const muscles: Record<string, { direct: number; indirect: number }> = {};
    for (const entry of session.exercises) {
      const direct = muscles[entry.exercise.primaryMuscle] ??= { direct: 0, indirect: 0 };
      direct.direct += entry.sets;
      for (const muscle of new Set(entry.exercise.secondaryMuscles)) {
        if (muscle === entry.exercise.primaryMuscle) continue;
        (muscles[muscle] ??= { direct: 0, indirect: 0 }).indirect += entry.sets * 0.5;
      }
    }
    return Object.fromEntries(Object.entries(muscles).sort(([a], [b]) => a.localeCompare(b)));
  }),
});

describe('dose-before-variation allocator', () => {
  it('preserves the production advanced chest-maintenance dose after catalogue metadata correction', () => {
    const input = { ...base,
      level: ExperienceLevel.ADVANCED, split: SplitStructure.PUSH_PULL_LEGS,
      deprioritizedRegions: [VolumeRegion.CHEST], capacity: { sessionsPerMicrocycle: 5, minutesPerSession: 75 } };
    const earlier = allocateDoseFirst(input);
    const laterInput = { ...input, capacity: { ...input.capacity, minutesPerSession: 80 } };
    const later = allocateDoseFirst(laterInput);
    expect(later.selection.performedSets).toBeGreaterThanOrEqual(earlier.selection.performedSets);
    expect(later.distribution.unassigned).toHaveLength(0);
    expect(later.distribution.sessions.every((session) => session.estimatedWorkMinutes <= 74)).toBe(true);
  });
  it('preserves the limited-equipment dose across two successive off-grid time increments', () => {
    const catalogue = filterCatalogue(EXERCISE_CATALOGUE,
      { availableEquipment: [Equipment.DUMBBELL, Equipment.BODYWEIGHT] });
    const initial = { ...base, catalogue, capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 60 } };
    const plans = [60, 65, 70].map((minutesPerSession) => allocateDoseFirst({ ...initial,
      capacity: { ...initial.capacity, minutesPerSession } }));
    expect(plans[1].selection.performedSets).toBeGreaterThanOrEqual(plans[0].selection.performedSets);
    expect(plans[2].selection.performedSets).toBeGreaterThanOrEqual(plans[1].selection.performedSets);
    for (const plan of plans) expect(plan.distribution.unassigned).toHaveLength(0);
  });
  const profiles = Object.values(ExperienceLevel).flatMap((level) =>
    [SplitStructure.AUTO, SplitStructure.UPPER_LOWER, SplitStructure.PUSH_PULL_LEGS,
      SplitStructure.FULL_BODY, SplitStructure.PUSH_PULL_LEGS_UPPER].flatMap((split) =>
      [45, 75].map((minutes) => ({ ...base, level, split,
        capacity: { sessionsPerMicrocycle: 4, minutesPerSession: minutes } }))));

  it.each(profiles)('freezes actual attributed dose before variation: $level / $split / $capacity.minutesPerSession', (input) => {
    const before = JSON.stringify(input);
    const reference = allocateDoseFirst(input);
    const other = allocateDoseFirst({ ...input, seed: 984 });
    expect(dose(other)).toEqual(dose(reference));
    expect(other.distribution.sessions.map((session) => session.exercises)).toEqual(
      reference.distribution.sessions.map((session) => session.exercises));
    for (const seed of [2, 31, 129]) {
      const variant = rerollMesocycle({ ...input, seed }, reference);
      expect(dose(variant)).toEqual(dose(reference));
      expect(variant.distribution.unassigned).toHaveLength(0);
      expect(variant.distribution.sessions.every((session) =>
        session.estimatedWorkMinutes <= variant.availableWorkMinutesPerSession)).toBe(true);
      expect(variant.selection.selected.every((entry) => entry.sets <= 4)).toBe(true);
    }
    expect(JSON.stringify(input)).toBe(before);
  });

  it('does not depend on catalogue enumeration for deterministic marginal selection', () => {
    const input = { volumePlan: buildVolumePlan(base), catalogue: EXERCISE_CATALOGUE,
      seed: 1, deterministic: true, rankingPolicy: 'accessory-aware' as const };
    expect(selectExercises({ ...input, seed: 83, catalogue: [...input.catalogue].reverse() }))
      .toEqual(selectExercises(input));
    expect(allocateDoseFirst({ ...base, catalogue: [...base.catalogue].reverse() }))
      .toEqual(allocateDoseFirst(base));
  });

  it('validates ranked branches and keeps them seed-independent', () => {
    const input = { volumePlan: buildVolumePlan(base), catalogue: EXERCISE_CATALOGUE,
      seed: 1, deterministic: true, deterministicAlternative: { position: 2, rank: 1 } };
    expect(selectExercises({ ...input, seed: 812 })).toEqual(selectExercises(input));
    for (const deterministicAlternative of [{ position: -1, rank: 1 }, { position: 1, rank: NaN },
      { position: 1.5, rank: 0 }]) {
      expect(() => selectExercises({ ...input, deterministicAlternative })).toThrow(RangeError);
    }
    expect(selectExercises({ ...input, deterministicAlternative: { position: 1, rank: 999 } }).selected.length)
      .toBeGreaterThan(0);
  });

  it('jointly adds and balances the declared-volume regression into four twelve-set days', () => {
    const input = { ...base, level: ExperienceLevel.BEGINNER,
      declaredVolume: { [VolumeRegion.BACK]: 8, [VolumeRegion.QUADS]: 4 } };
    const plan = allocateDoseFirst(input);
    expect(plan.distribution.sessions.map((session) => session.exercises.reduce((sum, entry) => sum + entry.sets, 0)))
      .toEqual([12, 12, 12, 12]);
    expect(plan.selection.performedSets).toBe(48);
  });

  it('retains the free-weight advanced dose with five additional minutes', () => {
    const input = { ...base, level: ExperienceLevel.ADVANCED, split: SplitStructure.AUTO, seed: 95,
      catalogue: filterCatalogue(EXERCISE_CATALOGUE,
        { availableEquipment: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT] }),
      capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 60 } };
    const earlier = allocateDoseFirst(input);
    const later = allocateDoseFirst({ ...input, capacity: { ...input.capacity, minutesPerSession: 65 } });
    expect(earlier.selection.performedSets).toBeGreaterThanOrEqual(92);
    expect(later.selection.performedSets).toBeGreaterThanOrEqual(earlier.selection.performedSets);
    expect(later.distribution.sessions.every((session) => session.estimatedWorkMinutes <= 59)).toBe(true);
    const reviews = workloadTemplateRecovery(later.distribution.sessions.map((session) => {
      const directSets = new Map<string, number>();
      for (const entry of session.exercises) directSets.set(entry.exercise.primaryMuscle,
        (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets);
      return { index: session.index, directSets };
    })).filter((pair) => pair.reviewSuggested);
    expect(reviews).toHaveLength(0);
  });

  it('repairs placement without changing the roster, dose or input', () => {
    const input = { ...base, seed: 7, capacity: { sessionsPerMicrocycle: 5, minutesPerSession: 65 } };
    const source = planMesocycle({ ...input, deterministicDose: true });
    const snapshot = JSON.stringify(source);
    const result = repairDosePlacement(input, source);
    expect(result.selection.performedSets).toBe(source.selection.performedSets);
    expect(result.selection.attributedByMuscle).toEqual(source.selection.attributedByMuscle);
    expect(result.distribution.sessions.flatMap((session) => session.exercises.map((entry) =>
      [entry.exercise.id, entry.sets])).sort()).toEqual(source.distribution.sessions.flatMap((session) =>
      session.exercises.map((entry) => [entry.exercise.id, entry.sets])).sort());
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(result.distribution.sessions.every((session) => session.estimatedWorkMinutes <= result.availableWorkMinutesPerSession)).toBe(true);
    const infeasible = { ...source, distribution: { ...source.distribution,
      unassigned: [{ exercise: source.selection.selected[0].exercise, sets: 3 }] } };
    expect(repairDosePlacement(input, infeasible)).toBe(infeasible);
    expect(repairDosePlacement({ ...input, goal: TrainingGoal.STRENGTH }, source)).toBe(source);
  });

  it.each([
    { trainedRegions: [VolumeRegion.CHEST, VolumeRegion.BACK, VolumeRegion.BICEPS, VolumeRegion.TRICEPS],
      split: SplitStructure.AUTO, sessions: 4, minutes: 65 },
    { priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS], deprioritizedRegions: [VolumeRegion.QUADS],
      split: SplitStructure.PUSH_PULL_LEGS, sessions: 5, minutes: 75 },
    { priorityRegions: [VolumeRegion.GLUTES, VolumeRegion.HAMSTRINGS], deprioritizedRegions: [VolumeRegion.CHEST],
      split: SplitStructure.PUSH_PULL_LEGS, sessions: 5, minutes: 75 },
  ])('repairs the reviewed recovery-template regression: $split / $sessions', (profile) => {
    const { sessions, minutes, ...settings } = profile;
    const result = allocateDoseFirst({ ...base, ...settings, level: ExperienceLevel.ADVANCED,
      capacity: { sessionsPerMicrocycle: sessions, minutesPerSession: minutes } });
    const reviews = workloadTemplateRecovery(result.distribution.sessions.map((session) => {
      const directSets = new Map<string, number>();
      for (const entry of session.exercises) directSets.set(entry.exercise.primaryMuscle,
        (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets);
      return { index: session.index, directSets };
    })).filter((pair) => pair.reviewSuggested);
    expect(reviews).toHaveLength(0);
    expect(result.distribution.sessions.every((session) => session.estimatedWorkMinutes <= result.availableWorkMinutesPerSession)).toBe(true);
  });

  it('does not trade actual preceding-workout sequencing for rest-template improvement', () => {
    const source = planMesocycle({ ...base, deterministicDose: true });
    const previousSession = source.distribution.sessions[0].exercises;
    const input = { ...base, previousSession };
    const result = repairDosePlacement(input, source);
    const risk = (plan: typeof source) => sessionSequencingWarnings(plan.distribution.sessions, previousSession)
      .reduce((sum, warning) => sum + warning.risk, 0)
      + sessionSequencingWarnings([plan.distribution.sessions[0]], plan.distribution.sessions.at(-1)!.exercises)
        .reduce((sum, warning) => sum + warning.risk, 0);
    expect(risk(result)).toBeLessThanOrEqual(risk(source));
    expect(result.selection.attributedByMuscle).toEqual(source.selection.attributedByMuscle);
    expect(result.selection.performedSets).toBe(source.selection.performedSets);
  });

  it('does not remove hard timing or dose guards in the capacity frontier', () => {
    const source = allocateDoseFirst(base);
    const candidate = { ...source, distribution: { ...source.distribution,
      sessions: source.distribution.sessions.map((session, index) => index === 0
        ? { ...session, estimatedWorkMinutes: 200 } : session) } };
    expect(evaluateDoseFrontier(base, source, candidate).accepted).toBe(false);
    expect(evaluateDoseFrontier(base, source, candidate).reasons.some((reason) => reason.code === 'session-time')).toBe(true);
    expect(evaluateDoseFrontier(base, source, { ...source,
      selection: { ...source.selection, performedSets: source.selection.performedSets - 10 } }).accepted).toBe(false);
  });

  it.each([TrainingGoal.STRENGTH, TrainingGoal.HYPERTROPHY])('retains explicit-policy controls: %s', (goal) => {
    const input = { ...base, goal, rankingPolicy: 'ordinal' as const };
    expect(allocateDoseFirst(input)).toEqual(planMesocycle(input));
    expect(planDoseFirstMesocycle(input)).toEqual(planMesocycle(input));
  });

  it('retains lift-specific strength planning when no policy override is supplied', () => {
    const input = { ...base, goal: TrainingGoal.STRENGTH };
    expect(planDoseFirstMesocycle(input)).toEqual(planMesocycle(input));
    const plan = planMesocycle(input);
    expect(completeDoseWithinCapacity(input, plan)).toBe(plan);
  });

  it('reports empty/zero-capacity inputs and rejects non-finite inputs', () => {
    expect(planDoseFirstMesocycle({ ...base, catalogue: [] }).limitedBy).toBe('catalogue');
    const zeroCapacity = allocateDoseFirst({ ...base,
      capacity: { sessionsPerMicrocycle: 0, minutesPerSession: 0 } });
    // Existing planner retains an explicitly unassigned roster, not a usable plan.
    expect(zeroCapacity.distribution.sessions).toHaveLength(0);
    expect(zeroCapacity.distribution.unassigned.length).toBeGreaterThan(0);
    expect(completeDoseWithinCapacity(base, zeroCapacity)).toBe(zeroCapacity);
    for (const input of [{ ...base, seed: NaN },
      { ...base, capacity: { sessionsPerMicrocycle: NaN, minutesPerSession: 65 } },
      { ...base, capacity: { sessionsPerMicrocycle: 4, minutesPerSession: Infinity } }]) {
      expect(() => allocateDoseFirst(input)).toThrow(RangeError);
    }
  });

  it('never adds filler when all original targets are zero or placement is unresolved', () => {
    const plan = allocateDoseFirst(base);
    const zero = { ...plan, uncappedPlan: { ...plan.uncappedPlan,
      muscles: plan.uncappedPlan.muscles.map((muscle) => ({ ...muscle, meav: 0 })) } };
    expect(completeDoseWithinCapacity(base, zero)).toBe(zero);
    const unresolved = { ...plan, distribution: { ...plan.distribution,
      unassigned: [{ exercise: plan.selection.selected[0].exercise, sets: plan.selection.selected[0].sets }] } };
    expect(completeDoseWithinCapacity(base, unresolved)).toBe(unresolved);
  });

  it('keeps the short two-day beginner case feasible without inventing arm work', () => {
    const input = { ...base, level: ExperienceLevel.BEGINNER,
      capacity: { sessionsPerMicrocycle: 2, minutesPerSession: 45 } };
    const plan = planDoseFirstMesocycle(input);
    expect(plan.distribution.sessions).toHaveLength(2);
    expect(plan.distribution.sessions.every((session) =>
      session.estimatedWorkMinutes <= plan.availableWorkMinutesPerSession)).toBe(true);
    expect(plan.selection.performedSets).toBeGreaterThanOrEqual(24);
  });

  it('does not raise a deprioritized adjusted target above its provisional target', () => {
    const input = { ...base,
      catalogue: filterCatalogue(EXERCISE_CATALOGUE, { availableEquipment: Object.values(Equipment) }),
      deprioritizedRegions: [VolumeRegion.QUADS, VolumeRegion.HAMSTRINGS, VolumeRegion.GLUTES],
    };
    const plan = allocateDoseFirst(input);
    expect(plan.plan.muscles.find((muscle) => muscle.muscle === MuscleGroup.QUADS)?.meav)
      .toBeLessThanOrEqual(plan.uncappedPlan.muscles.find((muscle) => muscle.muscle === MuscleGroup.QUADS)!.meav);
    expect(plan.distribution.unassigned).toHaveLength(0);
  });
});
