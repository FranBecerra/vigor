import { ExperienceLevel, MuscleGroup, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { selectExercises, type SelectionResult } from '../exerciseSelection';
import { distributeSelection, type SessionDistribution, type DistributionInput } from '../sessionDistribution';
import { planMesocycle } from '../mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '../volumePlan';
import { concentrationCost, recommendCapacity, recommendCapacityAsync, CapacityRecommendationCancelled } from '../capacityRecommendation';

jest.mock('../exerciseSelection', () => ({ ...jest.requireActual('../exerciseSelection'), selectExercises: jest.fn() }));
jest.mock('../sessionDistribution', () => ({ ...jest.requireActual('../sessionDistribution'), distributeSelection: jest.fn() }));
jest.mock('../mesocyclePlanner', () => ({ planMesocycle: jest.fn() }));
const selector = jest.mocked(selectExercises), distributor = jest.mocked(distributeSelection);
const exercise = { ...EXERCISE_CATALOGUE[0]!, primaryMuscle: MuscleGroup.BICEPS, secondaryMuscles: [] };
const input = { level: ExperienceLevel.BEGINNER, goal: TrainingGoal.HYPERTROPHY,
  catalogue: [exercise], trainedRegions: [VolumeRegion.BICEPS], declaredVolume: { [VolumeRegion.BICEPS]: 24 } };
beforeEach(() => {
  jest.clearAllMocks();
  selector.mockImplementation(({ volumePlan }) => ({ selected: [{ exercise, sets: 24 }], performedSets: 24,
    attributedByMuscle: Object.fromEntries(volumePlan.muscles.map((muscle) => [muscle.muscle, muscle.meav])) } as unknown as SelectionResult));
  distributor.mockImplementation(({ selection, sessionsPerMicrocycle: days }: DistributionInput) => ({
    sessions: Array.from({ length: days }, (_, index) => ({ index, estimatedWorkMinutes: 72 / days,
      exercises: [{ exercise: selection.selected[0]!.exercise, sets: 24 / days }] })),
    unassigned: [], structureWarnings: [], sequencingWarnings: [],
  } as unknown as SessionDistribution));
});
it('builds fixed targets and three rosters once, never regenerating or squeezing for a calendar', () => {
  const result = recommendCapacity(input);
  expect(selector).toHaveBeenCalledTimes(3);
  expect(new Set(selector.mock.calls.map(([request]) => JSON.stringify(request.volumePlan))).size).toBe(1);
  expect(selector.mock.calls[0]![0].volumePlan.regions[0]!.basis).toBe('declared');
  expect(distributor).toHaveBeenCalledTimes(45);
  expect(planMesocycle).not.toHaveBeenCalled();
  expect(result.sets).toBe(24);
  expect(result.sessionsPerMicrocycle).toBe(3); // Two days concentrate 12 sets in each exposure.
  expect(result.reachesRecoverableVolume).toBe(true);
});
it('preserves fixed dose and reports unavailable muscle targets rather than selecting a smaller target', () => {
  selector.mockReturnValue({ selected: [{ exercise, sets: 24 }], performedSets: 24,
    attributedByMuscle: {} } as unknown as SelectionResult);
  const result = recommendCapacity(input);
  expect(result.sets).toBe(24);
  expect(result.reachesRecoverableVolume).toBe(false);
  expect(selector).toHaveBeenCalledTimes(3);
});
it('honours a manual split and does not impose frequency two for low-dose work', () => {
  distributor.mockImplementation(({ selection, sessionsPerMicrocycle: days }) => ({ sessions: Array.from({ length: days }, (_, index) => ({
    index, estimatedWorkMinutes: 30, exercises: [{ exercise: selection.selected[0]!.exercise, sets: 6 }],
  })), unassigned: [], sequencingWarnings: [], structureWarnings: [{ kind: 'single-frequency' }] } as unknown as SessionDistribution));
  expect(recommendCapacity({ ...input, split: SplitStructure.PUSH_PULL_LEGS }).sessionsPerMicrocycle).toBe(2);
  expect(distributor.mock.calls.every(([request]) => request.split === SplitStructure.PUSH_PULL_LEGS)).toBe(true);
});
it('does not qualify overlong or empty schedules, even when the targets are covered', () => {
  distributor.mockReturnValue({ sessions: [{ exercises: [], estimatedWorkMinutes: 100 }],
    unassigned: [{ exercise, sets: 24 }], sequencingWarnings: [], structureWarnings: [] } as unknown as SessionDistribution);
  expect(recommendCapacity(input).reachesRecoverableVolume).toBe(false);
});
it('returns zero dose honestly for an empty selection', () => {
  selector.mockReturnValue({ selected: [], performedSets: 0, attributedByMuscle: {} } as unknown as SelectionResult);
  distributor.mockReturnValue({ sessions: [{ exercises: [], estimatedWorkMinutes: 0 }],
    unassigned: [], sequencingWarnings: [], structureWarnings: [] } as unknown as SessionDistribution);
  expect(recommendCapacity({ ...input, catalogue: [] })).toMatchObject({ sets: 0, reachesRecoverableVolume: false });
});
it('yields before selecting and can cancel before any work', async () => {
  let cancelled = false;
  await expect(recommendCapacityAsync(input, { yieldToUI: async () => { cancelled = true; }, isCancelled: () => cancelled }))
    .rejects.toBeInstanceOf(CapacityRecommendationCancelled);
  expect(selector).not.toHaveBeenCalled();
});
it('can cancel between calendar evaluations and agrees with synchronous execution', async () => {
  let pauses = 0;
  await expect(recommendCapacityAsync(input, { yieldToUI: async () => { pauses++; }, isCancelled: () => pauses >= 3 }))
    .rejects.toBeInstanceOf(CapacityRecommendationCancelled);
  expect(selector).toHaveBeenCalledTimes(3);
  expect(distributor).toHaveBeenCalledTimes(3);
  expect(await recommendCapacityAsync(input)).toEqual(recommendCapacity(input));
});
it('counts indirect dose without duplicate or primary credit and treats ten as a soft reference', () => {
  const distribution = (sets: number) => ({ sessions: [{ index: 0, focus: 'pull', estimatedWorkMinutes: 40,
    exercises: [{ exercise: { ...exercise, secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.TRICEPS, MuscleGroup.BICEPS] }, sets }] }] } as unknown as SessionDistribution);
  expect(concentrationCost(distribution(10))).toBe(0);
  expect(concentrationCost(distribution(12))).toBe(2);
  expect(concentrationCost(distribution(24))).toBe(16);
  expect(concentrationCost({ sessions: [] })).toBe(0);
});
