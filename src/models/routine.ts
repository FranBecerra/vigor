/**
 * Routine: the reusable template a mesocycle is instantiated FROM, and the
 * planned work a mesocycle prescribes (PRD §3.6).
 *
 * WHY A SEPARATE TEMPLATE
 *   §3 settled that a routine IS a mesocycle as far as the athlete sees it: the
 *   plan and its structure are the same thing. But a mesocycle ends, and the next
 *   one normally starts from the same intent: same split, same session count, same
 *   priorities, same vetoes. `Routine` holds that intent plus the identity the
 *   athlete recognises (name, icon, accent), and a `Mesocycle` is one execution of
 *   it. Regenerating a block therefore does not mean re-answering the setup.
 *
 * PLANNED VERSUS EXECUTED
 *   `WorkoutSession` already models an EXECUTED session: it carries `performedAt`
 *   and sets with actual reps and weight. The generator produces something
 *   different, a PRESCRIPTION, and the model had no place for it. That gap is why
 *   the whole engine was unreachable from the app. `PlannedSession` fills it.
 *
 *   The prescription lives on the MESOCYCLE, not on each microcycle, and that
 *   follows from the static-volume decision in §3: every microcycle of a mesocycle
 *   performs the same exercises and the same sets, varying only in intensity, which
 *   `deriveSetRIRs` computes. The deload microcycle is the one exception and is
 *   derived with `deloadVolumePlan` rather than stored twice.
 */
import type { Timestampish } from './common';
import type { Equipment } from './biomechanics';
import type { SetType } from './training';

export type TrainingCalendarEntry =
  | { kind: 'workout'; date: string; microcycleIndex: number; sessionIndex: number }
  | { kind: 'rest'; date: string; microcycleIndex: number; checked: boolean };

export type ScheduleSlot = { kind: 'workout'; sessionIndex: number } | { kind: 'rest' };
export interface ScheduleTemplate { days: number; slots: ScheduleSlot[] }

/**
 * Icon catalogue for a routine. A closed set of own SVGs: no icon library and no
 * emoji (PRD §8). The KEY is what gets persisted, never the drawing, so it lives
 * in the model and the component renders from it.
 */
export type RoutineIconKey =
  | 'dumbbell'
  | 'barbell'
  | 'kettlebell'
  | 'bodyweight'
  | 'run'
  | 'bike'
  | 'stopwatch'
  | 'mountain';

/** Presentation order in the icon picker when creating or editing a routine. */
export const ROUTINE_ICON_ORDER: readonly RoutineIconKey[] = [
  'dumbbell',
  'barbell',
  'kettlebell',
  'bodyweight',
  'run',
  'bike',
  'stopwatch',
  'mountain',
];

/**
 * Everything the generator needs to produce a mesocycle, stored so the next block
 * can be generated without asking again.
 *
 * `seed` is stored on purpose. It is what makes a generated plan reproducible: the
 * athlete can reroll until they like the exercise selection, and the seed that
 * produced the one they kept is part of the routine. Without it, reopening a
 * routine could not show the plan it actually produced.
 */
export interface RoutineGenerationInput {
  /** `TrainingGoal` from the volume plan. Kept as a string to avoid a service import. */
  goal: string;
  /** `ExperienceLevel` at the time of generation. */
  experienceLevel: string;
  /** `SplitStructure` the athlete chose, possibly AUTO. */
  split: string;
  sessionsPerMicrocycle: number;
  minutesPerSession: number;
  availableEquipment: Equipment[];
  /**
   * `VolumeRegion` values, not muscles.
   *
   * The athlete picks regions, because the slot budget and the volume budget are
   * both defined over regions (§3.3): lat volume cannot rise without back volume
   * rising. Storing muscles here would mean converting down and back up, and the
   * round trip would lose which region was actually chosen.
   */
  priorityRegions: string[];
  deprioritizedRegions: string[];
  vetoedExerciseIds: string[];
  /** `VolumeRegion` values the athlete trains. Omitted means the defaults. */
  trainedRegions?: string[];
  /** Volume the athlete declared doing per region, which overrides the estimate. */
  declaredVolume?: Record<string, number>;
  seed: number;
}

export interface Routine {
  id: string;
  userId: string;
  name: string;
  /** Icon catalogue key. */
  icon: RoutineIconKey;
  /** Accent colour as a palette hex. Validated where it is picked, not here. */
  accentColor: string;
  generation: RoutineGenerationInput;
  /** Id of the mesocycle currently running from this routine, when there is one. */
  activeMesocycleId?: string;
  /**
   * The one routine the athlete is following. At most one per athlete: activating a
   * routine clears the flag on every other. Absent on routines saved before the
   * flag existed, which therefore start inactive.
   */
  isActive?: boolean;
  createdAt: Timestampish;
  updatedAt: Timestampish;
}

/**
 * Role an exercise plays in a strength plan (PRD §3.7).
 *  - MAIN: squat, bench press, deadlift. Fixed, never drawn.
 *  - VARIANT: a direct variant of a main lift that attacks a sticking point.
 *  - COMPLEMENTARY: overhead press, heavy row, vertical pull.
 *  - ACCESSORY: weak-link and injury-prevention work.
 */
export type StrengthRole = 'MAIN' | 'VARIANT' | 'COMPLEMENTARY' | 'ACCESSORY';

/**
 * One prescribed set.
 *
 * Reps and RIR are TARGETS. What the athlete actually did is a `WorkoutSet` on the
 * executed session, and keeping the two apart is what lets adherence be measured
 * instead of guessed.
 *
 * `targetWeightKg` is absent on a first mesocycle: there is no load history to
 * project from, so the first session is where the athlete establishes it.
 */
export interface PlannedSet {
  setType: SetType;
  /** Lower bound of the prescribed repetition range; absent on legacy plans. */
  targetRepsMin?: number;
  /** Upper bound of the prescribed range and legacy single-target fallback. */
  targetReps: number;
  /** Reps in reserve, derived per set by `deriveSetRIRs` from the exercise target. */
  targetRIR: number;
  targetWeightKg?: number;
}

export interface PlannedExercise {
  /** Catalogue id, or a custom exercise id owned by the athlete. */
  exerciseId: string;
  /** Order within the session. */
  order: number;
  sets: PlannedSet[];
  /**
   * Prescribed rest between sets. Absent on plans where rest follows the exercise
   * profile (hypertrophy); a strength plan stores it because the same squat rests
   * 4 min as a main lift and 2 min as an accessory.
   */
  restSeconds?: number;
  /** Role in a strength plan. Absent on hypertrophy plans. */
  strengthRole?: StrengthRole;
  /** Set indices whose RIR the athlete explicitly fixed for remaining microcycles. */
  manualRIRBySet?: Record<number, number>;
  /**
   * true when the athlete changed this exercise by hand after generation.
   *
   * Regeneration must not silently discard a manual edit: an athlete who swapped
   * an exercise because a machine is always busy should not find it back next
   * block. This flag is what lets the generator respect that.
   */
  isEdited: boolean;
}

/** Session focus label, mirroring the distributor's own vocabulary. */
export type PlannedSessionFocus =
  | 'FULL_BODY'
  | 'UPPER'
  | 'LOWER'
  | 'PUSH'
  | 'PULL'
  | 'LEGS';

/**
 * One prescribed session, repeated in every microcycle of the mesocycle.
 *
 * `index` is its position in the microcycle, not a weekday. Optional schedule
 * templates and calendar assignments are separate from workout progression (§3.1).
 */
export interface PlannedSession {
  index: number;
  focus: PlannedSessionFocus;
  exercises: PlannedExercise[];
  /** Estimated work minutes, shown as an estimate and never as a promise. */
  estimatedWorkMinutes: number;
}
