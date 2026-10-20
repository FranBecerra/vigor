/**
 * Recommend a practical calendar for a provisional fixed muscle-volume budget.
 * Hypertrophy selects three fixed dose samples once and evaluates placement,
 * realistic duration, concentration and balance without squeezing that budget.
 * This is a scheduling estimate, not a generated routine, measured recovery,
 * individual MEV/MRV, or a claim of injury prevention. Full generation remains
 * responsible for the final roster, prescriptions and feasibility diagnostics.
 * Strength keeps the validated lift-specific legacy search for now.
 */
import { SplitStructure, type Exercise, type ExperienceLevel } from '@/models';
import { planMesocycle } from './mesocyclePlanner';
import { TOTAL_SETS_RANGE, TrainingGoal, RegionEmphasis, buildVolumePlan, type VolumeRegion, type VolumePlanInput } from './volumePlan';
import { selectExercises, SECONDARY_CREDIT } from './exerciseSelection';
import { distributeSelection, type SessionDistribution } from './sessionDistribution';
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

export interface CapacityRecommendationInput extends VolumePlanInput {
  level: ExperienceLevel;
  goal: TrainingGoal;
  /** Catalogue ALREADY filtered by the athlete's equipment and vetoes. */
  catalogue: readonly Exercise[];
  /** Structure the athlete chose. AUTO lets each candidate resolve its own. */
  split?: SplitStructure;
  priorityRegions?: readonly VolumeRegion[];
  deprioritizedRegions?: readonly VolumeRegion[];
  /** Paired diagnostic control only; not a user-facing setting. */
  capacityPacking?: boolean;
}

export interface CapacityRecommendation {
  sessionsPerMicrocycle: number;
  minutesPerSession: number;
  /** Total commitment per microcycle, which is what the athlete actually spends. */
  weeklyMinutes: number;
  /** Estimated performed sets from fixed-dose samples; final generation may differ. */
  sets: number;
  /**
   * Legacy compatibility name. True only when the fixed dose samples cover all
   * muscle targets within one-set rounding tolerance and fit the recommended
   * calendar. False can mean catalogue/selector shortfall or schedule limits;
   * it is never a measurement of individual recovery or a final-plan guarantee.
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
function* legacyRecommendationSearch(input: CapacityRecommendationInput): Generator<void, CapacityRecommendation> {
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

/** Soft planning preference, not an injury threshold or a physiological set cap. */
export const SESSION_MUSCLE_DISTRIBUTION_REFERENCE = 10;

/** Fractional muscle dose uses the same full-primary/half-secondary convention. */
export function concentrationCost(distribution: Pick<SessionDistribution, 'sessions'>): number {
  return distribution.sessions.reduce((cost, session) => {
    const dose = new Map<string, number>();
    for (const { exercise, sets } of session.exercises) {
      dose.set(exercise.primaryMuscle, (dose.get(exercise.primaryMuscle) ?? 0) + sets);
      for (const muscle of new Set(exercise.secondaryMuscles)) {
        if (muscle !== exercise.primaryMuscle) dose.set(muscle, (dose.get(muscle) ?? 0) + sets * SECONDARY_CREDIT);
      }
    }
    return cost + [...dose.values()].reduce((sum, sets) =>
      sum + Math.max(0, sets - SESSION_MUSCLE_DISTRIBUTION_REFERENCE), 0);
  }, 0);
}

/**
 * Hypertrophy: establish the unsqueezed muscle targets once, then arrange fixed
 * dose samples. No capacity changes the targets or triggers a full plan search.
 * Strength retains its lift-specific reference until a dedicated dose-first
 * strength scheduler is validated; muscle-volume targets are not lift practice.
 */
function* recommendationSearch(input: CapacityRecommendationInput): Generator<void, CapacityRecommendation> {
  if (input.goal === TrainingGoal.STRENGTH) return yield* legacyRecommendationSearch(input);
  yield;
  const target = buildVolumePlan(input);
  const selections = RECOMMENDATION_SEEDS.map((seed) => selectExercises({
    volumePlan: target, catalogue: input.catalogue, seed, rankingPolicy: 'accessory-aware',
  }));
  const sets = Math.round(selections.reduce((sum, selection) => sum + selection.performedSets, 0) / selections.length);
  const targetsCovered = selections.every((selection) => target.muscles.every((muscle) =>
    (selection.attributedByMuscle[muscle.muscle] ?? 0) >= muscle.meav - 1))
    && sets >= TOTAL_SETS_RANGE[input.goal][input.level][0];
  const candidates: (ScoredCapacity & { overflow: number; quality: number })[] = [];
  for (const sessions of RECOMMENDED_SESSION_COUNTS) {
    for (const minutes of RECOMMENDED_SESSION_MINUTES) {
      yield;
      const distributions = selections.map((selection) => distributeSelection({
        selection, split: input.split ?? SplitStructure.AUTO, sessionsPerMicrocycle: sessions,
        maxWorkMinutesPerSession: minutes - SESSION_OVERHEAD_MINUTES,
        capacityPacking: input.capacityPacking !== false,
        deprioritizedMuscles: target.muscles.filter((muscle) => muscle.emphasis === RegionEmphasis.DEPRIORITIZED)
          .map((muscle) => muscle.muscle),
      }));
      const overflow = Math.max(...distributions.map((distribution) =>
        distribution.sessions.reduce((sum, session) => sum + Math.max(0,
          session.estimatedWorkMinutes + SESSION_OVERHEAD_MINUTES - minutes), 0)
          + distribution.unassigned.reduce((sum, entry) => sum + entry.sets * MINUTES_PER_WORKING_SET_FLOOR, 0)));
      const empty = distributions.some((distribution) => distribution.sessions.some((session) => !session.exercises.length));
      // Ignore blanket frequency-one warnings: low-dose muscles need not be
      // split merely to satisfy a universal frequency rule.
      const quality = distributions.reduce((sum, distribution) => {
        const loads = distribution.sessions.map((session) => session.exercises.reduce((total, entry) => total + entry.sets, 0));
        const mean = loads.reduce((total, load) => total + load, 0) / sessions;
        const thin = loads.filter((load) => load < Math.min(12, mean * 0.65)).length;
        return sum + concentrationCost(distribution) + thin * 2
          + distribution.structureWarnings.filter((warning) => warning.kind === 'session-volume-cap').length
          + distribution.sequencingWarnings.length;
      }, 0) / distributions.length;
      candidates.push({ sessionsPerMicrocycle: sessions, minutesPerSession: minutes,
        weeklyMinutes: sessions * minutes, sets, reachesRecoverableVolume: targetsCovered && overflow <= 0.01 && !empty,
        meanStructureWarnings: quality, hasEmptySession: empty, overflow, quality });
    }
  }
  // Catalogue shortfalls do not justify searching for a different volume.
  // Rank schedules that fit the fixed roster even when targets are unavailable.
  const feasible = candidates.filter((candidate) => candidate.overflow <= 0.01 && !candidate.hasEmptySession);
  let pool = feasible;
  if (pool.length) {
    const bestQuality = Math.min(...pool.map((candidate) => candidate.quality));
    pool = pool.filter((candidate) => candidate.quality <= bestQuality + STRUCTURE_TOLERANCE);
    pool.sort((a, b) => a.weeklyMinutes - b.weeklyMinutes || a.sessionsPerMicrocycle - b.sessionsPerMicrocycle);
  } else {
    pool = [...candidates].sort((a, b) => Number(a.hasEmptySession) - Number(b.hasEmptySession)
      || a.overflow - b.overflow || a.quality - b.quality || a.weeklyMinutes - b.weeklyMinutes);
  }
  const { overflow: _overflow, quality: _quality, meanStructureWarnings: _warnings, hasEmptySession: _empty, ...best } = pool[0]!;
  return best;
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
