import { ExerciseProfile } from '@/models';
import {
  exercisePrescription,
  formatRepRange,
} from '@/services/training/exercisePrescription';
import { TrainingGoal } from '@/services/training/volumePlan';

describe('exercisePrescription', () => {
  it('uses lower, strength-specific reps for primary compounds', () => {
    const hypertrophy = exercisePrescription(
      TrainingGoal.HYPERTROPHY,
      ExerciseProfile.COMPOUND_PRIMARY,
    );
    const strength = exercisePrescription(
      TrainingGoal.STRENGTH,
      ExerciseProfile.COMPOUND_PRIMARY,
    );

    expect(hypertrophy.reps).toEqual({ min: 6, max: 10 });
    expect(strength.reps).toEqual({ min: 3, max: 5 });
    expect(strength.maxExtraReserve).toBeLessThan(hypertrophy.maxExtraReserve);
  });

  it.each([
    [ExerciseProfile.COMPOUND_SECONDARY, { min: 5, max: 8 }],
    [ExerciseProfile.ISOLATION, { min: 8, max: 12 }],
  ])('prescribes strength assistance for %s', (profile, reps) => {
    expect(exercisePrescription(TrainingGoal.STRENGTH, profile).reps).toEqual(reps);
  });

  it.each([
    [ExerciseProfile.COMPOUND_SECONDARY, { min: 8, max: 12 }],
    [ExerciseProfile.ISOLATION, { min: 10, max: 15 }],
  ])('prescribes hypertrophy work for %s', (profile, reps) => {
    expect(exercisePrescription(TrainingGoal.HYPERTROPHY, profile).reps).toEqual(reps);
  });

  it('raises strength RPE in the final microcycle without prescribing failure on primary lifts', () => {
    const routine = exercisePrescription(
      TrainingGoal.STRENGTH,
      ExerciseProfile.COMPOUND_PRIMARY,
    );
    const peak = exercisePrescription(
      TrainingGoal.STRENGTH,
      ExerciseProfile.COMPOUND_PRIMARY,
      true,
    );
    expect(peak.targetRIR).toBeLessThan(routine.targetRIR);
    expect(peak.targetRIR).toBe(1);
  });

  it('allows peak isolation work to reach failure for both goals', () => {
    expect(
      exercisePrescription(TrainingGoal.STRENGTH, ExerciseProfile.ISOLATION, true).targetRIR,
    ).toBe(0);
    expect(
      exercisePrescription(TrainingGoal.HYPERTROPHY, ExerciseProfile.ISOLATION, true).targetRIR,
    ).toBe(0);
  });

  it('does not prescribe routine hypertrophy isolation to failure', () => {
    expect(
      exercisePrescription(TrainingGoal.HYPERTROPHY, ExerciseProfile.ISOLATION).targetRIR,
    ).toBe(1);
  });

  it('formats compact ranges with an en dash', () => {
    expect(formatRepRange({ min: 8, max: 12 })).toBe('8–12');
  });
});
