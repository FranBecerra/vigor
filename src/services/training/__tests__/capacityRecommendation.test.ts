import { Equipment, ExperienceLevel, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '@/services/training/exerciseCatalogue';
import {
  recommendCapacity,
  RECOMMENDED_SESSION_COUNTS,
  RECOMMENDED_SESSION_MINUTES,
} from '@/services/training/capacityRecommendation';
import { TOTAL_SETS_RANGE, TrainingGoal, VolumeRegion } from '@/services/training/volumePlan';

const gym = filterCatalogue(EXERCISE_CATALOGUE, {
  availableEquipment: [
    Equipment.BARBELL,
    Equipment.DUMBBELL,
    Equipment.MACHINE,
    Equipment.CABLE,
    Equipment.SMITH_MACHINE,
    Equipment.BODYWEIGHT,
    Equipment.KETTLEBELL,
    Equipment.BANDS,
  ],
});
const bodyweightOnly = filterCatalogue(EXERCISE_CATALOGUE, {
  availableEquipment: [Equipment.BODYWEIGHT],
});

describe('recommendCapacity', () => {
  it('stays inside the bounds it declares', () => {
    const recommendation = recommendCapacity({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: gym,
    });
    expect(RECOMMENDED_SESSION_COUNTS).toContain(recommendation.sessionsPerMicrocycle);
    expect(RECOMMENDED_SESSION_MINUTES).toContain(recommendation.minutesPerSession);
    expect(recommendation.weeklyMinutes).toBe(
      recommendation.sessionsPerMicrocycle * recommendation.minutesPerSession,
    );
  });

  // Advice that moves with the draw is not advice. This is why the module samples a
  // fixed set of seeds instead of the athlete's current one.
  it('gives the same answer twice', () => {
    const input = {
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: gym,
    };
    expect(recommendCapacity(input)).toEqual(recommendCapacity(input));
  });

  it('reaches the recoverable volume of the level with a full gym', () => {
    const [minimum] = TOTAL_SETS_RANGE[TrainingGoal.HYPERTROPHY][ExperienceLevel.INTERMEDIATE];
    const recommendation = recommendCapacity({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: gym,
    });
    expect(recommendation.reachesRecoverableVolume).toBe(true);
    expect(recommendation.sets).toBeGreaterThanOrEqual(minimum);
  });

  // The whole point of the feature: a beginner who would have set six sessions is told
  // that fewer is enough, because the ceiling is recovery and not willingness.
  it('asks a beginner for less than it asks an advanced athlete', () => {
    const beginner = recommendCapacity({
      level: ExperienceLevel.BEGINNER,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: gym,
    });
    const advanced = recommendCapacity({
      level: ExperienceLevel.ADVANCED,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: gym,
    });
    expect(beginner.weeklyMinutes).toBeLessThan(advanced.weeklyMinutes);
    expect(beginner.sets).toBeLessThan(advanced.sets);
  });

  it('never recommends a beginner the maximum session count', () => {
    const maximum = Math.max(...RECOMMENDED_SESSION_COUNTS);
    expect(
      recommendCapacity({
        level: ExperienceLevel.BEGINNER,
        goal: TrainingGoal.HYPERTROPHY,
        catalogue: gym,
      }).sessionsPerMicrocycle,
    ).toBeLessThan(maximum);
  });

  it('honours a manually chosen split and an emphasis', () => {
    const recommendation = recommendCapacity({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: gym,
      split: SplitStructure.PUSH_PULL_LEGS,
      priorityRegions: [VolumeRegion.BACK],
      deprioritizedRegions: [VolumeRegion.BICEPS],
    });
    expect(RECOMMENDED_SESSION_COUNTS).toContain(recommendation.sessionsPerMicrocycle);
    expect(recommendation.sets).toBeGreaterThan(0);
  });

  it('recommends a strength block separately from a hypertrophy one', () => {
    const strength = recommendCapacity({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.STRENGTH,
      catalogue: gym,
    });
    expect(strength.reachesRecoverableVolume).toBe(true);
    expect(RECOMMENDED_SESSION_MINUTES).toContain(strength.minutesPerSession);
  });

  // `limitedBy` alone reported `recovery` here, which is why the qualification also
  // reads the level's own minimum: 37 bodyweight sets are not an advanced athlete's
  // recoverable volume, and saying they were would be the lie the feature must avoid.
  it('declares that the equipment is the limit instead of dressing up a thin plan', () => {
    const recommendation = recommendCapacity({
      level: ExperienceLevel.ADVANCED,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: bodyweightOnly,
    });
    expect(recommendation.reachesRecoverableVolume).toBe(false);
    expect(RECOMMENDED_SESSION_COUNTS).toContain(recommendation.sessionsPerMicrocycle);
  });

  it('survives an empty catalogue', () => {
    const recommendation = recommendCapacity({
      level: ExperienceLevel.BEGINNER,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: [],
    });
    expect(recommendation.sets).toBe(0);
    expect(recommendation.reachesRecoverableVolume).toBe(false);
  });
});
