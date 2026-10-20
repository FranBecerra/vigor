import { ExperienceLevel, MuscleGroup, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { planMesocycle, rebalanceFinalDose, evaluateFinalPlanRepair, type MesocyclePlan } from '../mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '../volumePlan';
import { sessionSequencingWarnings } from '../sessionDistribution';

const input = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  capacity: { sessionsPerMicrocycle: 3, minutesPerSession: 45 }, split: SplitStructure.FULL_BODY,
  catalogue: EXERCISE_CATALOGUE, seed: 8 };
const loads = (plan: MesocyclePlan) => plan.distribution.sessions.map((session) =>
  session.exercises.reduce((sum, entry) => sum + entry.sets, 0));

it.each([
  [ExperienceLevel.INTERMEDIATE, SplitStructure.FULL_BODY, 3, 8, [12, 12, 13]],
  [ExperienceLevel.ADVANCED, SplitStructure.PUSH_PULL_LEGS, 6, 63, [12, 12, 13, 12, 12, 12]],
] as const)('repairs the actual %s frozen-roster bottleneck through a guarded complete candidate', (level, split, days, seed, expected) => {
  const settings = { ...input, level, split, seed, capacity: { sessionsPerMicrocycle: days, minutesPerSession: 45 } };
  const snapshot = JSON.stringify(settings);
  const plan = planMesocycle(settings);
  expect(loads(plan)).toEqual(expected);
  expect(plan.distribution.sessions.every((session) => session.estimatedWorkMinutes <= plan.availableWorkMinutesPerSession)).toBe(true);
  expect(plan.policyTrace?.filter((entry) => entry.stage === 'final-roster-repair').length).toBeLessThanOrEqual(6);
  expect(plan.policyTrace?.find((entry) => entry.stage === 'final-roster-repair' && entry.accepted)).toBeDefined();
  expect(plan.distribution.sequencingWarnings).toEqual(sessionSequencingWarnings(plan.distribution.sessions));
  expect(JSON.stringify(settings)).toBe(snapshot);
  expect(loads(planMesocycle(settings))).toEqual(expected);
});

it('repairs the beginner priority case without changing total dose or explicit reference policies', () => {
  const settings = { ...input, level: ExperienceLevel.BEGINNER, split: SplitStructure.AUTO, seed: 123,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 65 },
    priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS], deprioritizedRegions: [VolumeRegion.QUADS, VolumeRegion.CHEST] };
  const plan = planMesocycle(settings);
  expect(loads(plan)).toEqual([12, 12, 13, 12]);
  expect(plan.policyTrace?.filter((entry) => entry.stage === 'final-roster-repair')).toHaveLength(6);
  expect(plan.policyTrace?.some((entry) => entry.stage === 'final-roster-repair' && entry.accepted)).toBe(false);
  expect(plan.policyTrace?.some((entry) => entry.stage === 'final-set-repair' && entry.accepted)).toBe(true);
  expect(plan.selection.performedSets).toBe(49);
  expect(planMesocycle({ ...settings, rankingPolicy: 'legacy-weighted' }).policyTrace).toBeUndefined();
  expect(planMesocycle({ ...settings, goal: TrainingGoal.STRENGTH }).policyTrace).toBeUndefined();
});

it.each([
  [SplitStructure.AUTO, 123, 65, true, true],
  [SplitStructure.AUTO, 126, 65, true, true],
  [SplitStructure.AUTO, 123, 70, true, true],
  [SplitStructure.UPPER_LOWER, 205, 75, false, false],
  [SplitStructure.UPPER_LOWER, 208, 75, false, false],
  [SplitStructure.UPPER_LOWER, 204, 75, true, false],
  [SplitStructure.UPPER_LOWER, 206, 75, true, false],
  [SplitStructure.PUSH_PULL_LEGS_UPPER, 208, 75, false, false],
  [SplitStructure.AUTO, 205, 75, false, false],
  [SplitStructure.AUTO, 208, 75, false, false],
  [SplitStructure.AUTO, 204, 75, true, false],
  [SplitStructure.AUTO, 206, 75, true, false],
] as const)('closes the residual beginner profile %s seed %s, minutes %s, priority %s, maintenance %s', (split, seed, minutes, priority, maintenance) => {
  const settings = { ...input, level: ExperienceLevel.BEGINNER, split, seed,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: minutes },
    priorityRegions: priority ? [VolumeRegion.BACK, VolumeRegion.TRICEPS] : [],
    deprioritizedRegions: maintenance ? [VolumeRegion.QUADS, VolumeRegion.CHEST] : [] };
  const plan = planMesocycle(settings);
  expect(loads(plan).every((sets) => sets >= 12)).toBe(true);
  expect(plan.distribution.sessions.every((session) => session.estimatedWorkMinutes <= plan.availableWorkMinutesPerSession)).toBe(true);
  expect(plan.distribution.sessions.flatMap((session) => session.exercises).every((entry) => entry.sets <= 4)).toBe(true);
  expect(plan.distribution.sessions.flatMap((session) => session.exercises)
    .filter((entry) => entry.exercise.profile !== 'ISOLATION').every((entry) => entry.sets >= 3)).toBe(true);
});

it('rejects malformed or repeated appearances and leaves the source plan untouched', () => {
  const base = planMesocycle({ ...input, rankingPolicy: 'legacy-weighted' });
  for (const sets of [NaN, 0, 1.5, 5]) {
    const malformed: MesocyclePlan = JSON.parse(JSON.stringify(base));
    malformed.distribution.sessions[0].exercises[0].sets = sets;
    expect(rebalanceFinalDose(input, malformed)).toBe(malformed);
  }
  const repeated: MesocyclePlan = JSON.parse(JSON.stringify(base));
  repeated.distribution.sessions[0].exercises.push(repeated.distribution.sessions[0].exercises[0]);
  expect(rebalanceFinalDose(input, repeated)).toBe(repeated);
  const snapshot = JSON.stringify(base);
  rebalanceFinalDose(input, base);
  expect(JSON.stringify(base)).toBe(snapshot);
  expect(rebalanceFinalDose({ ...input, goal: TrainingGoal.STRENGTH }, base)).toBe(base);
});

it('does not run extra draws when aggregate dose cannot support the product floor or the catalogue is empty', () => {
  for (const settings of [{ ...input, catalogue: [] }, { ...input, capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 30 } }]) {
    expect(planMesocycle(settings).policyTrace?.some((entry) => entry.stage === 'final-roster-repair')).toBe(false);
  }
});

it('rejects a tied candidate and explains complete-plan regressions without mutating either plan', () => {
  const base = planMesocycle({ ...input, rankingPolicy: 'legacy-weighted' });
  const candidate: MesocyclePlan = JSON.parse(JSON.stringify(base));
  expect(evaluateFinalPlanRepair(input, base, candidate).reasons.map((reason) => reason.code)).toContain('no-allocation-improvement');
  candidate.distribution.frequencyByMuscle[MuscleGroup.QUADS] = 0;
  candidate.distribution.sessions[0].exercises = [];
  const before = JSON.stringify(base), after = JSON.stringify(candidate);
  const review = evaluateFinalPlanRepair(input, base, candidate);
  expect(review.accepted).toBe(false);
  expect(review.reasons.map((reason) => reason.code)).toContain('final-exposure');
  expect(review.reasons.map((reason) => reason.code)).toContain('final-anchor');
  expect(JSON.stringify(base)).toBe(before);
  expect(JSON.stringify(candidate)).toBe(after);
});

it.each(['final-redundancy', 'final-muscle-cap', 'final-concentration'])('rejects %s rather than accepting a filled day blindly', (code) => {
  const baseline = planMesocycle({ ...input, rankingPolicy: 'legacy-weighted' });
  const candidate: MesocyclePlan = JSON.parse(JSON.stringify(baseline));
  candidate.distribution.sessions[0].exercises.push({ ...candidate.distribution.sessions[0].exercises[0], sets: 20 });
  const review = evaluateFinalPlanRepair(input, baseline, candidate);
  expect(review.accepted).toBe(false);
  expect(review.reasons.map((reason) => reason.code)).toContain(code);
});

it('rejects the actual advanced alternative with worse template and cyclic/adjacent overlap', () => {
  const settings = { ...input, level: ExperienceLevel.ADVANCED, split: SplitStructure.PUSH_PULL_LEGS,
    capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 45 } };
  const baseline = planMesocycle({ ...settings, seed: 63 });
  const candidate = planMesocycle({ ...settings, seed: 65 });
  const review = evaluateFinalPlanRepair(settings, baseline, candidate);
  expect(review.accepted).toBe(false);
  expect(review.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining([
    'final-recoveryCost', 'final-adjacentCount', 'final-flaggedRisk',
  ]));
});
