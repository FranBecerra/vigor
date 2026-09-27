/**
 * Goal-specific repetition and effort prescription — PURE LOGIC.
 *
 * Hypertrophy can be achieved across a broad load range when sets are taken
 * sufficiently close to failure. Strength is more load-specific, so it receives
 * lower repetition ranges and conservative RPE 7–8 routine work, rising to RPE
 * 8–9 in the final microcycle before a deload. RIR remains the canonical stored
 * unit; RPE is its presentation inverse (`RPE = 10 - RIR`).
 */
import { ExerciseProfile } from '@/models';
import { targetRIR } from './rirAutoregulation';
import { TrainingGoal } from './volumePlan';

export interface RepRange {
  min: number;
  max: number;
}

export interface ExercisePrescription {
  reps: RepRange;
  targetRIR: number;
  /** Maximum extra reserve assigned to early sets of the same exercise. */
  maxExtraReserve: number;
}

const REP_RANGES: Record<TrainingGoal, Record<ExerciseProfile, RepRange>> = {
  [TrainingGoal.HYPERTROPHY]: {
    [ExerciseProfile.COMPOUND_PRIMARY]: { min: 6, max: 10 },
    [ExerciseProfile.COMPOUND_SECONDARY]: { min: 8, max: 12 },
    [ExerciseProfile.ISOLATION]: { min: 10, max: 15 },
  },
  [TrainingGoal.STRENGTH]: {
    [ExerciseProfile.COMPOUND_PRIMARY]: { min: 3, max: 5 },
    [ExerciseProfile.COMPOUND_SECONDARY]: { min: 5, max: 8 },
    [ExerciseProfile.ISOLATION]: { min: 8, max: 12 },
  },
};

const STRENGTH_RIR: Record<ExerciseProfile, { routine: number; peak: number }> = {
  [ExerciseProfile.COMPOUND_PRIMARY]: { routine: 2, peak: 1 },
  [ExerciseProfile.COMPOUND_SECONDARY]: { routine: 2, peak: 1 },
  [ExerciseProfile.ISOLATION]: { routine: 1, peak: 0 },
};

export function exercisePrescription(
  goal: TrainingGoal,
  profile: ExerciseProfile,
  isFinalMicrocycleBeforeDeload = false,
): ExercisePrescription {
  if (goal === TrainingGoal.STRENGTH) {
    const effort = STRENGTH_RIR[profile];
    return {
      reps: REP_RANGES[goal][profile],
      targetRIR: isFinalMicrocycleBeforeDeload ? effort.peak : effort.routine,
      maxExtraReserve: 1,
    };
  }

  return {
    reps: REP_RANGES[goal][profile],
    // Routine failure is not required for hypertrophy and adds disproportionate
    // fatigue. Isolation reaches RIR 0 only in the peak microcycle.
    targetRIR:
      profile === ExerciseProfile.ISOLATION && !isFinalMicrocycleBeforeDeload
        ? 1
        : targetRIR(profile, isFinalMicrocycleBeforeDeload),
    maxExtraReserve: 2,
  };
}

/** Formats a range with an en dash for compact plan summaries. */
export function formatRepRange(range: RepRange): string {
  return `${range.min}–${range.max}`;
}
