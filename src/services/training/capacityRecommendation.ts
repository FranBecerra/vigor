/**
 * Capacity recommendation: the app decides how many sessions and how long.
 *
 * SCIENTIFIC BOUNDARY
 * Legacy "recoverable volume" labels below mean the model's estimated starting
 * budget, not measured individual recovery, MEV/MRV or proof that extra training
 * cannot produce adaptation. Qualification/ranking are product heuristics.
 * Production preserves exhaustive ranking while pruning impossible qualifications
 * and reusing partial samples for the best-available fallback.
 *
 * WHY THIS EXISTS
 *   A beginner who believes more is better sets 5 or 6 sessions, and the generator
 *   obediently spreads a beginner's recoverable volume over six days, producing thin
 *   sessions with a worse structure than three honest ones. The volume ceiling is set
 *   by what the athlete RECOVERS from, not by the time they are willing to spend, so
 *   past that ceiling extra sessions add commitment and no adaptation.
 *
 * HOW IT DECIDES
 *   It runs the real generator across a grid of capacities and reads its verdicts,
 *   rather than modelling the engine a second time in a way that could disagree with
 *   it. A candidate qualifies when `limitedBy` is `recovery`: the plan reached the
 *   recoverable volume and lost nothing to the clock. Every qualifying candidate
 *   therefore prescribes the SAME number of sets, which is what makes the choice
 *   purely about structure and time.
 *
 *   Ranking, in order:
 *     1. a structure within `STRUCTURE_TOLERANCE` warnings of the best available is
 *        treated as equally sound. Minimising warnings outright is wrong here: more
 *        sessions almost always shave one off, so it recommended six days, which is
 *        the belief this feature exists to correct. A floor, not a maximum.
 *     2. fewest total weekly minutes — the smallest commitment that still works, and
 *        the headline the athlete needs to hear.
 *     3. fewest sessions, to break a remaining tie.
 *
 *   `single-frequency` warnings never reach zero, and that is correct rather than a
 *   defect: a muscle whose weekly volume is three sets belongs in one session. It is
 *   why the ranking compares warning counts against the best ACHIEVABLE count instead
 *   of against zero.
 *
 *   HOW A CANDIDATE QUALIFIES
 *     `limitedBy === 'recovery'` on its own is not enough, and measuring showed why: a
 *     catalogue of one exercise also reports `recovery`, because the label says which
 *     ceiling BOUND the plan, not that the plan reached the athlete's recoverable
 *     volume. A bodyweight-only advanced plan of 37 sets would have been presented as
 *     "this is what you can recover from". So a candidate must ALSO deliver at least
 *     the level and goal's minimum recoverable volume, which is an absolute reading.
 *     When nothing does, the equipment is the binding constraint and the screen says
 *     so instead of dressing up a thin plan as the right answer.
 *
 *
 * WHY SEVERAL SEEDS AND NOT THE ATHLETE'S OWN
 *   Measured with a single seed, this recommendation was NOT stable: the same
 *   intermediate got 6x60, 5x60 or 4x75 depending on the draw, because the warning
 *   count moves by one or two with which exercises came out and that was enough to
 *   change the winner. Advice that flips with a dice roll is not advice. Each capacity
 *   is therefore scored across a fixed sample of seeds and ranked on the mean, which
 *   also matches what the answer is ABOUT: the capacity, not one selection.
 *
 * WHY SESSIONS ARE CAPPED AT 75 MINUTES
 *   Minimising total weekly minutes alone prefers fewer, longer sessions, because the
 *   warm-up overhead is paid once per session: it would recommend two 90-minute days.
 *   A recommendation has to be something a person will actually do, and the engine's
 *   own per-muscle caps mean the extra minutes in an overlong session go to less
 *   productive work anyway. The athlete can still set 90 or 120 by hand.
 */
import type { Exercise, ExperienceLevel, SplitStructure } from '@/models';
import { planMesocycle } from './mesocyclePlanner';
import { TOTAL_SETS_RANGE, type TrainingGoal, type VolumeRegion } from './volumePlan';
import { MINUTES_PER_WORKING_SET_FLOOR, SESSION_OVERHEAD_MINUTES } from './trainingCapacity';

/** Session counts considered. Below two there is no frequency to speak of. */
export const RECOMMENDED_SESSION_COUNTS: readonly number[] = [2, 3, 4, 5, 6];

/** Session lengths considered, warm-up included. See the 75-minute note above. */
export const RECOMMENDED_SESSION_MINUTES: readonly number[] = [45, 60, 75];

/**
 * Seeds each capacity is scored across. Fixed, so the recommendation is a function of
 * the athlete's inputs alone and gives the same answer twice.
 */
export const RECOMMENDATION_SEEDS: readonly number[] = [11, 22, 33];

/**
 * How many warnings above the best achievable count still counts as an equally sound
 * structure. One, because that is the size of the sampling wobble: a tighter band
 * would make the advice depend on the draw again, and a wider one would buy a longer
 * commitment for a structure that is not actually better.
 */
export const STRUCTURE_TOLERANCE = 1;

export interface CapacityRecommendationInput {
  level: ExperienceLevel;
  goal: TrainingGoal;
  /** Catalogue ALREADY filtered by the athlete's equipment and vetoes. */
  catalogue: readonly Exercise[];
  /** Structure the athlete chose. AUTO lets each candidate resolve its own. */
  split?: SplitStructure;
  priorityRegions?: readonly VolumeRegion[];
  deprioritizedRegions?: readonly VolumeRegion[];
}

export interface CapacityRecommendation {
  sessionsPerMicrocycle: number;
  minutesPerSession: number;
  /** Total commitment per microcycle, which is what the athlete actually spends. */
  weeklyMinutes: number;
  /** Sets the recommended capacity prescribes, rounded from the sampled plans. */
  sets: number;
  /**
   * false when no candidate reached the recoverable volume: the athlete's level needs
   * more time than the considered bounds allow, and this is the best available rather
   * than the right answer. Saying so is the point; silently recommending a truncated
   * plan would be the same mistake the feature exists to prevent.
   */
  reachesRecoverableVolume: boolean;
}

interface ScoredCapacity extends CapacityRecommendation {
  meanStructureWarnings: number;
  hasEmptySession: boolean;
}

interface CapacitySample { sets: number; reaches: boolean; structureWarnings: number; empty: boolean }
function sample(input: CapacityRecommendationInput, sessionsPerMicrocycle: number, minutesPerSession: number, seed: number): CapacitySample {
  const plan = planMesocycle({ ...input, seed, capacity: { sessionsPerMicrocycle, minutesPerSession } });
  return {
    sets: plan.distribution.sessions.reduce((total, session) => total + session.exercises.reduce((sum, entry) => sum + entry.sets, 0), 0),
    reaches: plan.limitedBy === 'recovery', structureWarnings: plan.distribution.structureWarnings.length,
    empty: plan.distribution.sessions.some((session) => session.exercises.length === 0),
  };
}

function score(
  input: CapacityRecommendationInput,
  sessionsPerMicrocycle: number,
  minutesPerSession: number,
): ScoredCapacity {
  return scored(input, sessionsPerMicrocycle, minutesPerSession,
    RECOMMENDATION_SEEDS.map((seed) => sample(input, sessionsPerMicrocycle, minutesPerSession, seed)));
}
function scored(input: CapacityRecommendationInput, sessionsPerMicrocycle: number, minutesPerSession: number,
  samples: readonly CapacitySample[]): ScoredCapacity {
  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const sets = Math.round(mean(samples.map((sample) => sample.sets)));
  const [minimumRecoverableSets] = TOTAL_SETS_RANGE[input.goal][input.level];

  return {
    sessionsPerMicrocycle,
    minutesPerSession,
    weeklyMinutes: sessionsPerMicrocycle * minutesPerSession,
    sets,
    // Every sample must reach it: a capacity that only sometimes fits is not a
    // capacity the athlete can rely on.
    reachesRecoverableVolume:
      samples.every((sample) => sample.reaches) && sets >= minimumRecoverableSets,
    meanStructureWarnings: mean(samples.map((sample) => sample.structureWarnings)),
    hasEmptySession: samples.some((sample) => sample.empty),
  };
}

/** Exhaustive reference, retained for paired verification and the fallback contract. */
export function recommendCapacityExhaustive(
  input: CapacityRecommendationInput,
): CapacityRecommendation {
  const candidates = RECOMMENDED_SESSION_COUNTS.flatMap((sessions) =>
    RECOMMENDED_SESSION_MINUTES.map((minutes) => score(input, sessions, minutes)),
  );

  return choose(candidates);
}
function choose(candidates: readonly ScoredCapacity[]): CapacityRecommendation {
  const qualifying = candidates.filter(
    (candidate) => candidate.reachesRecoverableVolume && !candidate.hasEmptySession,
  );
  let ranked: ScoredCapacity[];
  if (qualifying.length > 0) {
    const soundest = Math.min(
      ...qualifying.map((candidate) => candidate.meanStructureWarnings),
    );
    ranked = qualifying
      .filter(
        (candidate) =>
          candidate.meanStructureWarnings <= soundest + STRUCTURE_TOLERANCE,
      )
      .sort(
        (a, b) =>
          a.weeklyMinutes - b.weeklyMinutes ||
          a.sessionsPerMicrocycle - b.sessionsPerMicrocycle,
      );
  } else {
    // Nothing reaches the ceiling: take the most volume, then the least time, and let
    // `reachesRecoverableVolume` tell the screen to say so.
    ranked = [...candidates].sort(
      (a, b) =>
        b.sets - a.sets ||
        a.weeklyMinutes - b.weeklyMinutes ||
        a.sessionsPerMicrocycle - b.sessionsPerMicrocycle,
    );
  }

  const {
    meanStructureWarnings: _meanStructureWarnings,
    hasEmptySession: _hasEmptySession,
    ...best
  } = ranked[0]!;
  return best;
}

/** Yield between real plans; prune only configurations that cannot qualify. */
function* recommendationSearch(input: CapacityRecommendationInput): Generator<void, CapacityRecommendation> {
  const records = RECOMMENDED_SESSION_COUNTS.flatMap((sessions) => RECOMMENDED_SESSION_MINUTES
    .map((minutes) => ({ sessions, minutes, samples: [] as CapacitySample[] })));
  const qualified: ScoredCapacity[] = [];
  const [minimum] = TOTAL_SETS_RANGE[input.goal][input.level];
  for (const record of records) {
    const optimisticSets = Math.floor(Math.max(0, record.minutes - SESSION_OVERHEAD_MINUTES)
      / MINUTES_PER_WORKING_SET_FLOOR) * record.sessions;
    if (optimisticSets < minimum) continue;
    for (const seed of RECOMMENDATION_SEEDS) {
      yield;
      const result = sample(input, record.sessions, record.minutes, seed);
      record.samples.push(result);
      if (!result.reaches || result.empty) break;
    }
    if (record.samples.length === RECOMMENDATION_SEEDS.length) {
      const candidate = scored(input, record.sessions, record.minutes, record.samples);
      if (candidate.reachesRecoverableVolume && !candidate.hasEmptySession) qualified.push(candidate);
    }
  }
  if (qualified.length) return choose(qualified);
  // No qualifying plan: preserve the original complete best-available ranking.
  // Previously computed samples are reused, including failed first samples.
  for (const record of records) while (record.samples.length < RECOMMENDATION_SEEDS.length) {
    yield;
    record.samples.push(sample(input, record.sessions, record.minutes, RECOMMENDATION_SEEDS[record.samples.length]));
  }
  return choose(records.map((record) => scored(input, record.sessions, record.minutes, record.samples)));
}
export function recommendCapacity(input: CapacityRecommendationInput): CapacityRecommendation {
  const search = recommendationSearch(input);
  let step = search.next();
  while (!step.done) step = search.next();
  return step.value;
}
export interface RecommendationScheduling {
  /** Cooperative scheduling, not a background thread. */
  yieldToUI?: () => Promise<void>;
  isCancelled?: () => boolean;
}
export class CapacityRecommendationCancelled extends Error {
  constructor() { super('Capacity recommendation cancelled'); this.name = 'CapacityRecommendationCancelled'; }
}
export async function recommendCapacityAsync(input: CapacityRecommendationInput,
  options: RecommendationScheduling = {}): Promise<CapacityRecommendation> {
  const pause = options.yieldToUI ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const check = () => { if (options.isCancelled?.()) throw new CapacityRecommendationCancelled(); };
  check();
  const search = recommendationSearch(input);
  let step = search.next();
  while (!step.done) {
    await pause();
    check();
    step = search.next();
  }
  check();
  return step.value;
}
