import { ExperienceLevel, MuscleGroup, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { evaluatePolicyPromotion, planMesocycle, type MesocyclePlan } from '../mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '../volumePlan';
import { buildScheduleTemplate, templateRecovery } from '../scheduleTemplate';
import { toPlannedSessions } from '../routineMapper';

const input = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 65 }, catalogue: EXERCISE_CATALOGUE, seed: 31 };
const base = planMesocycle({ ...input, rankingPolicy: 'legacy-weighted' });
const copy = (): MesocyclePlan => JSON.parse(JSON.stringify(base));
const decision = (candidate: MesocyclePlan) => evaluatePolicyPromotion(input, base, candidate, 'accessory-aware');

it('records both production comparisons without mutating inputs or changing explicit policies', () => {
  const snapshot = JSON.stringify(input);
  const result = planMesocycle(input);
  expect(result.policyTrace?.slice(0, 2).map((entry) => entry.candidatePolicy)).toEqual(['volume-aware', 'accessory-aware']);
  expect(result.policyTrace?.slice(2).map((entry) => entry.candidateSeed)).toEqual([30, 32]);
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
it('rejects the raw overlap regression and accepts an AUTO repair without weakening the guard', () => {
  const caseInput = { ...input, seed: 49, split: SplitStructure.AUTO,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 75 },
    priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS], deprioritizedRegions: [VolumeRegion.QUADS] };
  const incumbent = planMesocycle({ ...caseInput, rankingPolicy: 'coupled-control' });
  const raw = planMesocycle({ ...caseInput, rankingPolicy: 'accessory-aware' });
  expect(evaluatePolicyPromotion(caseInput, incumbent, raw, 'accessory-aware')).toMatchObject({ accepted: false,
    reasons: [expect.objectContaining({ code: 'template-overlap-count', before: 0, after: 1 })] });
  const result = planMesocycle(caseInput);
  expect(result.policyTrace?.[1]).toMatchObject({ candidatePolicy: 'accessory-aware', accepted: true, reasons: [] });
});
it('repairs the advanced five-day seed bottleneck and refreshes placement diagnostics', () => {
  const result = planMesocycle({ ...input, level: ExperienceLevel.ADVANCED, seed: 50, split: SplitStructure.AUTO,
    capacity: { sessionsPerMicrocycle: 5, minutesPerSession: 65 },
    priorityRegions: [VolumeRegion.TRICEPS], deprioritizedRegions: [VolumeRegion.HAMSTRINGS] });
  expect(result.selection.performedSets).toBeGreaterThanOrEqual(90);
  const sessions = result.distribution.sessions;
  expect(sessions).toHaveLength(5);
  expect(sessions.every((session) => session.estimatedWorkMinutes <= result.availableWorkMinutesPerSession)).toBe(true);
  expect(sessions.every((session) => session.exercises.reduce((sum, entry) => sum + entry.sets, 0) >= 12)).toBe(true);
  const frequencies: Partial<Record<MuscleGroup, number>> = {};
  sessions.forEach((session) => new Set(session.exercises.map((entry) => entry.exercise.primaryMuscle))
    .forEach((muscle) => { frequencies[muscle] = (frequencies[muscle] ?? 0) + 1; }));
  expect(result.distribution.frequencyByMuscle).toEqual(frequencies);
  expect(result.maxSessionWorkMinutes).toBe(Math.max(...sessions.map((session) => session.estimatedWorkMinutes)));
  expect(result.estimatedWorkMinutes).toBe(sessions.reduce((sum, session) => sum + session.estimatedWorkMinutes, 0));
});
it('does not trade consecutive-day recovery for more sets in the advanced upper/lower case', () => {
  const result = planMesocycle({ ...input, level: ExperienceLevel.ADVANCED, seed: 31,
    split: SplitStructure.UPPER_LOWER, capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 75 },
    priorityRegions: [VolumeRegion.BACK], deprioritizedRegions: [] });
  const sessions = toPlannedSessions(result);
  const catalogue = new Map(EXERCISE_CATALOGUE.map((exercise) => [exercise.id, exercise]));
  expect(templateRecovery(buildScheduleTemplate(sessions, catalogue), sessions, catalogue)
    .filter((pair) => pair.reviewSuggested)).toHaveLength(0);
});
