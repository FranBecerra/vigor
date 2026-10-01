/**
 * Goal-specific repetition and effort prescription — PURE LOGIC.
 *
 * Hypertrophy can be achieved across a broad load range when sets are taken
 * sufficiently close to failure. Strength is more load-specific, so it receives
 * lower repetition ranges and conservative RPE 7–8 routine work, rising to RPE
 * 8–9 in the final microcycle before a deload. RIR remains the canonical stored
 * unit; RPE is its presentation inverse (`RPE = 10 - RIR`).
 */
import { ExerciseProfile, type StrengthRole } from '@/models';
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
    // One extra rep of reserve is enough for machine and isolation work; the
    // second extra point is reserved for taxing free-weight compounds.
    maxExtraReserve: profile === ExerciseProfile.COMPOUND_PRIMARY ? 2 : 1,
  };
}

/** Formats a range with an en dash for compact plan summaries. */
export function formatRepRange(range: RepRange): string {
  return `${range.min}–${range.max}`;
}

// --- Strength by role (PRD §3.7) ---------------------------------------------

/**
 * Repetitions by role in a strength plan. Main lifts sit at 3-5 because that is
 * where 1RM transfer is strongest without metabolic failure; accessories at 6-10
 * keep structural volume without heavy joint stress.
 */
export const STRENGTH_ROLE_REPS: Record<StrengthRole, RepRange> = {
  MAIN: { min: 3, max: 5 },
  VARIANT: { min: 3, max: 6 },
  COMPLEMENTARY: { min: 4, max: 6 },
  ACCESSORY: { min: 6, max: 10 },
};

/**
 * Rest by role. Three to five minutes on the main lifts restores phosphocreatine
 * and neuromuscular readiness between near-maximal sets; accessories need 90-120 s.
 */
export function strengthRestSeconds(role: StrengthRole, profile: ExerciseProfile): number {
  if (role === 'MAIN' || role === 'VARIANT') return 240;
  if (role === 'COMPLEMENTARY') return 180;
  return profile === ExerciseProfile.ISOLATION ? 90 : 120;
}

/**
 * RIR across the accumulation microcycles: RPE 7-7.5 (RIR 3) first, rising to RPE
 * 8-9 (RIR 1) in the last one. Routine failure on a main lift is excluded: its
 * systemic recovery cost is out of proportion to what it adds.
 */
export const STRENGTH_RIR_RAMP: Record<StrengthRole, { start: number; end: number }> = {
  MAIN: { start: 3, end: 1 },
  VARIANT: { start: 3, end: 1 },
  COMPLEMENTARY: { start: 3, end: 1 },
  ACCESSORY: { start: 2, end: 1 },
};

/** The heavy single sits at RPE 8: close to the maximum, far from a max attempt. */
export const TOP_SINGLE_RIR = 2;

/** RIR of a role's working sets in accumulation microcycle `index` (0-based). */
export function strengthRIR(role: StrengthRole, index: number, accumulationMicrocycles: number): number {
  const { start, end } = STRENGTH_RIR_RAMP[role];
  if (accumulationMicrocycles <= 1) return start;
  const progress = Math.min(1, Math.max(0, index / (accumulationMicrocycles - 1)));
  return Math.round(start - (start - end) * progress);
}

/** Smallest standard plate step: loads are rounded down to it. */
export const LOAD_INCREMENT_KG = 2.5;

/**
 * Load for `reps` at `rir` from an estimated 1RM, inverting Epley over the reps the
 * set could have reached (`reps + rir`). Rounded DOWN: a prescription that
 * undershoots is corrected by the next set, one that overshoots fails a rep.
 */
export function loadForTarget(e1rm: number, reps: number, rir: number): number {
  const load = e1rm / (1 + (reps + rir) / 30);
  return Math.max(0, Math.floor(load / LOAD_INCREMENT_KG + 1e-9) * LOAD_INCREMENT_KG);
}
