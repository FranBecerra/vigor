import { ExperienceLevel, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { planMesocycle, type MesocyclePlanInput } from '../mesocyclePlanner';
import { findAlternativeSchedule } from '../alternativeSchedule';
import { TrainingGoal, VolumeRegion } from '../volumePlan';

const input: MesocyclePlanInput = { level: ExperienceLevel.BEGINNER, goal: TrainingGoal.HYPERTROPHY,
  capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 90 },
  catalogue: EXERCISE_CATALOGUE, split: SplitStructure.AUTO, seed: 51 };

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
