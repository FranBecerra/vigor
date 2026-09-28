/**
 * Strength mesocycle program — PURE LOGIC (PRD §3.7).
 *
 * WHY STRENGTH IS NOT HYPERTROPHY WITH FEWER REPS
 *   The hypertrophy generator chooses exercises by stimulus per set and fills a
 *   volume target per MUSCLE. Measured on an intermediate at 3x75, that gave strength
 *   a front squat once a week, no flat bench, no overhead press, and 24 % of sets on
 *   barbell main lifts. Strength is specific: the lifts being trained are not a
 *   lottery, they are the point. So this module does not draw the main lifts, it
 *   PRESCRIBES them, and draws only variants and accessories.
 *
 * STRUCTURE
 *   - MAIN: back squat, bench press, conventional deadlift. Fixed by id.
 *   - VARIANT: a direct variant that attacks a sticking point (paused squat,
 *     paused bench, deficit or block pull). Drawn by seed, so "another
 *     combination" changes it while the main lifts stay.
 *   - COMPLEMENTARY: overhead press, heavy row, vertical pull.
 *   - ACCESSORY: hinge accessory, anti-movement core, triceps, upper back, plus one
 *     per priority region.
 *   Frequency comes from explicit EXPOSURES: squat and bench 2-3 per microcycle,
 *   deadlift 1-2, complementary lifts 1-2, depending on the session count.
 *
 * THE 60 % RULE
 *   Main lifts and their variants carry at least 60 % of the sets. Everything else
 *   is added in priority order only while that share holds, so an accessory never
 *   dilutes the program it exists to support.
 *
 * FITTING THE TIME
 *   Every exposure is a slot with a priority. The program keeps the longest prefix
 *   of slots, by priority, that the sessions can hold; accessories go first and the
 *   heavy main-lift day last. When not even that fits, the plan says so.
 */
import {
  Equipment,
  ExerciseGenerationTier,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  SplitStructure,
  type Exercise,
  type StrengthRole,
} from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import {
  createRandom,
  goalSelectionScore,
  summarizeSelection,
  weightedPick,
  type SelectedExercise,
} from './exerciseSelection';
import { strengthRestSeconds } from './exercisePrescription';
import type { MesocyclePlan, MesocyclePlanInput } from './mesocyclePlanner';
import { distributeSelection } from './sessionDistribution';
import { SESSION_OVERHEAD_MINUTES, workMinutesAvailable } from './trainingCapacity';
import {
  MAX_SQUEEZE,
  RegionEmphasis,
  TrainingGoal,
  buildVolumePlan,
  type VolumePlan,
} from './volumePlan';

export type StrengthLift =
  | 'SQUAT'
  | 'BENCH'
  | 'DEADLIFT'
  | 'OVERHEAD_PRESS'
  | 'ROW'
  | 'VERTICAL_PULL';

interface LiftSpec {
  lift: StrengthLift;
  exerciseId: string;
  vector: MovementVector;
  variantIds: readonly string[];
}

/** The non-negotiable core: 70-80 % of the neural stimulus of the block. */
export const MAIN_LIFTS: readonly LiftSpec[] = [
  {
    lift: 'SQUAT',
    exerciseId: 'sentadilla-libre',
    vector: MovementVector.KNEE_DOMINANT,
    variantIds: ['sentadilla-pausa', 'sentadilla-frontal'],
  },
  {
    lift: 'BENCH',
    exerciseId: 'press-banca',
    vector: MovementVector.PUSH_HORIZONTAL,
    variantIds: ['press-banca-pausa', 'press-banca-cerrado'],
  },
  {
    lift: 'DEADLIFT',
    // Conventional by default; sumo stays one swap away.
    exerciseId: 'peso-muerto-convencional',
    vector: MovementVector.HIP_DOMINANT,
    variantIds: ['peso-muerto-deficit', 'peso-muerto-bloques'],
  },
];

/**
 * Second heavy movements that keep the main lifts balanced and progressing.
 *
 * The row is chest-supported, not a barbell row: with squat and deadlift already
 * spending the lower back's recovery, a row that the erectors limit trains the
 * erectors a third time and the upper back less. The pad removes that limit, so the
 * load is set by the muscles the row exists for. Without the machine the program
 * falls back to the best available horizontal pull.
 */
export const COMPLEMENTARY_LIFTS: readonly LiftSpec[] = [
  { lift: 'OVERHEAD_PRESS', exerciseId: 'press-militar-barra', vector: MovementVector.PUSH_VERTICAL, variantIds: [] },
  { lift: 'ROW', exerciseId: 'remo-pecho-apoyado', vector: MovementVector.PULL_HORIZONTAL, variantIds: [] },
  { lift: 'VERTICAL_PULL', exerciseId: 'dominadas', vector: MovementVector.PULL_VERTICAL, variantIds: [] },
];

/** Main lifts and variants carry at least this share of the sets. */
export const MIN_MAIN_LIFT_SHARE = 0.6;

/** Sets per exposure by level and role. */
export const STRENGTH_SETS: Record<ExperienceLevel, Record<StrengthRole, number>> = {
  [ExperienceLevel.BEGINNER]: { MAIN: 3, VARIANT: 3, COMPLEMENTARY: 3, ACCESSORY: 3 },
  [ExperienceLevel.INTERMEDIATE]: { MAIN: 4, VARIANT: 4, COMPLEMENTARY: 3, ACCESSORY: 3 },
  [ExperienceLevel.ADVANCED]: { MAIN: 4, VARIANT: 4, COMPLEMENTARY: 4, ACCESSORY: 3 },
};

/** Slot priorities: higher survives longer when time is short. */
export const SLOT_PRIORITY = {
  mainHeavy: 100,
  squatBenchSecond: 90,
  complementaryFirst: 80,
  hingeAccessory: 70,
  core: 65,
  mainThird: 60,
  deadliftVariant: 55,
  complementarySecond: 50,
  priorityAccessory: 45,
  triceps: 44,
  upperBack: 40,
} as const;

export interface StrengthSlot {
  exercise: Exercise;
  role: StrengthRole;
  sets: number;
  topSingle: boolean;
  priority: number;
}

export interface StrengthMainLiftReport {
  lift: StrengthLift;
  exerciseId: string;
  /** true when the prescribed lift was unavailable and another exercise stands in. */
  substituted: boolean;
}

export interface StrengthProgramReport {
  mainLifts: StrengthMainLiftReport[];
  /** No barbell in the available material. The program still runs, with substitutes. */
  missingBarbell: boolean;
  /** Share of sets on main lifts and variants. */
  mainLiftShare: number;
  /** Hard sets per movement pattern, counting main, variant and complementary work. */
  patternSets: Partial<Record<MovementVector, number>>;
}

const isCompound = (exercise: Exercise): boolean => exercise.profile !== ExerciseProfile.ISOLATION;

const strengthScore = (exercise: Exercise): number => goalSelectionScore(exercise, TrainingGoal.STRENGTH);

/** The prescribed exercise, or the best-scoring compound of the same pattern. */
function resolveLift(
  spec: LiftSpec,
  catalogue: readonly Exercise[],
  used: ReadonlySet<string>,
): { exercise: Exercise; substituted: boolean } | null {
  const exact = catalogue.find((exercise) => exercise.id === spec.exerciseId);
  if (exact !== undefined && !used.has(exact.id)) return { exercise: exact, substituted: false };
  const fallback = catalogue
    .filter(
      (exercise) =>
        exercise.movementVector === spec.vector &&
        isCompound(exercise) &&
        exercise.generationTier !== ExerciseGenerationTier.STRENGTH_VARIANT &&
        !used.has(exercise.id),
    )
    .sort((a, b) => strengthScore(b) - strengthScore(a) || a.id.localeCompare(b.id))[0];
  return fallback === undefined ? null : { exercise: fallback, substituted: true };
}

/**
 * Exposure plan by session count. Squat and bench reach frequency 2 with two
 * sessions and 3 with enough of them; the deadlift stays at 1-2 because its
 * systemic cost is the highest of the three.
 */
function mainExposures(lift: StrengthLift, sessions: number): { role: StrengthRole; priority: number }[] {
  const heavy = { role: 'MAIN' as StrengthRole, priority: SLOT_PRIORITY.mainHeavy };
  if (lift === 'DEADLIFT') {
    return sessions >= 4 ? [heavy, { role: 'VARIANT', priority: SLOT_PRIORITY.deadliftVariant }] : [heavy];
  }
  const exposures: { role: StrengthRole; priority: number }[] = [heavy];
  if (sessions >= 2) exposures.push({ role: 'VARIANT', priority: SLOT_PRIORITY.squatBenchSecond });
  const thirdFrom = lift === 'BENCH' ? 4 : 5;
  if (sessions >= thirdFrom) exposures.push({ role: 'MAIN', priority: SLOT_PRIORITY.mainThird });
  return exposures;
}

interface AccessorySpec {
  priority: number;
  matches: (exercise: Exercise) => boolean;
}

/**
 * Hinge accessories: hamstrings and glutes through a long range WITHOUT the
 * systemic cost of a pull from the floor. A sumo deadlift is a main-lift
 * alternative, not an accessory, so the pool is named rather than matched.
 */
export const HINGE_ACCESSORY_IDS: readonly string[] = [
  'peso-muerto-rumano',
  'buenos-dias',
  'peso-muerto-rumano-mancuernas',
  'peso-muerto-piernas-rigidas',
];

/** Weak-link work that keeps the main lifts progressing without breaking joints. */
const ACCESSORIES: readonly AccessorySpec[] = [
  {
    priority: SLOT_PRIORITY.hingeAccessory,
    matches: (exercise) => HINGE_ACCESSORY_IDS.includes(exercise.id),
  },
  {
    // Strength needs a trunk that resists flexion, rotation and extension under
    // load, not one that flexes: anti-movement and loaded carries only.
    priority: SLOT_PRIORITY.core,
    matches: (exercise) =>
      exercise.movementVector === MovementVector.CORE_ANTI_MOVEMENT ||
      exercise.movementVector === MovementVector.LOADED_CARRY,
  },
  {
    priority: SLOT_PRIORITY.triceps,
    matches: (exercise) => exercise.movementVector === MovementVector.ELBOW_EXTENSION,
  },
  {
    priority: SLOT_PRIORITY.upperBack,
    matches: (exercise) => exercise.movementVector === MovementVector.SHOULDER_HORIZONTAL_ABDUCTION,
  },
];

/** Whether the volume plan still wants work for this muscle. */
function muscleIsWanted(plan: VolumePlan, muscle: MuscleGroup): boolean {
  const target = plan.muscles.find((entry) => entry.muscle === muscle);
  return target !== undefined && target.meav > 0 && target.emphasis !== RegionEmphasis.DEPRIORITIZED;
}

export interface StrengthProgramInput {
  level: ExperienceLevel;
  sessions: number;
  catalogue: readonly Exercise[];
  volumePlan: VolumePlan;
  seed: number;
}

/** Every slot the program would like, before the share rule and the time budget. */
export function strengthSlots(input: StrengthProgramInput): {
  slots: StrengthSlot[];
  report: Omit<StrengthProgramReport, 'mainLiftShare' | 'patternSets'>;
  missingPatterns: MovementVector[];
} {
  const random = createRandom(input.seed);
  const sets = STRENGTH_SETS[input.level];
  const topSingles = input.level !== ExperienceLevel.BEGINNER;
  const used = new Set<string>();
  const slots: StrengthSlot[] = [];
  const mainLifts: StrengthMainLiftReport[] = [];
  const missingPatterns: MovementVector[] = [];

  MAIN_LIFTS.forEach((spec) => {
    const resolved = resolveLift(spec, input.catalogue, used);
    if (resolved === null) {
      missingPatterns.push(spec.vector);
      return;
    }
    used.add(resolved.exercise.id);
    mainLifts.push({ lift: spec.lift, exerciseId: resolved.exercise.id, substituted: resolved.substituted });

    // A beginner builds skill on the lift itself, so the second exposure repeats it
    // instead of introducing a variant.
    const variantPool =
      input.level === ExperienceLevel.BEGINNER
        ? []
        : input.catalogue.filter((exercise) => spec.variantIds.includes(exercise.id) && !used.has(exercise.id));
    const variant = weightedPick(variantPool, () => 1, random);
    if (variant !== undefined) used.add(variant.id);

    mainExposures(spec.lift, input.sessions).forEach((exposure, index) => {
      const asVariant = exposure.role === 'VARIANT' && variant !== undefined;
      const role: StrengthRole = asVariant ? 'VARIANT' : 'MAIN';
      slots.push({
        exercise: asVariant ? variant : resolved.exercise,
        role,
        sets: sets[role],
        topSingle: topSingles && index === 0,
        priority: exposure.priority,
      });
    });
  });

  COMPLEMENTARY_LIFTS.forEach((spec) => {
    const resolved = resolveLift(spec, input.catalogue, used);
    if (resolved === null) {
      missingPatterns.push(spec.vector);
      return;
    }
    used.add(resolved.exercise.id);
    mainLifts.push({ lift: spec.lift, exerciseId: resolved.exercise.id, substituted: resolved.substituted });
    const exposures = input.sessions >= 5 ? 2 : 1;
    for (let index = 0; index < exposures; index += 1) {
      slots.push({
        exercise: resolved.exercise,
        role: 'COMPLEMENTARY',
        sets: sets.COMPLEMENTARY,
        topSingle: false,
        priority: index === 0 ? SLOT_PRIORITY.complementaryFirst : SLOT_PRIORITY.complementarySecond,
      });
    }
  });

  const addAccessory = (priority: number, matches: (exercise: Exercise) => boolean): void => {
    const candidates = input.catalogue.filter(
      (exercise) =>
        matches(exercise) &&
        exercise.generationTier !== ExerciseGenerationTier.STRENGTH_VARIANT &&
        !used.has(exercise.id) &&
        muscleIsWanted(input.volumePlan, exercise.primaryMuscle),
    );
    const pick = weightedPick(candidates, strengthScore, random);
    if (pick === undefined) return;
    used.add(pick.id);
    slots.push({ exercise: pick, role: 'ACCESSORY', sets: sets.ACCESSORY, topSingle: false, priority });
  };

  ACCESSORIES.forEach((spec) => addAccessory(spec.priority, spec.matches));

  // A priority region gets one accessory of its own; the main lifts already give
  // every region its baseline, so the emphasis is expressed where it can be.
  input.volumePlan.muscles
    .filter((target) => target.emphasis === RegionEmphasis.PRIORITY && target.meav > 0)
    .forEach((target) =>
      addAccessory(SLOT_PRIORITY.priorityAccessory, (exercise) => exercise.primaryMuscle === target.muscle),
    );

  return {
    slots,
    report: {
      mainLifts,
      missingBarbell: !input.catalogue.some((exercise) => exercise.equipment === Equipment.BARBELL),
    },
    missingPatterns,
  };
}

const isMainWork = (slot: StrengthSlot): boolean => slot.role === 'MAIN' || slot.role === 'VARIANT';

/**
 * The slots kept from `candidates` (already in priority order): every main-lift
 * slot, and each other slot only while main lifts keep `MIN_MAIN_LIFT_SHARE`.
 */
export function applyMainLiftShare(candidates: readonly StrengthSlot[]): StrengthSlot[] {
  const mainSets = candidates.filter(isMainWork).reduce((sum, slot) => sum + slot.sets, 0);
  let total = mainSets;
  return candidates.filter((slot) => {
    if (isMainWork(slot)) return true;
    if (mainSets / (total + slot.sets) < MIN_MAIN_LIFT_SHARE) return false;
    total += slot.sets;
    return true;
  });
}

/** Groups slots into one selected exercise per lift, exposures in slot order. */
export function slotsToSelection(slots: readonly StrengthSlot[]): SelectedExercise[] {
  const byId = new Map<string, SelectedExercise>();
  slots.forEach((slot) => {
    const existing = byId.get(slot.exercise.id);
    const exposure = { sets: slot.sets, topSingle: slot.topSingle };
    if (existing?.strength !== undefined) {
      existing.sets += slot.sets;
      existing.strength.exposures.push(exposure);
      return;
    }
    byId.set(slot.exercise.id, {
      exercise: slot.exercise,
      sets: slot.sets,
      strength: {
        role: slot.role,
        restSeconds: strengthRestSeconds(slot.role, slot.exercise.profile),
        exposures: [exposure],
      },
    });
  });
  return [...byId.values()];
}

function patternSets(selected: readonly SelectedExercise[]): Partial<Record<MovementVector, number>> {
  const totals: Partial<Record<MovementVector, number>> = {};
  selected
    .filter((entry) => entry.strength?.role !== 'ACCESSORY')
    .forEach((entry) => {
      const vector = entry.exercise.movementVector;
      totals[vector] = (totals[vector] ?? 0) + entry.sets;
    });
  return totals;
}

function mainShare(selected: readonly SelectedExercise[]): number {
  const total = selected.reduce((sum, entry) => sum + entry.sets, 0);
  const main = selected
    .filter((entry) => entry.strength?.role === 'MAIN' || entry.strength?.role === 'VARIANT')
    .reduce((sum, entry) => sum + entry.sets, 0);
  return total === 0 ? 0 : main / total;
}

/** Plans a strength mesocycle. Called by `planMesocycle` for the strength goal. */
export function planStrengthMesocycle(input: MesocyclePlanInput): MesocyclePlan {
  const { capacity, catalogue, seed, split = SplitStructure.AUTO, previousSession, ...planInput } = input;
  const uncappedPlan = buildVolumePlan(planInput);
  const availableWorkMinutes = workMinutesAvailable(capacity);
  const availableWorkMinutesPerSession = Math.max(0, capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES);
  const sessions = Math.max(0, Math.floor(capacity.sessionsPerMicrocycle));

  const { slots, report, missingPatterns } = strengthSlots({
    level: planInput.level,
    sessions,
    catalogue,
    volumePlan: uncappedPlan,
    seed,
  });
  // Stable by definition order within a priority, so the result is reproducible.
  const ordered = slots
    .map((slot, position) => ({ slot, position }))
    .sort((a, b) => b.slot.priority - a.slot.priority || a.position - b.position)
    .map(({ slot }) => slot);

  const evaluate = (candidateSlots: readonly StrengthSlot[]) => {
    const selected = slotsToSelection(applyMainLiftShare(candidateSlots));
    const distribution = distributeSelection({
      selection: { selected },
      split,
      sessionsPerMicrocycle: capacity.sessionsPerMicrocycle,
      previousSession,
      maxWorkMinutesPerSession: availableWorkMinutesPerSession,
    });
    const fits =
      distribution.unassigned.length === 0 &&
      distribution.sessions.every((session) => session.estimatedWorkMinutes <= availableWorkMinutesPerSession);
    return { selected, distribution, fits };
  };

  // Greedy by priority: each slot joins only if the sessions can still hold it. A
  // prefix search would drop a small complementary lift together with the variant
  // that did not fit, although the lift alone would have.
  let kept = ordered.filter((slot) => slot.priority >= SLOT_PRIORITY.mainHeavy);
  let result = evaluate(kept);
  let timeDropped = 0;
  if (result.fits) {
    ordered
      .filter((slot) => slot.priority < SLOT_PRIORITY.mainHeavy)
      .forEach((slot) => {
        const candidate = evaluate([...kept, slot]);
        if (candidate.fits) {
          kept = [...kept, slot];
          result = candidate;
        } else {
          timeDropped += 1;
        }
      });
  }

  const limitedBy: MesocyclePlan['limitedBy'] = !result.fits
    ? 'insufficient-time'
    : timeDropped > 0
      ? 'time'
      : 'recovery';
  const plan: VolumePlan = limitedBy === 'recovery' ? uncappedPlan : { ...uncappedPlan, capacityCapped: true };
  const selection = summarizeSelection(result.selected, plan, missingPatterns);
  // Dropped share of the program, on the same 0..MAX_SQUEEZE scale the hypertrophy
  // planner reports, so consumers read one number.
  const squeeze =
    ordered.length === 0 ? 0 : ((ordered.length - kept.length) / ordered.length) * MAX_SQUEEZE;

  // Frequency in a strength plan is set per LIFT by its exposures. The per-muscle
  // frequency-2 target is a hypertrophy heuristic: triceps or core trained once
  // beside three pressing exposures is the design, not a defect.
  const distribution = {
    ...result.distribution,
    structureWarnings: result.distribution.structureWarnings.filter(
      (warning) => warning.kind !== 'single-frequency',
    ),
  };

  return {
    plan,
    uncappedPlan,
    selection,
    distribution,
    limitedBy,
    squeeze,
    estimatedWorkMinutes: result.distribution.totalWorkMinutes,
    availableWorkMinutes,
    maxSessionWorkMinutes: result.distribution.maxSessionWorkMinutes,
    availableWorkMinutesPerSession,
    strength: {
      ...report,
      mainLiftShare: mainShare(result.selected),
      patternSets: patternSets(result.selected),
    },
  };
}
