import { Equipment, ExperienceLevel, MuscleGroup, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../exerciseCatalogue';
import { planDoseFirstMesocycle, planMesocycle, type MesocyclePlanInput, type MesocyclePlan } from '../mesocyclePlanner';
import * as planner from '../mesocyclePlanner';
import { findAlternativeSchedule, reviewScheduleSuitability, evaluateScheduleAlternative } from '../alternativeSchedule';
import { evaluateGeneratorQuality } from '../generatorQuality';
import { summarizeSelection } from '../exerciseSelection';
import { TrainingGoal, VolumeRegion } from '../volumePlan';

const input: MesocyclePlanInput = { level: ExperienceLevel.BEGINNER, goal: TrainingGoal.HYPERTROPHY,
  capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 90 },
  catalogue: EXERCISE_CATALOGUE, split: SplitStructure.AUTO, seed: 51 };

jest.setTimeout(60000);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const roster = (plan: MesocyclePlan) => plan.distribution.sessions.flatMap((session) =>
  session.exercises.map((entry) => [entry.exercise.id, entry.sets])).sort();

it('resolves audited case S with four real days rather than filler on five days', () => {
  const scenario = { ...input, seed: 74, priorityRegions: [VolumeRegion.GLUTES],
    capacity: { sessionsPerMicrocycle: 5, minutesPerSession: 50 } };
  const original = planMesocycle(scenario);
  expect(original.distribution.sessions.map((s) => s.exercises.reduce((n, e) => n + e.sets, 0)))
    .toEqual([10, 12, 9, 10, 9]);
  const alternative = findAlternativeSchedule(scenario, original)!;
  expect(alternative.input.capacity.sessionsPerMicrocycle).toBe(4);
  expect(alternative.quality.sessions.map((s) => s.sets)).toEqual([13, 12, 13, 12]);
  expect(alternative.quality.templateRecovery.filter((p) => p.reviewSuggested).length)
    .toBeLessThanOrEqual(0);
});

it('offers a real evaluated plan with less frequency without mutating the original', () => {
  const original = planMesocycle(input);
  const snapshot = JSON.stringify(original);
  const result = findAlternativeSchedule(input, original);
  expect(result).not.toBeNull();
  expect(result!.input.capacity.sessionsPerMicrocycle).toBeLessThan(6);
  expect(result!.input.capacity.minutesPerSession).toBe(90);
  expect(result!.plan.selection.performedSets).toBeGreaterThanOrEqual(original.selection.performedSets);
  expect(result!.quality.valid).toBe(true);
  expect(result!.quality.sessions.every((s) => s.sets >= 12)).toBe(true);
  expect(JSON.stringify(original)).toBe(snapshot);
});

it('does not offer unsafe filler or silently reduce volume when the budget is insufficient', () => {
  const constrained = { ...input, capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 15 } };
  expect(findAlternativeSchedule(constrained, planMesocycle(constrained))).toBeNull();
  const empty = { ...input, catalogue: [] };
  expect(findAlternativeSchedule(empty, planMesocycle(empty))).toBeNull();
});

it('does not reinterpret strength or already balanced hypertrophy requests', () => {
  const strength = { ...input, goal: TrainingGoal.STRENGTH };
  expect(findAlternativeSchedule(strength, planMesocycle(strength))).toBeNull();
  const balanced = { ...input, level: ExperienceLevel.INTERMEDIATE,
    capacity: { sessionsPerMicrocycle: 3, minutesPerSession: 90 } };
  expect(findAlternativeSchedule(balanced, planMesocycle(balanced))).toBeNull();
});

it('redistributes an existing production dose without calling either generation entry point', () => {
  const original = planDoseFirstMesocycle(input);
  const snapshot = JSON.stringify({ input, original });
  const raw = jest.spyOn(planner, 'planMesocycle').mockImplementation(() => { throw new Error('Unexpected regeneration'); });
  const production = jest.spyOn(planner, 'planDoseFirstMesocycle').mockImplementation(() => { throw new Error('Unexpected regeneration'); });
  try {
    const review = reviewScheduleSuitability(input, original);
    expect(review.status).toBe('alternative-available');
    expect(roster(review.alternative!.plan)).toEqual(roster(original));
    expect(review.alternative!.plan.plan).toBe(original.plan);
    expect(review.alternative!.plan.uncappedPlan).toBe(original.uncappedPlan);
    expect(review.alternative!.plan.selection).toBe(original.selection);
    expect(review.alternative!.preservesExactDose).toBe(true);
    expect(raw).not.toHaveBeenCalled(); expect(production).not.toHaveBeenCalled();
    expect(JSON.stringify({ input, original })).toBe(snapshot);
  } finally { raw.mockRestore(); production.mockRestore(); }
});

const profiles = Object.values(ExperienceLevel).flatMap((level) =>
  [SplitStructure.AUTO, SplitStructure.UPPER_LOWER, SplitStructure.FULL_BODY, SplitStructure.PUSH_PULL_LEGS,
    SplitStructure.PUSH_PULL_LEGS_UPPER].flatMap((split) => [false, true].map((freeOnly) => ({
    ...input, level, split, trainedRegions: [VolumeRegion.CHEST, VolumeRegion.BACK, VolumeRegion.BICEPS, VolumeRegion.TRICEPS],
    catalogue: freeOnly ? filterCatalogue(EXERCISE_CATALOGUE,
      { availableEquipment: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT] }) : EXERCISE_CATALOGUE,
  }))));

it.each(profiles)('reviews actual plans without changing targets or adding work: $level / $split', (scenario) => {
  const original = planDoseFirstMesocycle(scenario);
  const snapshot = JSON.stringify({ scenario, original });
  const review = reviewScheduleSuitability(scenario, original);
  if (review.alternative) {
    const candidate = review.alternative;
    expect(candidate.input.capacity.sessionsPerMicrocycle).toBeLessThan(scenario.capacity.sessionsPerMicrocycle);
    expect(candidate.input.capacity.minutesPerSession).toBe(scenario.capacity.minutesPerSession);
    expect(candidate.input.split).toBe(scenario.split);
    expect(roster(candidate.plan)).toEqual(roster(original));
    expect(candidate.plan.selection).toBe(original.selection);
    expect(candidate.quality.sessions.every((session) => session.sets >= 12 && session.minutes <= scenario.capacity.minutesPerSession)).toBe(true);
    const originalQuality = evaluateGeneratorQuality(scenario, original);
    for (const [muscle, before] of Object.entries(originalQuality.muscles)) {
      expect(candidate.quality.muscles[muscle].direct).toBe(before.direct);
      expect(candidate.quality.muscles[muscle].indirect).toBe(before.indirect);
    }
    expect(evaluateScheduleAlternative(scenario, original, candidate.plan, candidate.quality, originalQuality)).toEqual([]);
  }
  expect(JSON.stringify({ scenario, original })).toBe(snapshot);
});

it('keeps real preceding-workout protection when reviewing a schedule', () => {
  const original = planDoseFirstMesocycle(input);
  const scenario = { ...input, previousSession: original.distribution.sessions.at(-1)!.exercises };
  const review = reviewScheduleSuitability(scenario, original);
  if (review.alternative) expect(evaluateScheduleAlternative(scenario, original,
    review.alternative.plan, review.alternative.quality)).not.toContain('previous-workout');
  expect(scenario.capacity.sessionsPerMicrocycle).toBe(6);
});

it('activates whole-entry floor repair when compressing the reviewed beginner PPL plan', () => {
  const scenario = { ...input, split: SplitStructure.PUSH_PULL_LEGS, seed: 201,
    capacity: { sessionsPerMicrocycle: 5, minutesPerSession: 75 } };
  const original = planDoseFirstMesocycle(scenario);
  const alternative = findAlternativeSchedule(scenario, original)!;
  expect(alternative).not.toBeNull();
  expect(alternative.input.capacity.sessionsPerMicrocycle).toBe(4);
  expect(alternative.quality.sessions.every((session) => session.sets >= 12)).toBe(true);
  expect(roster(alternative.plan)).toEqual(roster(original));
  expect(alternative.plan.selection.performedSets).toBe(original.selection.performedSets);
});

it('repairs the no-barbell PPL label through an atomic exchange, without replacing exercises', () => {
  const scenario = { ...input, split: SplitStructure.PUSH_PULL_LEGS, seed: 201,
    capacity: { sessionsPerMicrocycle: 5, minutesPerSession: 75 },
    catalogue: EXERCISE_CATALOGUE.filter((exercise) => exercise.equipment !== Equipment.BARBELL) };
  const original = planDoseFirstMesocycle(scenario);
  const snapshot = JSON.stringify(original);
  const alternative = findAlternativeSchedule(scenario, original)!;
  expect(alternative).not.toBeNull();
  expect(alternative.input.capacity.sessionsPerMicrocycle).toBe(4);
  expect(alternative.quality.sessions.map((session) => session.sets)).toEqual([13, 12, 12, 13]);
  expect(alternative.quality.sessions.flatMap((session) => session.coherence)).toEqual([]);
  expect(roster(alternative.plan)).toEqual(roster(original));
  expect(JSON.stringify(original)).toBe(snapshot);
});

it.each(Object.values(ExperienceLevel))('explains an actual aggregate time constraint instead of cutting dose: %s', (level) => {
  const scenario = { ...input, level, capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 30 } };
  const original = planDoseFirstMesocycle(scenario);
  const review = reviewScheduleSuitability(scenario, original);
  expect(review.status).toBe('no-compatible-alternative');
  expect(review.alternative).toBeNull();
  expect(review.attempts.some((attempt) => attempt.reasons.includes('time-budget'))).toBe(true);
  expect(review.attempts.every((attempt) => attempt.reasons.every((reason) =>
    reason === 'time-budget' || reason === 'insufficient-dose'))).toBe(true);
});

it('does not present a mathematical day-count bound as an evaluated alternative', () => {
  const original = clone(planMesocycle(input));
  for (const session of original.distribution.sessions) for (const entry of session.exercises) entry.sets = 1;
  original.selection = summarizeSelection(original.distribution.sessions.flatMap((session) =>
    session.exercises.map(({ exercise, sets }) => ({ exercise, sets }))), original.plan, []);
  const review = reviewScheduleSuitability(input, original);
  expect(review.status).toBe('no-compatible-alternative');
  expect(review.alternative).toBeNull();
  expect(review.attempts.every((attempt) => attempt.reasons.includes('insufficient-dose'))).toBe(true);
});

it('distinguishes allocation defects from insufficient aggregate dose', () => {
  const scenario = { ...input, level: ExperienceLevel.INTERMEDIATE, capacity: { sessionsPerMicrocycle: 3, minutesPerSession: 90 } };
  const original = clone(planMesocycle(scenario));
  original.distribution.sessions[1].exercises.push(...original.distribution.sessions[0].exercises);
  original.distribution.sessions[0].exercises = [];
  const review = reviewScheduleSuitability(scenario, original);
  expect(review.status).toBe('allocation-bottleneck');
  expect(review.alternative).toBeNull(); expect(review.attempts).toEqual([]);
});

it('bypasses invalid capacity, missing dose and unresolved original placement', () => {
  const original = planMesocycle(input);
  for (const capacity of [{ sessionsPerMicrocycle: NaN, minutesPerSession: 90 },
    { sessionsPerMicrocycle: 1, minutesPerSession: 90 }, { sessionsPerMicrocycle: 6, minutesPerSession: Infinity },
    { sessionsPerMicrocycle: 6, minutesPerSession: 0 }]) {
    expect(reviewScheduleSuitability({ ...input, capacity }, original).status).toBe('not-applicable');
  }
  expect(reviewScheduleSuitability(input, { ...original, selection: { ...original.selection, performedSets: 0 } }).status).toBe('not-applicable');
  expect(reviewScheduleSuitability(input, { ...original, distribution: { ...original.distribution,
    unassigned: [original.distribution.sessions[0].exercises[0]] } }).status).toBe('not-applicable');
});

describe('cross-calendar promotion guards', () => {
  const original = planMesocycle(input);
  const alternative = findAlternativeSchedule(input, original)!;
  const originalQuality = evaluateGeneratorQuality(input, original);
  const guard = (candidate: MesocyclePlan, quality = alternative.quality) =>
    evaluateScheduleAlternative(input, original, candidate, quality, originalQuality);

  it('rejects time overflow, unassigned work and short sessions', () => {
    const candidate = clone(alternative.plan); candidate.distribution.sessions[0].estimatedWorkMinutes = 1000;
    expect(guard(candidate)).toContain('invalid-placement');
    expect(guard(alternative.plan, { ...alternative.quality, valid: false })).toContain('invalid-placement');
    expect(guard(alternative.plan, { ...alternative.quality, sessions: alternative.quality.sessions.map((session) => ({ ...session, sets: 11 })) }))
      .toContain('short-session');
  });

  it('rejects dose/identity changes and altered muscle credits despite identical IDs', () => {
    const candidate = clone(alternative.plan); candidate.selection.performedSets--;
    expect(guard(candidate)).toContain('dose-changed');
    const credits = clone(alternative.plan);
    const first = credits.distribution.sessions[0].exercises[0];
    first.exercise.primaryMuscle = first.exercise.primaryMuscle === MuscleGroup.NECK ? MuscleGroup.BICEPS : MuscleGroup.NECK;
    expect(guard(credits)).toContain('dose-changed');
  });

  it('rejects increased modeled rest deficits or changed cycle duration', () => {
    const quality = clone(alternative.quality); quality.templateRecovery[0].reviewSuggested = true; quality.templateRecovery[0].cost = 1000;
    expect(guard(alternative.plan, quality)).toContain('recovery-template');
    expect(guard(alternative.plan, { ...alternative.quality, scheduleTemplate: { ...alternative.quality.scheduleTemplate, days: 8 } }))
      .toContain('cycle-duration');
  });

  it('rejects new concentration, redundancy and muscle-cap excess', () => {
    const candidate = clone(alternative.plan);
    const first = candidate.distribution.sessions[0].exercises[0];
    candidate.distribution.sessions[0].exercises.push(...Array.from({ length: 10 }, () => clone(first)));
    expect(guard(candidate)).toEqual(expect.arrayContaining(['concentration', 'muscle-cap', 'redundancy', 'dose-changed']));
  });

  it('rejects misleading labels and lost high-dose exposure', () => {
    const quality = clone(alternative.quality);
    quality.issues.push(...Array.from({ length: originalQuality.issues.length + 1 }, () =>
      ({ code: 'focus-without-press', severity: 'warning' as const, actual: 0, limit: 1 })));
    expect(guard(alternative.plan, quality)).toContain('coherence');
    const before = clone(originalQuality); before.muscles.BICEPS.attributed = 12; before.muscles.BICEPS.directSessions = 2;
    const after = clone(alternative.quality); after.muscles.BICEPS.directSessions = 1;
    expect(evaluateScheduleAlternative(input, original, alternative.plan, after, before)).toContain('high-dose-exposure');
  });

  it('rejects loss of compound anchors and increased real preceding-workout overlap', () => {
    const candidate = clone(alternative.plan);
    const isolation = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'curl-polea-baja')!;
    for (const session of candidate.distribution.sessions) for (const entry of session.exercises) entry.exercise = isolation;
    expect(guard(candidate)).toContain('anchors');
    const previousSession = [{ exercise: isolation, sets: 4 }];
    const before = clone(original);
    before.distribution.sessions[0].exercises = [];
    expect(evaluateScheduleAlternative({ ...input, previousSession }, before, candidate,
      alternative.quality, originalQuality)).toContain('previous-workout');
  });
});
