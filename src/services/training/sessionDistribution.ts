/**
 * Distributes the generator's selection across microcycle sessions — PURE LOGIC.
 *
 * ORDER OF DECISIONS
 *   Volume comes first. `volumePlan` sets each muscle's microcycle target,
 *   `exerciseSelection` decides which exercises cover it, and only then does this
 *   module decide which session performs each set. Session structure is therefore
 *   derived from the work that exists, never the other way round.
 *
 *   The previous implementation inverted that order: it cycled a fixed focus
 *   pattern with a modulo and let eligibility decide the rest. Measured
 *   consequences, both fixed here:
 *     - PUSH_PULL_LEGS over 5 sessions produced PUSH:2 PULL:2 LEGS:1, so every
 *       leg set landed in one session, that session saturated its time budget,
 *       and the capacity search then squeezed the WHOLE plan until the bottleneck
 *       fit: 38 performed sets where UPPER_LOWER reached 84 for the same athlete.
 *     - PUSH_PULL_LEGS_UPPER over 6 sessions produced an EMPTY session.
 *
 * WHY MINUTES ARE THE BALANCING UNIT, NOT SETS
 *   Sessions should carry a similar load, but not a similar set count: a heavy
 *   compound set costs about 3.7 min and an isolation set about 2.7 min. Equalising
 *   MINUTES therefore produces the intended result on its own, with fewer sets on
 *   the demanding days and more on isolation-heavy ones, and no separate rule.
 *
 * SPLITS ARE PREFERENCES, NOT WALLS
 *   A split is a logistical preference. Current evidence does not show a
 *   consistent full-body versus split advantage at equated volume, so focus
 *   membership is a COST rather than a veto: a push session can absorb some leg
 *   work when the alternative is a saturated leg day or an empty push day. The
 *   split still shapes the plan, because the mismatch cost is high enough to
 *   dominate whenever a well-matched session has room.
 */
import {
  ExerciseProfile,
  MuscleGroup,
  SplitStructure,
  type Exercise,
} from '@/models';
import type { SelectedExercise, SelectionResult } from './exerciseSelection';
import { MAX_SETS_PER_EXERCISE_APPEARANCE, exerciseMinutes } from './trainingCapacity';
import { fatigueCost } from './exerciseCatalogue';

/** Session label, used by distribution logic and by the future UI. */
export type SessionFocus = 'FULL_BODY' | 'UPPER' | 'LOWER' | 'PUSH' | 'PULL' | 'LEGS';

/** Exercise and sets performed in one specific session. */
export interface SessionExercise {
  exercise: SelectedExercise['exercise'];
  /** Sets performed in THIS appearance, never more than the appearance cap. */
  sets: number;
}

export interface DistributedSession {
  /** Zero-based position in the microcycle. */
  index: number;
  focus: SessionFocus;
  exercises: SessionExercise[];
  /** Work and rest time, including setup for every exercise appearance. */
  estimatedWorkMinutes: number;
}

export interface SessionDistribution {
  requestedSplit: SplitStructure;
  /** Concrete split chosen by AUTO; otherwise equal to `requestedSplit`. */
  resolvedSplit: Exclude<SplitStructure, SplitStructure.AUTO>;
  sessions: DistributedSession[];
  /** Sets that could not be placed. Only possible with no sessions at all. */
  unassigned: SessionExercise[];
  totalWorkMinutes: number;
  maxSessionWorkMinutes: number;
  minSessionWorkMinutes: number;
  /** Sessions in which each muscle is trained, i.e. its weekly frequency. */
  frequencyByMuscle: Partial<Record<MuscleGroup, number>>;
  /** Adjacent exposures that stay materially overlapping after sequencing. */
  sequencingWarnings: SequencingWarning[];
  /** Structural problems that the chosen split makes unavoidable. */
  structureWarnings: StructureWarning[];
}

/**
 * Descriptive by design, never a volume veto. A manual split can make an overlap
 * unavoidable, and silently deleting prescribed work would hide the trade-off
 * instead of showing it.
 */
export interface SequencingWarning {
  /** `null` refers to the previous completed or planned session given as input. */
  precedingSessionIndex: number | null;
  followingSessionIndex: number;
  risk: number;
  sharedMuscles: MuscleGroup[];
  sharesMovementVector: boolean;
}

export interface StructureWarning {
  kind:
    /** A session ended up with no work. Should never happen; reported if it does. */
    | 'empty-session'
    /** Session load is far from even, and the split leaves no way to even it out. */
    | 'unbalanced-load'
    /**
     * A muscle that is not deprioritised is trained only once. Frequency 2 is the
     * target whenever the session count allows it.
     */
    | 'single-frequency'
    /**
     * A muscle exceeds its productive per-session volume. Only reachable when the
     * split leaves nowhere else to put the work; reported rather than silently cut.
     */
    | 'session-volume-cap';
  sessionIndex?: number;
  muscle?: MuscleGroup;
  detail: string;
}

export interface DistributionInput {
  selection: Pick<SelectionResult, 'selected'>;
  split: SplitStructure;
  sessionsPerMicrocycle: number;
  /**
   * Previous completed or planned session. Lets a caller carry the real prior
   * sequence into the next generated microcycle without inventing calendar days.
   */
  previousSession?: readonly SessionExercise[];
  /**
   * Muscles the athlete deprioritised. They are exempt from the frequency-2
   * target: spreading maintenance volume over two sessions adds sessions of
   * almost no work.
   */
  deprioritizedMuscles?: readonly MuscleGroup[];
  /**
   * Work minutes available in a single session, when the caller knows it.
   *
   * Without it the distributor saturates the one session a focus owns and the
   * capacity search then squeezes the WHOLE plan until that bottleneck fits.
   * Measured on PPL + upper over 4 sessions: the leg day sat at its 54 min cap
   * while the push day held 29, and total volume fell to 32 sets against 43 for
   * upper/lower. Knowing the cap turns that throttle into a focus mismatch, which
   * is the better trade: some leg work on a push day beats halving the plan.
   */
  maxWorkMinutesPerSession?: number;
}

/** A score at or above this is worth surfacing in the UI. */
const SEQUENCING_WARNING_THRESHOLD = 4;

/** Load spread above this fraction of the mean is reported as unbalanced. */
const LOAD_IMBALANCE_THRESHOLD = 0.45;

/**
 * Frequency the generator aims for on muscles that are not deprioritised.
 *
 * No separate rule enforces it, because the appearance cap already does: with at
 * most three sets per appearance, any muscle carrying four or more sets is split
 * across two sessions on its own. Below four sets the only way to reach frequency
 * two would be a 2 + 1 split, and a single-set appearance costs a full setup for
 * almost no stimulus. So this constant only defines when frequency 1 is worth
 * REPORTING, and deprioritised muscles are exempt from that report.
 */
export const TARGET_MUSCLE_FREQUENCY = 2;

/**
 * PER-SESSION VOLUME CAP PER MUSCLE.
 *
 * Within one session the hypertrophy response follows a concave
 * diminishing-returns curve: roughly 1-4 effective sets already capture most of
 * the available stimulus, 6-10 capture practically all of the productive
 * adaptation, and 10-12 is the productive ceiling for a natural athlete. Past
 * that, central fatigue reduces high-threshold motor unit recruitment despite
 * equal perceived effort and disproportionate muscle damage redirects protein
 * synthesis toward repair instead of supercompensation, which extends recovery
 * beyond 72-96 h and wrecks the weekly frequency the plan depends on.
 *
 * So the cap is not a comfort setting: exceeding it costs volume elsewhere in the
 * microcycle. When weekly volume needs more than one session can absorb, the
 * right answer is frequency 2 or 3 (two sessions of 8 rather than one of 16), and
 * that is exactly what the cost function produces by making the overflow
 * expensive enough to push work into another session.
 *
 * INDIRECT WORK COUNTS. Heavy compound pressing already gives the triceps and
 * front delts half a set of stimulus per set performed, which reduces how many
 * DIRECT sets they can still tolerate in the same session. The budget is therefore
 * measured in EFFECTIVE sets (a direct set counts 1, a secondary credit 0.5), so
 * one number expresses both rules.
 */
export const SMALL_MUSCLE_SESSION_CAP = 8;
export const LARGE_MUSCLE_SESSION_CAP = 10;
/**
 * Extra allowance for a large muscle trained through two or more distinct
 * movement patterns in the same session, e.g. a vertical pull plus a horizontal
 * row for the back. Pattern variety is what makes the upper end tolerable.
 */
export const MULTI_PATTERN_ALLOWANCE = 2;
/** Absolute ceiling. Above this the work is junk volume and is never scheduled. */
export const JUNK_VOLUME_SETS = 12;

/**
 * Single-joint or fast-fatiguing muscles. Their productive range per session is
 * lower (about 4-8 direct sets) because they accumulate fatigue quickly and
 * already receive indirect stimulus from every compound in the session.
 */
const SMALL_MUSCLES = new Set<MuscleGroup>([
  MuscleGroup.BICEPS,
  MuscleGroup.TRICEPS,
  MuscleGroup.DELTS_FRONT,
  MuscleGroup.DELTS_LATERAL,
  MuscleGroup.DELTS_REAR,
  MuscleGroup.TRAPS_UPPER,
  MuscleGroup.TRAPS_MID_LOWER,
  MuscleGroup.CALVES,
  MuscleGroup.TIBIALIS,
  MuscleGroup.ADDUCTORS,
  MuscleGroup.ERECTORS,
  MuscleGroup.CORE,
]);

const UPPER_MUSCLES = new Set<MuscleGroup>([
  MuscleGroup.CHEST_UPPER,
  MuscleGroup.CHEST_MID_LOWER,
  MuscleGroup.LATS,
  MuscleGroup.RHOMBOIDS,
  MuscleGroup.DELTS_FRONT,
  MuscleGroup.DELTS_LATERAL,
  MuscleGroup.DELTS_REAR,
  MuscleGroup.TRAPS_UPPER,
  MuscleGroup.TRAPS_MID_LOWER,
  MuscleGroup.BICEPS,
  MuscleGroup.TRICEPS,
]);

const PUSH_MUSCLES = new Set<MuscleGroup>([
  MuscleGroup.CHEST_UPPER,
  MuscleGroup.CHEST_MID_LOWER,
  MuscleGroup.DELTS_FRONT,
  MuscleGroup.DELTS_LATERAL,
  MuscleGroup.TRICEPS,
]);

const PULL_MUSCLES = new Set<MuscleGroup>([
  MuscleGroup.LATS,
  MuscleGroup.RHOMBOIDS,
  MuscleGroup.DELTS_REAR,
  MuscleGroup.TRAPS_UPPER,
  MuscleGroup.TRAPS_MID_LOWER,
  MuscleGroup.BICEPS,
  MuscleGroup.ERECTORS,
]);

/** Whether a focus is the natural home of a muscle. */
function matches(focus: SessionFocus, muscle: MuscleGroup): boolean {
  if (focus === 'FULL_BODY') return true;
  if (focus === 'UPPER') return UPPER_MUSCLES.has(muscle);
  if (focus === 'LOWER' || focus === 'LEGS') return !UPPER_MUSCLES.has(muscle);
  if (focus === 'PUSH') return PUSH_MUSCLES.has(muscle);
  return PULL_MUSCLES.has(muscle);
}

/**
 * Base cycle and the extra focuses each split may use beyond it.
 *
 * These are the structures known to work in practice, not a general theory:
 * upper/lower over 4 sessions, PPL + upper over 4, PPL + upper + lower over 5,
 * PPL twice over 6, full body over 3. Extra sessions are drawn from `extras` in
 * order of the time each focus still has to absorb, so the fifth session of a
 * PPL + upper plan becomes a second leg day exactly when leg volume needs it.
 */
const SPLIT_VOCABULARY: Record<
  Exclude<SplitStructure, SplitStructure.AUTO>,
  { base: readonly SessionFocus[]; extras: readonly SessionFocus[] }
> = {
  [SplitStructure.FULL_BODY]: { base: ['FULL_BODY'], extras: ['FULL_BODY'] },
  [SplitStructure.UPPER_LOWER]: { base: ['UPPER', 'LOWER'], extras: ['UPPER', 'LOWER'] },
  [SplitStructure.PUSH_PULL_LEGS]: {
    base: ['PUSH', 'PULL', 'LEGS'],
    extras: ['LEGS', 'PUSH', 'PULL'],
  },
  [SplitStructure.PUSH_PULL_LEGS_UPPER]: {
    base: ['PUSH', 'PULL', 'LEGS', 'UPPER'],
    extras: ['LOWER', 'PUSH', 'PULL', 'LEGS'],
  },
};

/**
 * Concrete split for AUTO, chosen by session count from the structures above.
 * It makes no claim about optimal frequency: volume is already decided.
 */
function resolveSplit(
  split: SplitStructure,
  sessions: number,
): Exclude<SplitStructure, SplitStructure.AUTO> {
  if (split !== SplitStructure.AUTO) return split;
  if (sessions <= 3) return SplitStructure.FULL_BODY;
  if (sessions === 4) return SplitStructure.UPPER_LOWER;
  if (sessions === 5) return SplitStructure.PUSH_PULL_LEGS_UPPER;
  return SplitStructure.PUSH_PULL_LEGS;
}

function muscleCredits(exercise: Exercise): Map<MuscleGroup, number> {
  const credits = new Map<MuscleGroup, number>([[exercise.primaryMuscle, 1]]);
  exercise.secondaryMuscles.forEach((muscle) => {
    credits.set(muscle, Math.max(credits.get(muscle) ?? 0, 0.5));
  });
  return credits;
}

/**
 * Biomechanical overlap risk between two exercises in adjacent sessions.
 *
 * Fatigue comes from each exercise's AUDITED `systemicFatigueCost` and
 * `stabilityCost`, not from a bucket by profile. The previous version assumed
 * every COMPOUND_PRIMARY was equally draining, which is wrong exactly where it
 * matters: a hack squat and a back squat share that profile, yet the audit scores
 * their systemic fatigue 3 and 1. That gap is the whole reason to keep heavy axial
 * work away from an adjacent session.
 */
function exerciseRisk(current: Exercise, previous: Exercise): number {
  const currentCredits = muscleCredits(current);
  const previousCredits = muscleCredits(previous);
  let sharedCredit = 0;
  currentCredits.forEach((credit, muscle) => {
    sharedCredit += credit * (previousCredits.get(muscle) ?? 0);
  });
  const muscleRisk = sharedCredit * fatigueCost(current) * fatigueCost(previous);
  const vectorRisk = current.movementVector === previous.movementVector ? 3 : 0;
  return muscleRisk + vectorRisk;
}

function entriesRisk(
  current: readonly SessionExercise[],
  previous: readonly SessionExercise[],
): number {
  return current.reduce(
    (sum, currentEntry) =>
      sum +
      previous.reduce(
        (previousSum, previousEntry) =>
          previousSum + exerciseRisk(currentEntry.exercise, previousEntry.exercise),
        0,
      ),
    0,
  );
}

function minutesOf(entries: readonly SessionExercise[]): number {
  return entries.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0);
}

/**
 * Builds the focus sequence from the work that has to be placed.
 *
 * The base cycle runs first so the split is recognisable. Remaining sessions go
 * to whichever focus still carries the most unplaced minutes, which is what
 * prevents one saturated day from throttling the plan. The result is then
 * reordered so the same focus is not adjacent when an alternative exists, which
 * also helps the fatigue-overlap rule.
 */
export function buildFocusSequence(
  split: Exclude<SplitStructure, SplitStructure.AUTO>,
  sessionCount: number,
  minutesByMuscle: ReadonlyMap<MuscleGroup, number>,
): SessionFocus[] {
  const count = Math.max(0, Math.floor(sessionCount));
  if (count === 0) return [];

  const { base, extras } = SPLIT_VOCABULARY[split];
  const sequence: SessionFocus[] = [];
  for (let index = 0; index < Math.min(count, base.length); index += 1) {
    sequence.push(base[index]);
  }

  /**
   * Minutes a focus already carries per session it has been given.
   *
   * Current load, not load after adding one more: dividing by `assigned + 1`
   * measures the state AFTER the decision, which kept handing sessions to the
   * heaviest focus long past the point where it was the most loaded one. With
   * 100 min of leg work and 40 of upper it produced UPPER, LOWER, LOWER, LOWER,
   * LOWER, where the fourth leg session carried 25 min against the upper day's 40.
   */
  const loadPerSession = (focus: SessionFocus): number => {
    let total = 0;
    minutesByMuscle.forEach((minutes, muscle) => {
      if (matches(focus, muscle)) total += minutes;
    });
    const assigned = sequence.filter((candidate) => candidate === focus).length;
    return assigned === 0 ? Number.POSITIVE_INFINITY : total / assigned;
  };

  while (sequence.length < count) {
    const next = extras.reduce((best, candidate) =>
      loadPerSession(candidate) > loadPerSession(best) ? candidate : best,
    );
    sequence.push(next);
  }

  // Spread repeated focuses so the same one is not adjacent while a swap exists.
  for (let index = 1; index < sequence.length; index += 1) {
    if (sequence[index] !== sequence[index - 1]) continue;
    for (let other = index + 1; other < sequence.length; other += 1) {
      const candidate = sequence[other];
      // The incoming focus must not recreate the clash it is meant to break, and
      // the outgoing one must not create a new one where it lands.
      if (candidate === sequence[index - 1]) continue;
      if (other - 1 !== index && sequence[other - 1] === sequence[index]) continue;
      if (sequence[other + 1] === sequence[index]) continue;
      [sequence[index], sequence[other]] = [candidate, sequence[index]];
      break;
    }
  }

  return sequence;
}

/**
 * Sets per appearance for one exercise, spread as evenly as possible.
 *
 * Even on purpose: four sets become 2 + 2 rather than 3 + 1, because a single-set
 * appearance costs a full setup for almost no stimulus. This is also what delivers
 * frequency two without a separate rule, since anything above the cap is split.
 *
 * When the athlete has fewer sessions than the prescription needs appearances,
 * exceeding the cap is unavoidable, and the excess is spread across appearances
 * rather than dumped on the last one.
 */
export function appearanceSets(totalSets: number, eligibleSessions: number): number[] {
  if (totalSets <= 0 || eligibleSessions <= 0) return [];

  const appearances = Math.min(
    eligibleSessions,
    Math.ceil(totalSets / MAX_SETS_PER_EXERCISE_APPEARANCE),
  );
  const base = Math.floor(totalSets / appearances);
  const withOneMore = totalSets % appearances;
  return Array.from({ length: appearances }, (_, index) =>
    index < withOneMore ? base + 1 : base,
  );
}

/** Effective sets a muscle receives in a session: direct 1, secondary 0.5. */
export function effectiveSetsByMuscle(
  entries: readonly SessionExercise[],
): Map<MuscleGroup, number> {
  const totals = new Map<MuscleGroup, number>();
  entries.forEach((entry) => {
    muscleCredits(entry.exercise).forEach((credit, muscle) => {
      totals.set(muscle, (totals.get(muscle) ?? 0) + credit * entry.sets);
    });
  });
  return totals;
}

/**
 * Productive per-session cap for one muscle, given how it is trained in that
 * session. A large muscle earns the multi-pattern allowance only when at least two
 * distinct movement vectors reach it, never past the junk-volume ceiling.
 */
export function sessionSetCap(
  muscle: MuscleGroup,
  entries: readonly SessionExercise[],
): number {
  if (SMALL_MUSCLES.has(muscle)) return SMALL_MUSCLE_SESSION_CAP;
  const vectors = new Set(
    entries
      .filter((entry) => muscleCredits(entry.exercise).has(muscle))
      .map((entry) => entry.exercise.movementVector),
  );
  const allowance = vectors.size >= 2 ? MULTI_PATTERN_ALLOWANCE : 0;
  return Math.min(JUNK_VOLUME_SETS, LARGE_MUSCLE_SESSION_CAP + allowance);
}

/** Cost of placing work outside its natural focus. High enough to shape the split. */
const FOCUS_MISMATCH_COST = 40;
/** Weight of load imbalance, in cost units per minute away from the mean. */
const IMBALANCE_COST_PER_MINUTE = 1.2;
/** Extra cost of repeating the same exercise in a session that already has it. */
const DUPLICATE_EXERCISE_COST = 60;
/**
 * Cost per minute of pushing a session past its time budget. Steep on purpose:
 * overflowing a session throttles the entire plan, so paying a focus mismatch
 * instead is nearly always the better trade.
 */
const OVER_CAP_COST_PER_MINUTE = 25;
/**
 * Cost per effective set above a muscle's per-session cap. Steeper than the focus
 * mismatch on purpose: doing part of the work on a less ideal day beats turning
 * the last sets of a session into junk volume.
 */
const OVER_MUSCLE_CAP_COST_PER_SET = 45;

export function distributeSelection(input: DistributionInput): SessionDistribution {
  const count = Math.max(0, Math.floor(input.sessionsPerMicrocycle));
  const resolvedSplit = resolveSplit(input.split, count);
  const deprioritized = new Set(input.deprioritizedMuscles ?? []);

  // Minutes each muscle's work needs, which is what drives the structure.
  const minutesByMuscle = new Map<MuscleGroup, number>();
  input.selection.selected.forEach((selected) => {
    const muscle = selected.exercise.primaryMuscle;
    const minutes = exerciseMinutes(selected.exercise, selected.sets);
    minutesByMuscle.set(muscle, (minutesByMuscle.get(muscle) ?? 0) + minutes);
  });

  const sessions: DistributedSession[] = buildFocusSequence(
    resolvedSplit,
    count,
    minutesByMuscle,
  ).map((focus, index) => ({ index, focus, exercises: [], estimatedWorkMinutes: 0 }));

  const unassigned: SessionExercise[] = [];
  if (sessions.length === 0) {
    input.selection.selected.forEach((selected) =>
      unassigned.push({ exercise: selected.exercise, sets: selected.sets }),
    );
  }

  const totalMinutes = [...minutesByMuscle.values()].reduce((sum, value) => sum + value, 0);
  const meanMinutes = sessions.length > 0 ? totalMinutes / sessions.length : 0;

  // Heaviest exercises first: the hard choices are made while every session is
  // still open, instead of leaving compounds to fill whatever gap remains.
  const ordered = [...input.selection.selected].sort(
    (a, b) =>
      exerciseMinutes(b.exercise, b.sets) - exerciseMinutes(a.exercise, a.sets) ||
      a.exercise.id.localeCompare(b.exercise.id),
  );

  for (const selected of ordered) {
    if (sessions.length === 0) break;
    const naturalSessions = sessions.filter((session) =>
      matches(session.focus, selected.exercise.primaryMuscle),
    );
    const chunks = appearanceSets(
      selected.sets,
      Math.max(1, naturalSessions.length > 0 ? naturalSessions.length : sessions.length),
    );

    for (const sets of chunks) {
      const target = sessions.reduce((best, candidate) => {
        const cost = (session: DistributedSession): number => {
          const prior =
            session.index === 0 ? input.previousSession : sessions[session.index - 1]?.exercises;
          const following = sessions[session.index + 1]?.exercises;
          const neighbourRisk = [prior, following].reduce(
            (sum, entries) =>
              sum +
              (entries?.reduce(
                (inner, entry) => inner + exerciseRisk(selected.exercise, entry.exercise),
                0,
              ) ?? 0),
            0,
          );
          const projected = session.estimatedWorkMinutes + exerciseMinutes(selected.exercise, sets);
          const imbalance = Math.max(0, projected - meanMinutes) * IMBALANCE_COST_PER_MINUTE;
          const overCap =
            input.maxWorkMinutesPerSession === undefined
              ? 0
              : Math.max(0, projected - input.maxWorkMinutesPerSession) * OVER_CAP_COST_PER_MINUTE;
          const mismatch = matches(session.focus, selected.exercise.primaryMuscle)
            ? 0
            : FOCUS_MISMATCH_COST;
          const duplicate = session.exercises.some(
            (entry) => entry.exercise.id === selected.exercise.id,
          )
            ? DUPLICATE_EXERCISE_COST
            : 0;

          // Per-muscle session volume, counting the indirect credit this exercise
          // also adds to its synergists.
          const projectedEntries = [...session.exercises, { exercise: selected.exercise, sets }];
          const projectedSets = effectiveSetsByMuscle(projectedEntries);
          let overMuscleCap = 0;
          projectedSets.forEach((effective, muscle) => {
            const cap = sessionSetCap(muscle, projectedEntries);
            overMuscleCap += Math.max(0, effective - cap) * OVER_MUSCLE_CAP_COST_PER_SET;
          });

          return neighbourRisk + imbalance + overCap + mismatch + duplicate + overMuscleCap;
        };
        return cost(candidate) < cost(best) ? candidate : best;
      });

      target.exercises.push({ exercise: selected.exercise, sets });
      target.estimatedWorkMinutes = minutesOf(target.exercises);
    }
  }

  // An empty session is a visible defect, so it is repaired deterministically
  // rather than left to the cost function: move one appearance out of the
  // heaviest session that can spare it. Only genuinely impossible when there are
  // fewer appearances than sessions, which is then reported.
  for (const empty of sessions.filter((session) => session.exercises.length === 0)) {
    const donor = sessions
      .filter((session) => session.exercises.length > 1)
      .sort((a, b) => b.estimatedWorkMinutes - a.estimatedWorkMinutes)[0];
    if (donor === undefined) break;
    // The least fatiguing appearance moves. No focus-matching preference here on
    // purpose: this repair only runs when the cost function already left a session
    // empty, which happens when nothing matches that focus or when there are fewer
    // appearances than sessions, so a preference would never actually apply.
    const moved = donor.exercises.reduce((best, entry) =>
      exerciseRisk(entry.exercise, entry.exercise) < exerciseRisk(best.exercise, best.exercise)
        ? entry
        : best,
    );
    donor.exercises.splice(donor.exercises.indexOf(moved), 1);
    donor.estimatedWorkMinutes = minutesOf(donor.exercises);
    empty.exercises.push(moved);
    empty.estimatedWorkMinutes = minutesOf(empty.exercises);
  }

  const frequencyByMuscle: Partial<Record<MuscleGroup, number>> = {};
  sessions.forEach((session) => {
    const trained = new Set<MuscleGroup>();
    session.exercises.forEach((entry) => trained.add(entry.exercise.primaryMuscle));
    trained.forEach((muscle) => {
      frequencyByMuscle[muscle] = (frequencyByMuscle[muscle] ?? 0) + 1;
    });
  });

  const sequencingWarnings = sessions
    .map((session, index) => {
      const preceding =
        index === 0 ? (input.previousSession ?? []) : sessions[index - 1].exercises;
      const risk = entriesRisk(session.exercises, preceding);
      if (risk < SEQUENCING_WARNING_THRESHOLD) return undefined;
      const precedingMuscles = new Set(
        preceding.flatMap((entry) => [...muscleCredits(entry.exercise).keys()]),
      );
      const followingMuscles = new Set(
        session.exercises.flatMap((entry) => [...muscleCredits(entry.exercise).keys()]),
      );
      return {
        precedingSessionIndex: index === 0 ? null : index - 1,
        followingSessionIndex: index,
        risk,
        sharedMuscles: [...followingMuscles].filter((muscle) => precedingMuscles.has(muscle)),
        sharesMovementVector: session.exercises.some((current) =>
          preceding.some(
            (previous) => current.exercise.movementVector === previous.exercise.movementVector,
          ),
        ),
      } satisfies SequencingWarning;
    })
    .filter((warning): warning is SequencingWarning => warning !== undefined);

  const loads = sessions.map((session) => session.estimatedWorkMinutes);
  const maxSessionWorkMinutes = loads.reduce((maximum, value) => Math.max(maximum, value), 0);
  const minSessionWorkMinutes = loads.reduce(
    (minimum, value) => Math.min(minimum, value),
    loads.length > 0 ? loads[0] : 0,
  );

  const structureWarnings: StructureWarning[] = [];
  sessions.forEach((session) => {
    if (session.exercises.length === 0) {
      structureWarnings.push({
        kind: 'empty-session',
        sessionIndex: session.index,
        detail: `Session ${session.index} (${session.focus}) has no work assigned.`,
      });
    }
  });
  if (meanMinutes > 0 && maxSessionWorkMinutes - minSessionWorkMinutes > meanMinutes * LOAD_IMBALANCE_THRESHOLD) {
    structureWarnings.push({
      kind: 'unbalanced-load',
      detail:
        `Session load ranges from ${Math.round(minSessionWorkMinutes)} to ` +
        `${Math.round(maxSessionWorkMinutes)} min around a ${Math.round(meanMinutes)} min mean.`,
    });
  }
  sessions.forEach((session) => {
    effectiveSetsByMuscle(session.exercises).forEach((effective, muscle) => {
      const cap = sessionSetCap(muscle, session.exercises);
      if (effective > cap) {
        structureWarnings.push({
          kind: 'session-volume-cap',
          sessionIndex: session.index,
          muscle,
          detail:
            `${muscle} receives ${effective} effective sets in session ${session.index}, ` +
            `above its productive ${cap}-set ceiling for one session.`,
        });
      }
    });
  });

  if (sessions.length >= TARGET_MUSCLE_FREQUENCY) {
    (Object.entries(frequencyByMuscle) as [MuscleGroup, number][]).forEach(
      ([muscle, frequency]) => {
        if (frequency < TARGET_MUSCLE_FREQUENCY && !deprioritized.has(muscle)) {
          structureWarnings.push({
            kind: 'single-frequency',
            muscle,
            detail: `${muscle} is trained in only ${frequency} session.`,
          });
        }
      },
    );
  }

  return {
    requestedSplit: input.split,
    resolvedSplit,
    sessions,
    unassigned,
    totalWorkMinutes: loads.reduce((sum, value) => sum + value, 0),
    maxSessionWorkMinutes,
    minSessionWorkMinutes,
    frequencyByMuscle,
    sequencingWarnings,
    structureWarnings,
  };
}
