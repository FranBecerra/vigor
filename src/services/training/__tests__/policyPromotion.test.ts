import { ExperienceLevel, MuscleGroup, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { evaluatePolicyPromotion, planMesocycle, type MesocyclePlan } from '../mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '../volumePlan';

const input = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 65 }, catalogue: EXERCISE_CATALOGUE, seed: 31 };
const base = planMesocycle({ ...input, rankingPolicy: 'legacy-weighted' });
const copy = (): MesocyclePlan => JSON.parse(JSON.stringify(base));
const decision = (candidate: MesocyclePlan) => evaluatePolicyPromotion(input, base, candidate, 'accessory-aware');

it('records both production comparisons without mutating inputs or changing explicit policies', () => {
  const snapshot = JSON.stringify(input);
  const result = planMesocycle(input);
  expect(result.policyTrace?.map((entry) => entry.candidatePolicy)).toEqual(['volume-aware', 'accessory-aware']);
  expect(result.policyTrace?.every((entry) => entry.accepted === (entry.reasons.length === 0))).toBe(true);
  expect(planMesocycle({ ...input, rankingPolicy: 'coupled-control' }).policyTrace).toHaveLength(1);
  expect(base.policyTrace).toBeUndefined();
  expect(planMesocycle({ ...input, goal: TrainingGoal.STRENGTH }).policyTrace).toBeUndefined();
  expect(JSON.stringify(input)).toBe(snapshot);
});
it('explains ties instead of claiming that a feasible candidate is necessarily better', () => {
  expect(decision(copy())).toMatchObject({ accepted: false, reasons: [{ code: 'no-objective-improvement' }] });
});
it.each([
  ['unassigned-work', (p: MesocyclePlan) => { p.distribution.unassigned.push(p.distribution.sessions[0].exercises[0]); }],
  ['session-time', (p: MesocyclePlan) => { p.distribution.sessions[0].estimatedWorkMinutes = 100; }],
  ['empty-session', (p: MesocyclePlan) => { p.distribution.sessions[0].exercises = []; }],
  ['minimum-session-load', (p: MesocyclePlan) => { p.distribution.sessions[0].exercises = []; }],
  ['underfilled-count', (p: MesocyclePlan) => { p.distribution.sessions[0].exercises = []; }],
  ['session-load-spread', (p: MesocyclePlan) => { p.distribution.sessions[0].exercises[0].sets += 20; }],
  ['performed-volume', (p: MesocyclePlan) => { p.selection.performedSets -= 1; }],
  ['foundational-coverage', (p: MesocyclePlan) => { p.selection.missingFoundationalPatterns.push(EXERCISE_CATALOGUE[0].movementVector); }],
  ['muscle-attribution', (p: MesocyclePlan) => { p.selection.attributedByMuscle[MuscleGroup.TRICEPS] = 0; }],
  ['direct-accessory-floor', (p: MesocyclePlan) => { p.selection.selected = p.selection.selected.filter((e) => e.exercise.primaryMuscle !== MuscleGroup.BICEPS); }],
] as const)('names the %s rejection', (code, mutate) => {
  const candidate = copy();
  mutate(candidate);
  expect(decision(candidate).reasons.map((reason) => reason.code)).toContain(code);
  expect(decision(candidate).accepted).toBe(false);
});
it('accepts strictly lower ordinal cost only when all preservation constraints hold', () => {
  const candidate = copy();
  candidate.selection.selected.forEach((e) => { e.exercise.criteria!.systemicFatigueCost = 5; });
  const result = decision(candidate);
  expect(result.accepted).toBe(true);
  expect(result.metrics.targetShortfallAfter).toBe(result.metrics.targetShortfallBefore);
  expect(result.metrics.ordinalCostAfter).toBeLessThan(result.metrics.ordinalCostBefore);
  expect(base.selection.selected.some((e) => e.exercise.criteria!.systemicFatigueCost < 5)).toBe(true);
});
it('accepts a meaningful target-shortfall improvement even if ordinal cost rises', () => {
  const candidate = copy();
  for (const muscle of candidate.uncappedPlan.muscles) {
    candidate.selection.attributedByMuscle[muscle.muscle] = Math.max(
      candidate.selection.attributedByMuscle[muscle.muscle] ?? 0, muscle.meav);
  }
  candidate.selection.selected.forEach((entry) => { entry.exercise.criteria!.systemicFatigueCost = 1; });
  const result = decision(candidate);
  expect(result.metrics.targetShortfallBefore).toBeGreaterThan(0.5);
  expect(result.metrics.targetShortfallAfter).toBe(0);
  expect(result.metrics.ordinalCostAfter).toBeGreaterThan(result.metrics.ordinalCostBefore);
  expect(result.accepted).toBe(true);
});
it('explains the real seed-12 overlap rejection rather than treating lower cost as sufficient', () => {
  const result = planMesocycle({ ...input, seed: 12, split: SplitStructure.AUTO,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 75 },
    priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS], deprioritizedRegions: [VolumeRegion.QUADS] });
  expect(result.policyTrace?.[1]).toMatchObject({ candidatePolicy: 'accessory-aware', accepted: false,
    reasons: [expect.objectContaining({ code: 'template-overlap-count', before: 0, after: 1 })] });
});
