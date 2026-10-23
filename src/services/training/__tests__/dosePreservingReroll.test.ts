import { Equipment, ExperienceLevel, ExerciseGenerationTier, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { evaluateFinalPlanRepair, planMesocycle, rerollMesocycle, rerollMesocycleAsync } from '../mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '../volumePlan';
import { effectiveSetsByMuscle } from '../sessionDistribution';
import { toPlannedSessions } from '../routineMapper';

const base = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 75 }, split: SplitStructure.AUTO,
  catalogue: EXERCISE_CATALOGUE, seed: 11 };
it('yields between candidate checks, matches synchronous variation and cancels without changing the incumbent', async () => {
  const plan = planMesocycle(base); const yieldControl = jest.fn(async () => {});
  expect(await rerollMesocycleAsync({ ...base, seed: 202 }, plan, { yieldControl })).toEqual(rerollMesocycle({ ...base, seed: 202 }, plan));
  expect(yieldControl.mock.calls.length).toBeGreaterThan(1);
  let cancelled = false;
  expect(await rerollMesocycleAsync(base, plan, { yieldControl: async () => { cancelled = true; }, isCancelled: () => cancelled })).toBe(plan);
  await expect(rerollMesocycleAsync({ ...base, seed: NaN }, plan, { yieldControl })).rejects.toThrow(RangeError);
});
const fingerprint = (plan: ReturnType<typeof planMesocycle>) => plan.distribution.sessions.map((session) => ({
  sets: session.exercises.reduce((sum, entry) => sum + entry.sets, 0),
  direct: Object.fromEntries([...new Set(session.exercises.map((entry) => entry.exercise.primaryMuscle))]
    .sort().map((muscle) => [muscle, session.exercises.filter((entry) => entry.exercise.primaryMuscle === muscle)
      .reduce((sum, entry) => sum + entry.sets, 0)])),
  attributed: [...effectiveSetsByMuscle(session.exercises)].sort(([a], [b]) => a.localeCompare(b)),
}));

it.each([ExperienceLevel.BEGINNER, ExperienceLevel.INTERMEDIATE, ExperienceLevel.ADVANCED])(
  'preserves targets and actual per-session direct/indirect dose for ten successive %s draws', (level) => {
    const input = { ...base, level, priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS] };
    const original = planMesocycle(input);
    const snapshot = JSON.stringify(original);
    let current = original;
    let changed = 0;
    for (let seed = 201; seed <= 210; seed++) {
      const next = rerollMesocycle({ ...input, seed }, current);
      if (next !== current) changed++;
      expect(fingerprint(next)).toEqual(fingerprint(original));
      expect(next.plan).toEqual(original.plan);
      expect(next.uncappedPlan).toEqual(original.uncappedPlan);
      expect(next.squeeze).toBe(original.squeeze);
      expect(next.selection.performedSets).toBe(original.selection.performedSets);
      expect(next.selection.attributedByMuscle).toEqual(original.selection.attributedByMuscle);
      const review = evaluateFinalPlanRepair(input, current, next);
      expect(review.reasons.filter((reason) => reason.code !== 'no-allocation-improvement'
        && reason.code !== 'no-objective-improvement')).toEqual([]);
      expect(review.metrics.ordinalCostAfter).toBeLessThanOrEqual(review.metrics.ordinalCostBefore);
      const dimensions = (p: typeof original) => {
        const tags = new Map<string, Set<string>>();
        for (const entry of p.selection.selected) for (const tag of entry.exercise.stimulusTags ?? []) {
          const key = `${entry.exercise.primaryMuscle}:${tag.split(':')[0]}`;
          const values = tags.get(key) ?? new Set<string>(); values.add(tag); tags.set(key, values);
        }
        return tags;
      };
      const afterDimensions = dimensions(next);
      for (const [key, tags] of dimensions(current)) expect(afterDimensions.get(key)?.size ?? 0).toBeGreaterThanOrEqual(tags.size);
      expect(toPlannedSessions(next).map((session) => session.exercises.reduce((sum, entry) => sum + entry.sets.length, 0)))
        .toEqual(fingerprint(original).map((session) => session.sets));
      expect(next.distribution.sessions.every((session) => session.estimatedWorkMinutes <= next.availableWorkMinutesPerSession)).toBe(true);
      const ids = next.selection.selected.map((entry) => entry.exercise.id);
      expect(new Set(ids).size).toBe(ids.length);
      current = next;
    }
    expect(changed).toBeGreaterThan(0);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

it.each([
  [SplitStructure.UPPER_LOWER, 'free'], [SplitStructure.AUTO, 'free'], [SplitStructure.PUSH_PULL_LEGS_UPPER, 'full'],
] as const)('freezes the budget on the advanced sensitivity profile %s %s', (split, equipment) => {
  const input = { ...base, level: ExperienceLevel.ADVANCED, split, seed: equipment === 'free' ? 209 : 206,
    catalogue: equipment === 'full' ? EXERCISE_CATALOGUE : EXERCISE_CATALOGUE.filter((exercise) =>
      [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT].includes(exercise.equipment)) };
  const plan = planMesocycle(input);
  for (let seed = 201; seed <= 210; seed++) {
    const next = rerollMesocycle({ ...input, seed }, plan);
    expect(fingerprint(next)).toEqual(fingerprint(plan));
    expect(next.selection.attributedByMuscle).toEqual(plan.selection.attributedByMuscle);
    expect(next.plan).toEqual(plan.plan);
  }
});

it('is deterministic and retains the incumbent when no compatible catalogue option exists', () => {
  const plan = planMesocycle(base);
  const input = { ...base, seed: 99 };
  expect(rerollMesocycle(input, plan)).toEqual(rerollMesocycle(input, plan));
  expect(rerollMesocycle({ ...input, catalogue: [] }, plan)).toBe(plan);
  expect(rerollMesocycle({ ...input, catalogue: plan.selection.selected.map((entry) => entry.exercise) }, plan)).toBe(plan);
  expect(rerollMesocycle({ ...input, capacity: { ...input.capacity, sessionsPerMicrocycle: 3 } }, plan)).toBe(plan);
  expect(() => rerollMesocycle({ ...input, seed: NaN }, plan)).toThrow(RangeError);
});

it('does not admit unavailable/manual-only/strength variants, repetitions, or mutate strength', () => {
  const plan = planMesocycle(base);
  const pool = plan.selection.selected.map((entry, index) => ({ ...entry.exercise, id: `new-${index}`,
    generationTier: ExerciseGenerationTier.MANUAL_ONLY }));
  expect(rerollMesocycle({ ...base, catalogue: pool }, plan)).toBe(plan);
  expect(rerollMesocycle({ ...base, catalogue: pool.map((e) => ({ ...e, generationTier: ExerciseGenerationTier.STRENGTH_VARIANT })) }, plan)).toBe(plan);
  const strength = planMesocycle({ ...base, goal: TrainingGoal.STRENGTH });
  expect(rerollMesocycle({ ...base, goal: TrainingGoal.STRENGTH, catalogue: [] }, strength)).toBe(strength);
  expect(rerollMesocycle(base, strength)).toBe(strength);
  const repeated = { ...plan, distribution: { ...plan.distribution, sessions: [...plan.distribution.sessions, plan.distribution.sessions[0]] } };
  expect(rerollMesocycle({ ...base, capacity: { ...base.capacity, sessionsPerMicrocycle: 5 } }, repeated)).toBe(repeated);
});

it('keeps strength main lifts, singles and muscle dose when varying accessories/variants', () => {
  const input = { ...base, goal: TrainingGoal.STRENGTH };
  const plan = planMesocycle(input);
  const main = (p: typeof plan) => p.distribution.sessions.map((s) => s.exercises
    .filter((e) => e.strength?.role === 'MAIN').map((e) => [e.exercise.id, e.sets, e.strength?.topSingle]));
  for (let seed = 201; seed <= 210; seed++) {
    const next = rerollMesocycle({ ...input, seed }, plan);
    expect(fingerprint(next)).toEqual(fingerprint(plan));
    expect(main(next)).toEqual(main(plan));
    expect(next.plan).toEqual(plan.plan);
  }
});
