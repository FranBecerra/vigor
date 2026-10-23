/**
 * Planificador de mesociclo: compone el plan de volumen, la capacidad real del
 * atleta y la selección de ejercicios. LÓGICA PURA (PRD §3.6).
 *
 * LOS DOS TECHOS, Y CUÁL MANDA
 *   El volumen está acotado por dos cosas independientes:
 *     - lo que el atleta RECUPERA (MRV y rango de volumen total de su nivel)
 *     - el TIEMPO del que dispone (sesiones × minutos)
 *   Manda el más bajo. `volumePlan` resuelve el primero; este módulo aplica el
 *   segundo y devuelve cuál de los dos ha sido el que limita, porque son
 *   situaciones distintas y el atleta debe poder distinguirlas: "no te da tiempo"
 *   se arregla con más sesiones, "no lo recuperarías" no.
 *
 * CÓMO SE AJUSTA
 *   El recorte se busca por bisección sobre la selección REAL, no sobre una
 *   estimación: el coste en minutos depende de qué ejercicios salen, porque un
 *   multiarticular descansa 180 s y un aislamiento 120 s. Estimar el tiempo con
 *   una mezcla promedio y luego elegir los ejercicios daría un plan que no cabe.
 */
import { ExerciseGenerationTier, ExerciseProfile, SplitStructure, type Exercise } from '@/models';
import {
  MAX_SQUEEZE,
  TOTAL_SETS_RANGE,
  RegionEmphasis,
  buildVolumePlan,
  squeezePlan,
  type VolumePlan,
  type VolumePlanInput,
} from './volumePlan';
import { createRandom, hypertrophyDominates, remainingVolumeUtility, selectExercises, summarizeSelection, directVolumeFloor, type RankingPolicy, type SelectionResult } from './exerciseSelection';
import { criteriaOf } from './exerciseCatalogue';
import {
  SESSION_OVERHEAD_MINUTES,
  exerciseMinutes,
  MAX_SETS_PER_EXERCISE_APPEARANCE,
  workMinutesAvailable,
  type TrainingCapacity,
} from './trainingCapacity';
import { planStrengthMesocycle, type StrengthProgramReport } from './strengthProgram';
import { TrainingGoal } from './volumePlan';
import { workloadTemplateRecovery } from './scheduleTemplate';
import {
  distributeSelection,
  sessionSequencingWarnings,
  createSequencingEvaluator,
  repairSessionAllocation,
  orderSessionExercises,
  MIN_HYPERTROPHY_SESSION_SETS,
  effectiveSetsByMuscle,
  sessionSetCap,
  isSessionAnchor,
  type SessionDistribution,
  type SessionExercise,
} from './sessionDistribution';
import { redundantSessionPair } from './exerciseFamilies';
import { missingRequiredPatterns } from './targetCoverage';

/** Qué techo ha limitado el volumen del plan. */
export type LimitingFactor =
  | 'catalogue'
  /** El plan cabe en el tiempo disponible: limita lo que el atleta recupera. */
  | 'recovery'
  /** El plan se ha recortado para caber en el tiempo disponible. */
  | 'time'
  /**
   * Ni con todas las regiones en mantenimiento cabe en el tiempo disponible.
   * Hacen falta más sesiones o sesiones más largas.
   */
  | 'insufficient-time';

export interface MesocyclePlan {
  /** Diagnostic only; not persisted prescriptions or a biological explanation. */
  policyTrace?: PolicyPromotionDecision[];
  /** Plan de volumen ya ajustado a la capacidad. */
  plan: VolumePlan;
  /** Plan antes de recortar, para poder mostrar cuánto se ha cedido. */
  uncappedPlan: VolumePlan;
  selection: SelectionResult;
  /** Actual distribution of exercises across microcycle sessions. */
  distribution: SessionDistribution;
  limitedBy: LimitingFactor;
  /** Recorte aplicado, de 0 (ninguno) a `MAX_SQUEEZE`. */
  squeeze: number;
  /** Minutos de trabajo que cuesta la selección. */
  estimatedWorkMinutes: number;
  /** Minutos de trabajo disponibles. */
  availableWorkMinutes: number;
  /** Longest individual session work duration. */
  maxSessionWorkMinutes: number;
  /** Work capacity of an individual session. */
  availableWorkMinutesPerSession: number;
  /** Strength goal only: which lifts the program prescribes and how it is balanced. */
  strength?: StrengthProgramReport;
}

export interface MesocyclePlanInput extends VolumePlanInput {
  /** Internal deterministic dose-allocation control; requested seed only varies the finished plan. */
  deterministicDose?: boolean;
  /** Internal branch-and-evaluate control, never a user variation seed. */
  allocationAlternative?: { position: number; rank: number };
  capacity: TrainingCapacity;
  /** Catálogo YA filtrado por material disponible y vetos. */
  catalogue: readonly Exercise[];
  seed: number;
  /** Reproducible comparison override; production uses guarded coupled allocation. */
  rankingPolicy?: RankingPolicy;
  /** Athlete-selected structure; AUTO resolves from their session count. */
  split?: SplitStructure;
  /** Optional last completed/planned session, used to avoid immediate overlap. */
  previousSession?: readonly SessionExercise[];
}

/** Pasos de la bisección. Diez dan una precisión de recorte de 0,002. */
const SQUEEZE_SEARCH_STEPS = 10;

/** Initial-generation entry point: allocate independently, then vary at fixed dose. */
export function planDoseFirstMesocycle(input: MesocyclePlanInput): MesocyclePlan {
  if (input.goal !== TrainingGoal.HYPERTROPHY || input.rankingPolicy !== undefined) return planMesocycle(input);
  return rerollMesocycle(input, allocateDoseFirst(input));
}

/** Fixed targets, role-aware marginal selection, placement, then residual integer allocation. */
export function allocateDoseFirst(input: MesocyclePlanInput): MesocyclePlan {
  if (input.goal !== TrainingGoal.HYPERTROPHY || input.rankingPolicy !== undefined) return planMesocycle(input);
  if (!Number.isFinite(input.capacity.minutesPerSession) || input.capacity.minutesPerSession < 0
    || !Number.isInteger(input.capacity.sessionsPerMicrocycle) || input.capacity.sessionsPerMicrocycle < 0
    || !Number.isFinite(input.seed)) throw new RangeError('Invalid training capacity or seed');
  const uncappedPlan = buildVolumePlan(input);
  const availableWorkMinutes = workMinutesAvailable(input.capacity);
  const availableWorkMinutesPerSession = Math.max(0, input.capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES);
  const rosters = new Map<string, { plan: VolumePlan; selection: SelectionResult; squeeze: number; shortfall: number }>();
  // Candidate identities/doses depend on targets and apparatus, not variation
  // seed or time. More time expands the feasible portion of the same lattice.
  for (let step = 0; step <= 16; step++) for (const rankingPolicy of ['legacy-weighted', 'volume-aware', 'accessory-aware'] as const) {
    const squeeze = MAX_SQUEEZE * step / 16;
    const plan = squeezePlan(uncappedPlan, squeeze);
    for (const timeConstrained of [false, true]) {
      const selection = selectExercises({ volumePlan: plan, catalogue: input.catalogue,
        seed: input.seed, deterministic: true, rankingPolicy, timeConstrained });
      const key = JSON.stringify(selection.selected.map((entry) => [entry.exercise.id, entry.sets]).sort());
      if (rosters.has(key)) continue;
      const shortfall = uncappedPlan.muscles.reduce((sum, muscle) => sum
        + Math.max(0, muscle.meav - (selection.attributedByMuscle[muscle.muscle] ?? 0)), 0);
      rosters.set(key, { plan, selection, squeeze, shortfall });
    }
  }
  const frontier = [...rosters.values()].sort((a, b) => a.shortfall - b.shortfall
    || b.selection.performedSets - a.selection.performedSets || a.squeeze - b.squeeze);
  // Keep the repaired coupled allocation as an incumbent, not merely a rescue
  // for wholly infeasible rosters. A new frontier cannot discard useful dose.
  let best = allocateDoseAtCapacity(input);
  let feasibleEvaluated = 0;
  for (const roster of frontier) {
    if (roster.selection.selected.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0) > availableWorkMinutes) continue;
    const rosterMinutes = roster.selection.selected.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0);
    // Find a canonical placement budget from the roster itself. Athlete time
    // only filters feasibility; it must not reshuffle an already feasible dose.
    let placementMinutes = Math.max(1, Math.ceil(rosterMinutes / Math.max(1, input.capacity.sessionsPerMicrocycle)) + 6);
    let distribution: SessionDistribution;
    do {
      distribution = distributeSelection({ selection: roster.selection, split: input.split ?? SplitStructure.AUTO,
      sessionsPerMicrocycle: input.capacity.sessionsPerMicrocycle, previousSession: input.previousSession,
      maxWorkMinutesPerSession: placementMinutes, minimumSessionSets: MIN_HYPERTROPHY_SESSION_SETS,
      deprioritizedMuscles: roster.plan.muscles.filter((muscle) => muscle.emphasis === RegionEmphasis.DEPRIORITIZED).map((muscle) => muscle.muscle) });
      if (!distribution.unassigned.length && distribution.sessions.every((session) => session.exercises.length)) break;
      placementMinutes += 3;
    } while (placementMinutes <= availableWorkMinutesPerSession);
    if (distribution.unassigned.length || distribution.sessions.some((session) =>
      !session.exercises.length || session.estimatedWorkMinutes > availableWorkMinutesPerSession)) continue;
    const placementInput = { ...input, capacity: { ...input.capacity,
      minutesPerSession: placementMinutes + SESSION_OVERHEAD_MINUTES } };
    const proposal: MesocyclePlan = { plan: roster.plan, selection: roster.selection, squeeze: roster.squeeze,
      uncappedPlan, distribution, limitedBy: roster.squeeze ? 'time' : 'recovery',
      availableWorkMinutes: placementMinutes * input.capacity.sessionsPerMicrocycle,
      availableWorkMinutesPerSession: placementMinutes, estimatedWorkMinutes: distribution.totalWorkMinutes,
      maxSessionWorkMinutes: distribution.maxSessionWorkMinutes };
    const placed = repairDosePlacement(placementInput, completeDoseWithinCapacity(placementInput, rebalanceFinalDose(placementInput, proposal)));
    const candidate = { ...placed, availableWorkMinutes, availableWorkMinutesPerSession };
    if (candidate.maxSessionWorkMinutes > availableWorkMinutesPerSession) continue;
    if (evaluateDoseFrontier(input, best, candidate).accepted) best = candidate;
    if (++feasibleEvaluated >= 12) break;
  }
  return repairDosePlacement(input, best);
}

function allocateDoseAtCapacity(input: MesocyclePlanInput,
  placements = new Map<string, SessionDistribution['sessions']>()): MesocyclePlan {
  if (input.goal !== TrainingGoal.HYPERTROPHY || input.rankingPolicy !== undefined) return planMesocycle(input);
  const repair = (plan: MesocyclePlan) => {
    if (plan.distribution.unassigned.length || !plan.distribution.sessions.length) return plan;
    const key = JSON.stringify([plan.availableWorkMinutesPerSession, plan.distribution.sessions.map((session) =>
      [session.index, session.focus, session.exercises.map((entry) => [entry.exercise.id, entry.sets])])]);
    const cached = placements.get(key);
    if (cached) return refreshPlacement(plan, cached.map((session) => ({ ...session,
      exercises: session.exercises.map((entry) => ({ ...entry })) })), input.previousSession);
    const result = repairDosePlacement(input, plan);
    placements.set(key, result.distribution.sessions.map((session) => ({ ...session,
      exercises: session.exercises.map((entry) => ({ ...entry })) })));
    return result;
  };
  // Marginal ranking alone can worsen placement. Keep the deterministic coupled
  // incumbent unless the complete-plan guard accepts the alternative roster.
  const incumbent = repair(completeDoseWithinCapacity(input, planMesocycle({ ...input, deterministicDose: true })));
  const proposal = planWithPolicy({ ...input, deterministicDose: true, rankingPolicy: 'accessory-aware' });
  const candidate = repair(completeDoseWithinCapacity(input, rebalanceFinalDose(input, proposal)));
  const decision = evaluateDoseFrontier(input, incumbent, candidate);
  return decision.reasons.every((reason) => reason.code === 'no-allocation-improvement') ? candidate : incumbent;
}

/** Joint capacity frontier: structural recovery constraints precede ordinal tie-breakers. */
export function evaluateDoseFrontier(input: MesocyclePlanInput, baseline: MesocyclePlan,
  candidate: MesocyclePlan): PolicyPromotionDecision {
  const decision = evaluateFinalPlanRepair(input, baseline, candidate);
  // Alert count is not a risk measure. More smaller sequencing alerts may
  // accompany lower aggregate flagged risk, without any additional recovery
  // template deficit. Keep all magnitude/template/coverage guards intact and
  // record this distinction only for new allocation, never incumbent rerolls.
  const riskPreserved = !decision.reasons.some((reason) => ['final-flaggedRisk', 'final-recoveryCost',
    'template-overlap-count'].includes(reason.code));
  const betterDose = candidate.selection.performedSets >= baseline.selection.performedSets
    && decision.metrics.targetShortfallAfter < decision.metrics.targetShortfallBefore - 0.5;
  const templatePreserved = !decision.reasons.some((reason) => ['final-recoveryCost', 'template-overlap-count'].includes(reason.code));
  // During first allocation, an already feasible higher-dose roster must not be
  // discarded merely because a lower-dose roster has less ordinal workload.
  // The undated rest template, concentration, redundancy, muscle caps and
  // exposure constraints still apply. Actual preceding workout stays protected.
  const feasibleDoseTradeoff = betterDose && templatePreserved && !input.previousSession?.length;
  const reasons = decision.reasons.filter((reason) =>
    (reason.code !== 'final-adjacentCount' || !(riskPreserved || feasibleDoseTradeoff))
    && (reason.code !== 'final-flaggedRisk' || !feasibleDoseTradeoff));
  return { ...decision, reasons, accepted: reasons.every((reason) => reason.code === 'no-allocation-improvement') };
}

/** Optimize placement without changing the exercise roster or any weekly dose. */
export function repairDosePlacement(input: MesocyclePlanInput, baseline: MesocyclePlan): MesocyclePlan {
  if (input.goal !== TrainingGoal.HYPERTROPHY || baseline.distribution.unassigned.length) return baseline;
  const evaluateSequencing = createSequencingEvaluator();
  const measurements = new WeakMap<MesocyclePlan, { warnings: number; sequencing: ReturnType<typeof sessionSequencingWarnings> }>();
  const measure = (plan: MesocyclePlan) => {
    let result = measurements.get(plan);
    if (!result) {
      result = { warnings: workloadTemplateRecovery(plan.distribution.sessions.map((session) => {
        const directSets = new Map<string, number>();
        session.exercises.forEach((entry) => directSets.set(entry.exercise.primaryMuscle,
          (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets));
        return { index: session.index, directSets };
      })).filter((pair) => pair.reviewSuggested).length,
      sequencing: [...evaluateSequencing(plan.distribution.sessions, input.previousSession),
        ...(plan.distribution.sessions.length > 1 ? evaluateSequencing([plan.distribution.sessions[0]],
          plan.distribution.sessions[plan.distribution.sessions.length - 1].exercises) : [])] };
      measurements.set(plan, result);
    }
    return result;
  };
  const warnings = (plan: MesocyclePlan) => measure(plan).warnings;
  const sequencing = (plan: MesocyclePlan) => measure(plan).sequencing;
  const unsettled = (plan: MesocyclePlan) => warnings(plan) > 0
    || (!!input.previousSession?.length && sequencing(plan).length > 0);
  let best = baseline;
  const accept = (candidate: MesocyclePlan) => {
    const improved = warnings(candidate) < warnings(best) || (warnings(candidate) === warnings(best)
      && (sequencing(candidate).length < sequencing(best).length
        || sequencing(candidate).reduce((sum, warning) => sum + warning.risk, 0)
          < sequencing(best).reduce((sum, warning) => sum + warning.risk, 0) - 1e-8));
    if (!improved) return;
    const decision = evaluateFinalPlanRepair(input, best, candidate);
    // Undated neighbouring-workout alerts are not a veto on a better actual
    // rest-template arrangement at identical dose. A real preceding workout,
    // template cost and all structural constraints remain protected.
    const improvesTemplate = warnings(candidate) < warnings(best) && !input.previousSession?.length;
    if (decision.reasons.some((reason) => reason.code !== 'no-allocation-improvement'
      && reason.code !== 'no-objective-improvement'
      && !(improvesTemplate && ['final-adjacentCount', 'final-flaggedRisk'].includes(reason.code)))) return;
    best = candidate;
  };
  if (!unsettled(best)) return best;
  // AUTO owns its sequence; explicit splits keep their declared day order.
  if ((input.split === undefined || input.split === SplitStructure.AUTO) && baseline.distribution.sessions.length <= 6) {
    const original = baseline.distribution.sessions;
    const visit = (order: number[], remaining: number[]): void => {
      if (!unsettled(best)) return;
      if (remaining.length) {
        for (const index of remaining) visit([...order, index], remaining.filter((entry) => entry !== index));
      } else accept(refreshPlacement(baseline, order.map((index, position) => ({ ...original[index], index: position })), input.previousSession, evaluateSequencing));
    };
    visit([], original.map((_, index) => index));
  }
  if (warnings(best)) {
    const sessions = best.distribution.sessions.map((session) => ({ ...session, exercises: [...session.exercises] }));
    const floor = Math.min(MIN_HYPERTROPHY_SESSION_SETS,
      ...sessions.map((session) => session.exercises.reduce((sum, entry) => sum + entry.sets, 0)));
    if (repairSessionAllocation(sessions, floor, best.availableWorkMinutesPerSession, input.previousSession, true)) {
      accept(refreshPlacement(best, sessions, input.previousSession, evaluateSequencing));
    }
  }
  // Pairwise search can be trapped by an infeasible intermediate state. An
  // atomic three-day rotation is assessed only after all three moves finish.
  for (const bundleSize of [1, 2]) {
  let trials = 0;
  for (let round = 0; round < 3 && unsettled(best); round++) {
    const start = best;
    const sessions = start.distribution.sessions;
    const pairs = workloadTemplateRecovery(sessions.map((session) => {
      const directSets = new Map<string, number>();
      session.exercises.forEach((entry) => directSets.set(entry.exercise.primaryMuscle,
        (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets));
      return { index: session.index, directSets };
    })).filter((pair) => pair.reviewSuggested).map((pair) => ({ from: pair.from, to: pair.to }));
    for (const warning of sequencing(start)) {
      const from = warning.precedingSessionIndex ?? sessions.length - 1;
      const to = warning.followingSessionIndex;
      if (!pairs.some((pair) => pair.from === from && pair.to === to) && from !== to) pairs.push({ from, to });
    }
    search: for (const pair of pairs) for (let third = 0; third < sessions.length; third++) {
      if (third === pair.from || third === pair.to) continue;
      const indices = [pair.from, pair.to, third];
      const bundles = (entries: SessionExercise[]) => bundleSize === 1 ? entries.map((entry) => [entry])
        : entries.flatMap((entry, index) => entries.slice(index + 1).map((other) => [entry, other]));
      const setsOf = (entries: SessionExercise[]) => entries.reduce((sum, entry) => sum + entry.sets, 0);
      for (const a of bundles(sessions[indices[0]].exercises)) for (const b of bundles(sessions[indices[1]].exercises))
        for (const c of bundles(sessions[third].exercises)) for (const direction of [1, 2]) {
          if (bundleSize === 2 && (setsOf(a) !== setsOf(b) || setsOf(b) !== setsOf(c))) continue;
          if (++trials > 4000) break search;
          const entries = [a, b, c];
          const changed = sessions.map((session, index) => {
            const position = indices.indexOf(index);
            if (position < 0) return { ...session, exercises: [...session.exercises] };
            const exercises = [...session.exercises.filter((entry) => !entries[position].includes(entry)),
              ...entries[(position + direction) % 3]];
            return { ...session, exercises, estimatedWorkMinutes: exercises.reduce((sum, entry) =>
              sum + exerciseMinutes(entry.exercise, entry.sets), 0) };
          });
          if (changed.some((session) => session.estimatedWorkMinutes > start.availableWorkMinutesPerSession)) continue;
          accept(refreshPlacement(start, changed, input.previousSession, evaluateSequencing));
          if (best !== start) break search;
        }
    }
    if (best === start) break;
  }
  }
  return best;
}

/** Reconsider integer dose against the original targets after actual placement. */
export function completeDoseWithinCapacity(input: MesocyclePlanInput, baseline: MesocyclePlan): MesocyclePlan {
  if (input.goal !== TrainingGoal.HYPERTROPHY || baseline.distribution.unassigned.length) return baseline;
  let best = baseline;
  const targets = new Map(baseline.uncappedPlan.muscles.map((muscle) => [muscle.muscle, muscle.meav]));
  const ceiling = TOTAL_SETS_RANGE[input.goal][input.level][1];
  let evaluated = 0;
  for (let iteration = 0; iteration < 12 && best.selection.performedSets < ceiling; iteration++) {
    const attributed = new Map(Object.entries(best.selection.attributedByMuscle) as [import('@/models').MuscleGroup, number][]);
    const used = new Set(best.selection.selected.map((entry) => entry.exercise.id));
    const proposals: { exercise: Exercise; sets: number; sessionIndex: number; score: number }[] = [];
    for (const [sessionIndex, session] of best.distribution.sessions.entries()) {
      for (const entry of session.exercises) {
        if (entry.sets >= MAX_SETS_PER_EXERCISE_APPEARANCE) continue;
        const useful = remainingVolumeUtility(entry.exercise, 1, targets, attributed);
        if (useful > 0) proposals.push({ exercise: entry.exercise, sets: 1, sessionIndex,
          score: useful / Math.max(1, exerciseMinutes(entry.exercise, entry.sets + 1) - exerciseMinutes(entry.exercise, entry.sets)) });
      }
      for (const exercise of input.catalogue) {
        if (used.has(exercise.id) || exercise.generationTier === ExerciseGenerationTier.MANUAL_ONLY
          || exercise.generationTier === ExerciseGenerationTier.STRENGTH_VARIANT
          || exercise.generationTier === ExerciseGenerationTier.FALLBACK) continue;
        const remaining = (targets.get(exercise.primaryMuscle) ?? 0) - (attributed.get(exercise.primaryMuscle) ?? 0);
        const available = best.availableWorkMinutesPerSession - session.estimatedWorkMinutes;
        const sets = exercise.profile === ExerciseProfile.ISOLATION
          && (remaining < 3 || exerciseMinutes(exercise, 3) > available) ? 2 : 3;
        // A one-set residual may require the minimum two-set isolation
        // appearance. Its useful credit remains capped at the actual deficit.
        if (remaining < (exercise.profile === ExerciseProfile.ISOLATION ? 1 : sets)
          || best.selection.performedSets + sets > ceiling) continue;
        const useful = remainingVolumeUtility(exercise, sets, targets, attributed);
        proposals.push({ exercise, sets, sessionIndex, score: useful / Math.max(1, exerciseMinutes(exercise, sets))
          / (1 + (6 - criteriaOf(exercise).systemicFatigueCost) * 0.1) });
      }
    }
    proposals.sort((a, b) => b.score - a.score || a.sessionIndex - b.sessionIndex || a.exercise.id.localeCompare(b.exercise.id));
    let accepted = false;
    for (const proposal of proposals) {
      if (++evaluated > 300) return best;
      const sessions = best.distribution.sessions.map((session, index) => {
        const exercises = session.exercises.map((entry) => index === proposal.sessionIndex && entry.exercise.id === proposal.exercise.id
          ? { ...entry, sets: entry.sets + proposal.sets } : { ...entry });
        if (index === proposal.sessionIndex && !used.has(proposal.exercise.id)) exercises.push({ exercise: proposal.exercise, sets: proposal.sets });
        return { ...session, exercises, estimatedWorkMinutes: exercises.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0) };
      });
      if (sessions[proposal.sessionIndex].estimatedWorkMinutes > best.availableWorkMinutesPerSession) continue;
      const selected = sessions.flatMap((session) => session.exercises.map((entry) => ({ exercise: entry.exercise, sets: entry.sets })));
      const allocated = refreshPlacement({ ...best, selection: summarizeSelection(selected, best.plan,
        best.selection.missingFoundationalPatterns) }, sessions, input.previousSession);
      // Assess the addition and its balancing transfer atomically. Rejecting
      // the temporary 13/11 split would hide a feasible final 12/12 allocation.
      const candidate = rebalanceFinalDose(input, allocated);
      const decision = evaluateFinalPlanRepair(input, best, candidate);
      const reasons = decision.reasons.filter((reason) => reason.code !== 'no-allocation-improvement');
      if (reasons.length) continue;
      best = candidate; accepted = true; break;
    }
    if (!accepted) break;
  }
  return best;
}

/** Variation is subordinate to the existing dose, not another capacity search. */
function* mesocycleVariation(input: MesocyclePlanInput, baseline: MesocyclePlan): Generator<void, MesocyclePlan, unknown> {
  if (!Number.isFinite(input.seed)) throw new RangeError('Invalid reroll seed');
  if (input.goal === TrainingGoal.STRENGTH && baseline.strength) {
    const signature = (plan: MesocyclePlan) => JSON.stringify(plan.distribution.sessions.map((session) => ({
      dose: [...effectiveSetsByMuscle(session.exercises)].sort(([a], [b]) => a.localeCompare(b)),
      direct: [...new Set(session.exercises.map((entry) => entry.exercise.primaryMuscle))].sort().map((muscle) =>
        [muscle, session.exercises.filter((entry) => entry.exercise.primaryMuscle === muscle).reduce((sum, entry) => sum + entry.sets, 0)]),
      roles: session.exercises.map((entry) => [entry.strength?.role, entry.sets, entry.strength?.topSingle,
        entry.strength?.role === 'MAIN' ? entry.exercise.id : null]).sort(),
    })));
    for (const offset of [0, -1, 1]) {
      yield;
      const candidate = planMesocycle({ ...input, seed: input.seed + offset });
      if (signature(candidate) !== signature(baseline) || JSON.stringify(candidate.plan) !== JSON.stringify(baseline.plan)) continue;
      if (JSON.stringify(candidate.distribution.sessions.map((s) => s.exercises.map((e) => e.exercise.id)))
        === JSON.stringify(baseline.distribution.sessions.map((s) => s.exercises.map((e) => e.exercise.id)))) continue;
      const decision = evaluateFinalPlanRepair(input, baseline, candidate);
      if (!decision.reasons.some((reason) => reason.code !== 'no-allocation-improvement' && reason.code !== 'no-objective-improvement')
        && decision.metrics.ordinalCostAfter <= decision.metrics.ordinalCostBefore) return candidate;
    }
    return baseline;
  }
  if (input.goal !== TrainingGoal.HYPERTROPHY || baseline.strength || baseline.distribution.unassigned.length
    || baseline.distribution.sessions.length !== input.capacity.sessionsPerMicrocycle) return baseline;
  const original = baseline.distribution.sessions.flatMap((session) => session.exercises);
  if (new Set(original.map((entry) => entry.exercise.id)).size !== original.length
    || original.some((entry) => entry.strength || !Number.isInteger(entry.sets) || entry.sets <= 0)) return baseline;
  const random = createRandom(input.seed);
  const doseKey = (exercise: Exercise) => JSON.stringify([...effectiveSetsByMuscle([{ exercise, sets: 1 }])]
    .sort(([a], [b]) => a.localeCompare(b)));
  let best = baseline;
  let attempts = 0;
  let changes = 0;
  const positions = baseline.distribution.sessions.flatMap((session, sessionIndex) => session.exercises
    .map((_, order) => ({ sessionIndex, order, draw: random() }))).sort((a, b) => a.draw - b.draw);
  // One accepted substitution per visit; bounded even on a large custom catalogue.
  for (const position of positions) {
    yield;
    const outgoing = baseline.distribution.sessions[position.sessionIndex].exercises[position.order];
    const used = new Set(best.selection.selected.map((entry) => entry.exercise.id));
    const alternatives = input.catalogue.filter((exercise) => !used.has(exercise.id)
      && exercise.generationTier !== ExerciseGenerationTier.MANUAL_ONLY
      && exercise.generationTier !== ExerciseGenerationTier.STRENGTH_VARIANT
      && (exercise.generationTier !== ExerciseGenerationTier.FALLBACK
        || outgoing.exercise.generationTier === ExerciseGenerationTier.FALLBACK)
      && exercise.primaryMuscle === outgoing.exercise.primaryMuscle
      && exercise.profile === outgoing.exercise.profile
      && exercise.movementVector === outgoing.exercise.movementVector
      && doseKey(exercise) === doseKey(outgoing.exercise)
      && !hypertrophyDominates(outgoing.exercise, exercise))
      .map((exercise) => ({ exercise, draw: random() })).sort((a, b) => a.draw - b.draw);
    for (const { exercise } of alternatives) {
      yield;
      if (++attempts > 80) return best;
      const sessions = best.distribution.sessions.map((session) => ({ ...session,
        exercises: session.exercises.map((entry) => entry.exercise.id === outgoing.exercise.id ? { ...entry, exercise } : { ...entry }) }));
      for (const session of sessions) session.estimatedWorkMinutes = session.exercises
        .reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0);
      const selected = best.selection.selected.map((entry) => entry.exercise.id === outgoing.exercise.id ? { ...entry, exercise } : { ...entry });
      const candidate = refreshPlacement({ ...best, selection: summarizeSelection(selected, baseline.plan,
        baseline.selection.missingFoundationalPatterns) }, sessions, input.previousSession);
      const dimensions = (plan: MesocyclePlan) => {
        const values = new Map<string, Set<string>>();
        for (const entry of plan.selection.selected.filter((item) => item.exercise.primaryMuscle === exercise.primaryMuscle)) {
          for (const tag of entry.exercise.stimulusTags ?? []) {
            const axis = tag.split(':')[0];
            const variants = values.get(axis) ?? new Set<string>();
            variants.add(tag); values.set(axis, variants);
          }
        }
        return values;
      };
      const afterDimensions = dimensions(candidate);
      if ([...dimensions(best)].some(([axis, values]) => (afterDimensions.get(axis)?.size ?? 0) < values.size)) continue;
      const decision = evaluateFinalPlanRepair(input, best, candidate);
      // A reroll is allowed to be neutral, unlike an optimization promotion.
      const reasons = decision.reasons.filter((reason) => reason.code !== 'no-allocation-improvement'
        && reason.code !== 'no-objective-improvement');
      if (reasons.length || decision.metrics.ordinalCostAfter > decision.metrics.ordinalCostBefore) continue;
      best = candidate;
      changes += 1;
      break;
    }
    if (changes >= 3) break;
  }
  return best;
}

/** Synchronous planner compatibility: exactly the same deterministic variation path. */
export function rerollMesocycle(input: MesocyclePlanInput, baseline: MesocyclePlan): MesocyclePlan {
  const task = mesocycleVariation(input, baseline);
  let result = task.next();
  while (!result.done) result = task.next();
  return result.value;
}

/** Native UI driver yields between bounded candidate checks and supports cancellation. */
export async function rerollMesocycleAsync(input: MesocyclePlanInput, baseline: MesocyclePlan, options: {
  isCancelled?: () => boolean; yieldControl?: () => Promise<void>;
} = {}): Promise<MesocyclePlan> {
  const task = mesocycleVariation(input, baseline);
  const yieldControl = options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  for (;;) {
    await yieldControl();
    if (options.isCancelled?.()) return baseline;
    const result = task.next();
    if (result.done) return result.value;
  }
}

/** Promote the coupled candidate only when it preserves the baseline constraints. */
export function planMesocycle(input: MesocyclePlanInput): MesocyclePlan {
  let best = planMesocycleCandidate(input);
  if (input.goal !== TrainingGoal.HYPERTROPHY || input.rankingPolicy !== undefined) return best;
  const loads = best.distribution.sessions.map((session) => session.exercises.reduce((sum, entry) => sum + entry.sets, 0));
  if (!loads.some((sets) => sets < MIN_HYPERTROPHY_SESSION_SETS)
    || loads.reduce((sum, sets) => sum + sets, 0) < loads.length * MIN_HYPERTROPHY_SESSION_SETS) return best;
  if (input.deterministicDose) return rebalanceFinalDose(input, best);
  // Frozen-roster swaps can be impossible. Compete complete candidates only
  // after policy selection, keeping the original inputs and provisional targets.
  for (const offset of [-2, 2, -3, 3, -4, 4]) {
    const candidateSeed = input.seed + offset;
    const candidate = planMesocycleCandidate({ ...input, seed: candidateSeed });
    const decision = { ...evaluateFinalPlanRepair(input, best, candidate), candidateSeed };
    best = { ...(decision.accepted ? candidate : best), policyTrace: [...(best.policyTrace ?? []), decision] };
    if (decision.accepted) return best;
  }
  const doseRepair = rebalanceFinalDose(input, best);
  if (doseRepair !== best) return doseRepair;
  // A small secondary probe closes cases just outside the previous radius
  // without repeating the full three-policy/neighbor search on every draw.
  for (const offset of [-5, 5, -6, 6]) {
    for (const rankingPolicy of ['legacy-weighted', 'volume-aware', 'accessory-aware'] as const) {
      const candidateSeed = input.seed + offset;
      const candidate = planWithPolicy({ ...input, seed: candidateSeed, rankingPolicy });
      const decision = { ...evaluateFinalPlanRepair(input, best, candidate), candidatePolicy: rankingPolicy, candidateSeed };
      best = { ...(decision.accepted ? candidate : best), policyTrace: [...(best.policyTrace ?? []), decision] };
      if (decision.accepted) return best;
    }
  }
  return best;
}

/** Move one working set, not an exercise appearance; never manufacture dose. */
export function rebalanceFinalDose(input: MesocyclePlanInput, baseline: MesocyclePlan): MesocyclePlan {
  if (input.goal !== TrainingGoal.HYPERTROPHY || baseline.distribution.sessions.some((session) => session.exercises.some((entry) => entry.strength))) return baseline;
  const sessions = baseline.distribution.sessions;
  const appearances = sessions.flatMap((session) => session.exercises);
  if (new Set(appearances.map((entry) => entry.exercise.id)).size !== appearances.length
    || appearances.some((entry) => !Number.isInteger(entry.sets) || entry.sets < 1 || entry.sets > MAX_SETS_PER_EXERCISE_APPEARANCE)) return baseline;
  const load = (session: typeof sessions[number]) => session.exercises.reduce((sum, entry) => sum + entry.sets, 0);
  if (sessions.reduce((sum, session) => sum + load(session), 0) < sessions.length * MIN_HYPERTROPHY_SESSION_SETS) return baseline;
  let evaluated = 0;
  for (const [recipientIndex, recipient] of sessions.entries()) {
    if (load(recipient) >= MIN_HYPERTROPHY_SESSION_SETS) continue;
    for (const [donorIndex, donor] of sessions.entries()) {
      if (donorIndex === recipientIndex || load(donor) <= MIN_HYPERTROPHY_SESSION_SETS) continue;
      for (const outgoing of donor.exercises) for (const incoming of recipient.exercises) {
        if (++evaluated > 300) return baseline;
        const minimum = outgoing.exercise.profile === ExerciseProfile.ISOLATION ? 2 : 3;
        if (outgoing.sets <= minimum || incoming.sets >= MAX_SETS_PER_EXERCISE_APPEARANCE) continue;
        const adjusted = sessions.map((session, index) => ({ ...session, exercises: session.exercises.map((entry) =>
          index === donorIndex && entry === outgoing ? { ...entry, sets: entry.sets - 1 }
            : index === recipientIndex && entry === incoming ? { ...entry, sets: entry.sets + 1 } : entry) }));
        for (const index of [donorIndex, recipientIndex]) adjusted[index].estimatedWorkMinutes = adjusted[index].exercises
          .reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0);
        const selected = baseline.selection.selected.map((entry) => ({ ...entry, sets: entry.sets
          + (entry.exercise.id === incoming.exercise.id ? 1 : 0) - (entry.exercise.id === outgoing.exercise.id ? 1 : 0) }));
        const candidate = refreshPlacement({ ...baseline, selection: summarizeSelection(selected, baseline.plan,
          baseline.selection.missingFoundationalPatterns) }, adjusted, input.previousSession);
        const decision = { ...evaluateFinalPlanRepair(input, baseline, candidate, true), stage: 'final-set-repair' as const };
        if (decision.accepted) return { ...candidate, policyTrace: [...(baseline.policyTrace ?? []), decision] };
      }
    }
  }
  return baseline;
}

function planMesocycleCandidate(input: MesocyclePlanInput): MesocyclePlan {
  if ((input.rankingPolicy !== undefined && input.rankingPolicy !== 'coupled-control')
    || input.goal !== TrainingGoal.HYPERTROPHY) return planWithPolicy(input);
  const baseline = planWithPolicy({ ...input, rankingPolicy: 'legacy-weighted' });
  const candidate = planWithPolicy({ ...input, rankingPolicy: 'volume-aware' });
  const incumbent = promoteCandidate(input, baseline, candidate, 'volume-aware');
  if (input.rankingPolicy === 'coupled-control') return incumbent;
  let best = promoteCandidate(input, incumbent, planWithPolicy({ ...input, rankingPolicy: 'accessory-aware' }), 'accessory-aware');
  if (best.limitedBy === 'time' && !input.deterministicDose) {
    const policy = [...(best.policyTrace ?? [])].reverse().find((decision) => decision.accepted)?.candidatePolicy ?? 'legacy-weighted';
    // Integer allocation can make one draw much less efficient than nearby
    // draws. Two deterministic alternatives compete under the same full guard.
    for (const offset of [-1, 1]) {
      const candidateSeed = input.seed + offset;
      const candidate = planWithPolicy({ ...input, seed: candidateSeed, rankingPolicy: policy });
      const decision = { ...evaluatePolicyPromotion(input, best, candidate, policy), candidateSeed };
      best = { ...(decision.accepted ? candidate : best), policyTrace: [...(best.policyTrace ?? []), decision] };
    }
  }
  return best;
}

/** Whole-plan guard for a replacement roster, not a physiological safety test. */
export function evaluateFinalPlanRepair(input: MesocyclePlanInput, baseline: MesocyclePlan,
  candidate: MesocyclePlan, setRedistribution = false): PolicyPromotionDecision {
  const policy = [...(candidate.policyTrace ?? [])].reverse().find((entry) => entry.accepted)?.candidatePolicy ?? 'legacy-weighted';
  const decision = evaluatePolicyPromotion(input, baseline, candidate, policy);
  // A Pareto-neutral dose/cost candidate may still improve distribution.
  // Ordinary roster promotion keeps its existing strict objective contract.
  const neutral = decision.metrics.targetShortfallAfter <= decision.metrics.targetShortfallBefore
    && decision.metrics.ordinalCostAfter <= decision.metrics.ordinalCostBefore;
  // Half-set secondary credit is the model's reporting resolution, not a
  // measured growth difference. Only an exact-total-dose redistribution may
  // trade that amount of aggregate shortfall for lower ordinal cost/balance.
  const sameRoster = baseline.selection.selected.length === candidate.selection.selected.length
    && baseline.selection.selected.every((entry) => candidate.selection.selected.some((other) => other.exercise.id === entry.exercise.id));
  const fractionalTradeoff = setRedistribution && sameRoster && candidate.selection.performedSets === baseline.selection.performedSets
    && decision.metrics.targetShortfallAfter <= decision.metrics.targetShortfallBefore + 0.5
    && decision.metrics.ordinalCostAfter < decision.metrics.ordinalCostBefore;
  const reasons = decision.reasons.filter((reason) => reason.code !== 'no-objective-improvement' || !(neutral || fractionalTradeoff));
  const deficit = (plan: MesocyclePlan) => plan.distribution.sessions.reduce((sum, session) => sum
    + Math.max(0, MIN_HYPERTROPHY_SESSION_SETS - session.exercises.reduce((count, entry) => count + entry.sets, 0)), 0);
  if (deficit(candidate) >= deficit(baseline)) reasons.push({ code: 'no-allocation-improvement' });
  const metrics = (plan: MesocyclePlan) => {
    const sessions = plan.distribution.sessions;
    const recovery = workloadTemplateRecovery(sessions.map((session) => {
      const directSets = new Map<string, number>();
      session.exercises.forEach((entry) => directSets.set(entry.exercise.primaryMuscle,
        (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets));
      return { index: session.index, directSets };
    })).filter((pair) => pair.reviewSuggested);
    const sequencing = sessionSequencingWarnings(sessions, input.previousSession);
    const cyclic = sessions.length > 1 ? sessionSequencingWarnings([sessions[0]], sessions[sessions.length - 1].exercises) : [];
    return {
      recoveryCost: recovery.reduce((sum, pair) => sum + pair.cost, 0),
      adjacentCount: sequencing.length + cyclic.length,
      flaggedRisk: [...sequencing, ...cyclic].reduce((sum, warning) => sum + warning.risk, 0),
      concentration: sessions.reduce((sum, session) => sum + [...effectiveSetsByMuscle(session.exercises).values()]
        .reduce((cost, sets) => cost + Math.max(0, sets - 10), 0), 0),
    };
  };
  const before = metrics(baseline), after = metrics(candidate);
  for (const key of ['recoveryCost', 'adjacentCount', 'flaggedRisk', 'concentration'] as const) {
    if (after[key] > before[key] + 1e-8) reasons.push({ code: `final-${key}`, before: before[key], after: after[key] });
  }
  for (const [index, session] of candidate.distribution.sessions.entries()) {
    const original = baseline.distribution.sessions[index];
    if (!original) continue;
    if (original.exercises.some(isSessionAnchor) && !session.exercises.some(isSessionAnchor)) {
      reasons.push({ code: 'final-anchor', subject: String(index) });
    }
    const duplicates = (entries: readonly SessionExercise[]) => entries.reduce((sum, entry, position) => sum
      + entries.slice(position + 1).filter((other) => redundantSessionPair(entry.exercise, other.exercise)).length, 0);
    if (duplicates(session.exercises) > duplicates(original.exercises)) reasons.push({ code: 'final-redundancy', subject: String(index) });
    const capExcess = (entries: readonly SessionExercise[]) => [...effectiveSetsByMuscle(entries)]
      .reduce((sum, [muscle, sets]) => sum + Math.max(0, sets - sessionSetCap(muscle, entries)), 0);
    if (capExcess(session.exercises) > capExcess(original.exercises) + 1e-8) reasons.push({ code: 'final-muscle-cap', subject: String(index) });
  }
  for (const [muscle, count] of Object.entries(baseline.distribution.frequencyByMuscle)) {
    if ((candidate.distribution.frequencyByMuscle[muscle as keyof typeof candidate.distribution.frequencyByMuscle] ?? 0)
      < Math.min(2, count ?? 0)) reasons.push({ code: 'final-exposure', subject: muscle });
  }
  return { ...decision, stage: 'final-roster-repair', reasons, accepted: reasons.length === 0 };
}

export interface PolicyPromotionDecision {
  stage?: 'final-roster-repair' | 'final-set-repair';
  candidatePolicy: RankingPolicy;
  /** Present for a bounded alternative draw; the user's input seed stays fixed. */
  candidateSeed?: number;
  accepted: boolean;
  reasons: { code: string; subject?: string; before?: number; after?: number; limit?: number }[];
  metrics: { targetShortfallBefore: number; targetShortfallAfter: number;
    ordinalCostBefore: number; ordinalCostAfter: number };
}

/** Preserve the incumbent's feasibility before considering another programming policy. */
export function evaluatePolicyPromotion(input: MesocyclePlanInput, baseline: MesocyclePlan,
  candidate: MesocyclePlan, candidatePolicy: RankingPolicy): PolicyPromotionDecision {
  const reasons: PolicyPromotionDecision['reasons'] = [];
  const short = (plan: MesocyclePlan) => plan.distribution.sessions.filter((s) =>
    s.exercises.reduce((sum, e) => sum + e.sets, 0) < MIN_HYPERTROPHY_SESSION_SETS).length;
  const direct = (plan: MesocyclePlan, muscle: import('@/models').MuscleGroup) => plan.selection.selected
    .filter((e) => e.exercise.primaryMuscle === muscle).reduce((sum, e) => sum + e.sets, 0);
  const budget = baseline.availableWorkMinutesPerSession;
  const loads = (plan: MesocyclePlan) => plan.distribution.sessions.map((s) =>
    s.exercises.reduce((sum, e) => sum + e.sets, 0));
  const beforeLoads = loads(baseline), afterLoads = loads(candidate);
  // Compare the allocator's actual dose, not a mapped first-microcycle ramp.
  // The latter can remove a set and hide an overlap visible in the audit.
  const recoveryWarnings = (plan: MesocyclePlan) => workloadTemplateRecovery(plan.distribution.sessions.map((session) => {
    const directSets = new Map<string, number>();
    session.exercises.forEach((entry) => directSets.set(entry.exercise.primaryMuscle,
      (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets));
    return { index: session.index, directSets };
  })).filter((pair) => pair.reviewSuggested).length;
  if (candidate.distribution.unassigned.length) reasons.push({ code: 'unassigned-work' });
  for (const session of candidate.distribution.sessions) {
    if (!session.exercises.length) reasons.push({ code: 'empty-session', subject: String(session.index) });
    if (session.estimatedWorkMinutes > budget + 0.01) reasons.push({ code: 'session-time',
      subject: String(session.index), after: session.estimatedWorkMinutes, limit: budget });
  }
  const compare = (code: string, before: number, after: number, worsened: boolean) => {
    if (worsened) reasons.push({ code, before, after });
  };
  compare('underfilled-count', short(baseline), short(candidate), short(candidate) > short(baseline));
  compare('minimum-session-load', Math.min(...beforeLoads), Math.min(...afterLoads), Math.min(...afterLoads) < Math.min(...beforeLoads));
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  compare('session-load-spread', spread(beforeLoads), spread(afterLoads), spread(afterLoads) > spread(beforeLoads));
  const recoveryBefore = recoveryWarnings(baseline), recoveryAfter = recoveryWarnings(candidate);
  compare('template-overlap-count', recoveryBefore, recoveryAfter, recoveryAfter > recoveryBefore);
  compare('performed-volume', baseline.selection.performedSets, candidate.selection.performedSets,
    candidate.selection.performedSets < baseline.selection.performedSets);
  compare('foundational-coverage', baseline.selection.missingFoundationalPatterns.length,
    candidate.selection.missingFoundationalPatterns.length,
    candidate.selection.missingFoundationalPatterns.length > baseline.selection.missingFoundationalPatterns.length);
  for (const muscle of baseline.uncappedPlan.muscles) {
    const before = baseline.selection.attributedByMuscle[muscle.muscle] ?? 0;
    const after = candidate.selection.attributedByMuscle[muscle.muscle] ?? 0;
    const attributionLimit = Math.min(before, muscle.meav) - 1;
    if (after < attributionLimit) reasons.push({ code: 'muscle-attribution', subject: muscle.muscle,
      before, after, limit: attributionLimit });
    const directLimit = Math.min(direct(baseline, muscle.muscle), directVolumeFloor(muscle.muscle, muscle.meav));
    if (direct(candidate, muscle.muscle) < directLimit) reasons.push({ code: 'direct-accessory-floor',
      subject: muscle.muscle, before: direct(baseline, muscle.muscle), after: direct(candidate, muscle.muscle), limit: directLimit });
  }
  const unmet = (plan: MesocyclePlan) => baseline.uncappedPlan.muscles.reduce((sum, m) =>
    sum + Math.max(0, m.meav - (plan.selection.attributedByMuscle[m.muscle] ?? 0)), 0);
  const cost = (plan: MesocyclePlan) => plan.selection.selected.reduce((sum, e) =>
    sum + e.sets * (6 - criteriaOf(e.exercise).systemicFatigueCost), 0);
  const metrics = { targetShortfallBefore: unmet(baseline), targetShortfallAfter: unmet(candidate),
    ordinalCostBefore: cost(baseline), ordinalCostAfter: cost(candidate) };
  const improved = metrics.targetShortfallAfter < metrics.targetShortfallBefore - 0.5
    || (metrics.targetShortfallAfter <= metrics.targetShortfallBefore && metrics.ordinalCostAfter < metrics.ordinalCostBefore);
  if (!improved) reasons.push({ code: 'no-objective-improvement' });
  return { candidatePolicy, accepted: reasons.length === 0, reasons, metrics };
}

function promoteCandidate(input: MesocyclePlanInput, baseline: MesocyclePlan, candidate: MesocyclePlan,
  policy: RankingPolicy): MesocyclePlan {
  let decision = evaluatePolicyPromotion(input, baseline, candidate, policy);
  if ((input.split === undefined || input.split === SplitStructure.AUTO)
    && decision.reasons.length === 1 && decision.reasons[0].code === 'template-overlap-count') {
    const repairedSessions = candidate.distribution.sessions.map((session) => ({ ...session, exercises: [...session.exercises] }));
    if (repairSessionAllocation(repairedSessions, MIN_HYPERTROPHY_SESSION_SETS,
      candidate.availableWorkMinutesPerSession, input.previousSession, true)) {
      const adjusted = refreshPlacement(candidate, repairedSessions, input.previousSession);
      const proposed = evaluatePolicyPromotion(input, baseline, adjusted, policy);
      if (proposed.accepted) { candidate = adjusted; decision = proposed; }
    }
  }
  if ((input.split === undefined || input.split === SplitStructure.AUTO)
    && decision.reasons.length === 1 && decision.reasons[0].code === 'template-overlap-count') {
    const original = candidate.distribution.sessions;
    // AUTO owns its sequence. Keep complete sessions/doses and try alternative
    // orders before rejecting otherwise admissible work for template overlap.
    const visit = (order: number[], remaining: number[]): boolean => {
      if (remaining.length) {
        for (const index of remaining) if (visit([...order, index], remaining.filter((entry) => entry !== index))) return true;
        return false;
      }
      const sessions = order.map((index, position) => ({ ...original[index], index: position }));
      const sequencingWarnings = sessionSequencingWarnings(sessions, input.previousSession);
      if (sequencingWarnings.length > candidate.distribution.sequencingWarnings.length) return false;
      const adjusted = { ...refreshPlacement(candidate, sessions, input.previousSession), distribution: { ...candidate.distribution, sessions, sequencingWarnings,
        structureWarnings: candidate.distribution.structureWarnings.map((warning) => warning.sessionIndex === undefined
          ? warning : { ...warning, sessionIndex: order.indexOf(warning.sessionIndex),
            detail: `${warning.kind}: session ${order.indexOf(warning.sessionIndex)}; ${warning.detail}` }) } };
      const proposed = evaluatePolicyPromotion(input, baseline, adjusted, policy);
      if (!proposed.accepted) return false;
      candidate = adjusted; decision = proposed; return true;
    };
    if (original.length <= 6) visit([], original.map((_, index) => index));
  }
  return { ...(decision.accepted ? candidate : baseline), policyTrace: [...(baseline.policyTrace ?? []), decision] };
}

export function refreshPlacement(plan: MesocyclePlan, sessions: SessionDistribution['sessions'], previous?: readonly SessionExercise[],
  evaluateSequencing = sessionSequencingWarnings): MesocyclePlan {
  const missing = missingRequiredPatterns(plan.selection, plan.plan);
  if (missing.join(',') !== plan.selection.missingFoundationalPatterns.join(',')) {
    plan = { ...plan, selection: { ...plan.selection, missingFoundationalPatterns: missing } };
  }
  const frequencyByMuscle: SessionDistribution['frequencyByMuscle'] = {};
  sessions.forEach((session) => {
    session.exercises = orderSessionExercises(session.exercises, plan.plan.muscles.filter((muscle) => muscle.emphasis === RegionEmphasis.PRIORITY).map((muscle) => muscle.muscle));
    new Set(session.exercises.map((entry) => entry.exercise.primaryMuscle)).forEach((muscle) => {
      frequencyByMuscle[muscle] = (frequencyByMuscle[muscle] ?? 0) + 1;
    });
  });
  const minutes = sessions.map((session) => session.estimatedWorkMinutes);
  const maxSessionWorkMinutes = Math.max(...minutes);
  const totalWorkMinutes = minutes.reduce((sum, value) => sum + value, 0);
  const structureWarnings = plan.distribution.structureWarnings.filter((warning) => warning.kind !== 'unbalanced-load'
    && !(warning.kind === 'single-frequency' && warning.muscle && (frequencyByMuscle[warning.muscle] ?? 0) >= 2));
  const minSessionWorkMinutes = Math.min(...minutes);
  if (maxSessionWorkMinutes - minSessionWorkMinutes > totalWorkMinutes / sessions.length * 0.45) {
    structureWarnings.push({ kind: 'unbalanced-load', detail: `Session work ranges from ${minSessionWorkMinutes} to ${maxSessionWorkMinutes} minutes.` });
  }
  return { ...plan, maxSessionWorkMinutes, estimatedWorkMinutes: totalWorkMinutes,
    distribution: { ...plan.distribution, sessions, frequencyByMuscle, maxSessionWorkMinutes, structureWarnings,
      minSessionWorkMinutes, totalWorkMinutes,
      sequencingWarnings: evaluateSequencing(sessions, previous) } };
}

function planWithPolicy(input: MesocyclePlanInput): MesocyclePlan {
  if (!Number.isInteger(input.capacity.sessionsPerMicrocycle) || input.capacity.sessionsPerMicrocycle < 0
    || !Number.isFinite(input.capacity.minutesPerSession) || input.capacity.minutesPerSession < 0
    || !Number.isFinite(input.seed)) throw new RangeError('Invalid training capacity or seed');
  // Strength prescribes its lifts instead of drawing them (§3.7).
  if (input.goal === TrainingGoal.STRENGTH) {
    const result = planStrengthMesocycle(input);
    return result.selection.performedSets === 0 ? { ...result, limitedBy: 'catalogue' } : result;
  }
  const {
    capacity,
    catalogue,
    seed,
    rankingPolicy,
    deterministicDose,
    allocationAlternative,
    split = SplitStructure.AUTO,
    previousSession,
    ...planInput
  } = input;
  const uncappedPlan = buildVolumePlan(planInput);
  const availableWorkMinutes = workMinutesAvailable(capacity);
  const availableWorkMinutesPerSession = Math.max(
    0,
    capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES,
  );
  type Evaluation = { plan: VolumePlan; selection: SelectionResult; distribution: SessionDistribution; fitsCapacity: boolean };
  // Different squeeze fractions often round to exactly the same volume plan.
  // Reuse only identical full plans and selection modes within this invocation.
  // No mutable catalogue or athlete state is cached across generator calls.
  const evaluations = new Map<string, Evaluation>();
  const evaluate = (squeeze: number, timeConstrained = squeeze > 0) => {
    const plan = squeezePlan(uncappedPlan, squeeze);
    const key = JSON.stringify([timeConstrained, plan]);
    const cached = evaluations.get(key);
    if (cached) return cached;
    const selection = selectExercises({
      volumePlan: plan,
      catalogue,
      seed,
      rankingPolicy,
      timeConstrained,
      deterministic: deterministicDose,
      deterministicAlternative: allocationAlternative,
    });
    const distribution = distributeSelection({
      selection,
      split,
      sessionsPerMicrocycle: capacity.sessionsPerMicrocycle,
      previousSession,
      maxWorkMinutesPerSession: availableWorkMinutesPerSession,
      minimumSessionSets: MIN_HYPERTROPHY_SESSION_SETS,
      // Deprioritized muscles are exempt from the frequency-2 target: splitting
      // maintenance volume over two sessions buys almost no stimulus and costs a
      // second setup.
      deprioritizedMuscles: plan.muscles
        .filter((muscle) => muscle.emphasis === RegionEmphasis.DEPRIORITIZED)
        .map((muscle) => muscle.muscle),
    });
    const fitsCapacity =
      distribution.unassigned.length === 0 &&
      distribution.sessions.every(
        (session) => session.estimatedWorkMinutes <= availableWorkMinutesPerSession,
      );
    const result = { plan, selection, distribution, fitsCapacity };
    evaluations.set(key, result);
    return result;
  };

  const unsqueezed = evaluate(0);
  if (unsqueezed.fitsCapacity) {
    // El tiempo sobra: limita la recuperación, que es el caso que ya resolvía
    // `volumePlan`.
    return {
      plan: unsqueezed.plan,
      uncappedPlan,
      selection: unsqueezed.selection,
      distribution: unsqueezed.distribution,
      limitedBy: unsqueezed.selection.performedSets === 0 && uncappedPlan.muscles.some((m) => m.meav > 0)
        ? 'catalogue' : 'recovery',
      squeeze: 0,
      estimatedWorkMinutes: unsqueezed.distribution.totalWorkMinutes,
      availableWorkMinutes,
      maxSessionWorkMinutes: unsqueezed.distribution.maxSessionWorkMinutes,
      availableWorkMinutesPerSession,
    };
  }

  const fullySqueezed = evaluate(MAX_SQUEEZE);
  if (!fullySqueezed.fitsCapacity) {
    // Ni en mantenimiento cabe. Se devuelve el plan mínimo y se dice por qué, en
    // lugar de recortar por debajo del mantenimiento: eso ya no sería entrenar.
    return {
      plan: fullySqueezed.plan,
      uncappedPlan,
      selection: fullySqueezed.selection,
      distribution: fullySqueezed.distribution,
      limitedBy: 'insufficient-time',
      squeeze: MAX_SQUEEZE,
      estimatedWorkMinutes: fullySqueezed.distribution.totalWorkMinutes,
      availableWorkMinutes,
      maxSessionWorkMinutes: fullySqueezed.distribution.maxSessionWorkMinutes,
      availableWorkMinutesPerSession,
    };
  }

  const templateWarnings = (candidate: Evaluation) => workloadTemplateRecovery(candidate.distribution.sessions.map((session) => {
    const directSets = new Map<string, number>();
    session.exercises.forEach((entry) => directSets.set(entry.exercise.primaryMuscle,
      (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets));
    return { index: session.index, directSets };
  })).filter((pair) => pair.reviewSuggested).length;
  const defects = (candidate: Evaluation) => candidate.distribution.structureWarnings.filter(
    (warning) => warning.kind === 'empty-session' || warning.kind === 'underfilled-session'
      || warning.kind === 'session-volume-cap',
  ).length;

  // Bisección del recorte MÍNIMO que cabe: se cede el volumen justo y no más.
  const minimalFit = (fullySqueezedFit: Evaluation, timeConstrained: boolean) => {
    let low = 0;
    let high = MAX_SQUEEZE;
    let best = fullySqueezedFit;
    let bestSqueeze = MAX_SQUEEZE;

    for (let step = 0; step < SQUEEZE_SEARCH_STEPS; step += 1) {
      const middle = (low + high) / 2;
      const candidate = evaluate(middle, timeConstrained);
      if (candidate.fitsCapacity) {
        best = candidate;
        bestSqueeze = middle;
        high = middle;
      } else {
        low = middle;
      }
    }

    // Exercise identities and integer set counts make feasibility discontinuous.
    // Bisection alone can skip a feasible pocket; retain its result and inspect
    // the earlier range without assuming that every larger plan is infeasible.
    const searchLimit = bestSqueeze;
    for (let step = 1; step < 16; step += 1) {
      const squeeze = searchLimit * step / 16;
      const candidate = evaluate(squeeze, timeConstrained);
      if (!candidate.fitsCapacity || defects(candidate) > defects(best)) continue;
      if (candidate.selection.performedSets >= best.selection.performedSets && squeeze < bestSqueeze) {
        best = candidate;
        bestSqueeze = squeeze;
      }
    }
    // A near-zero feasible pocket can contain fewer sets than a later one.
    // Search the whole target range: integer dose and roster changes invalidate
    // the monotonicity assumption behind bisection.
    const shortfall = (candidate: Evaluation) => uncappedPlan.muscles.reduce((sum, muscle) =>
      sum + Math.max(0, muscle.meav - (candidate.selection.attributedByMuscle[muscle.muscle] ?? 0)), 0);
    for (let step = 1; step < 16; step += 1) {
      const squeeze = MAX_SQUEEZE * step / 16;
      const candidate = evaluate(squeeze, timeConstrained);
      if (!candidate.fitsCapacity || defects(candidate) > defects(best)
        || candidate.distribution.sequencingWarnings.length > best.distribution.sequencingWarnings.length
        || (input.rankingPolicy === 'legacy-weighted' && templateWarnings(candidate) > templateWarnings(best))) continue;
      if (candidate.selection.performedSets > best.selection.performedSets && shortfall(candidate) <= shortfall(best)) {
        best = candidate;
        bestSqueeze = squeeze;
      }
    }
    return { best, bestSqueeze };
  };

  let { best, bestSqueeze } = minimalFit(fullySqueezed, true);
  // A per-session overshoot of a few minutes is not a shortage of total time.
  // Time-efficiency selection can then discard far more volume than the
  // overshoot, so the ordinary selector competes under a minimal target squeeze.
  const unmet = (candidate: Evaluation) => uncappedPlan.muscles.reduce((sum, m) =>
    sum + Math.max(0, m.meav - (candidate.selection.attributedByMuscle[m.muscle] ?? 0)), 0);
  const ordinarySqueezed = evaluate(MAX_SQUEEZE, false);
  if (ordinarySqueezed.fitsCapacity) {
    const ordinary = minimalFit(ordinarySqueezed, false);
    const closer = unmet(ordinary.best) < unmet(best) || (unmet(ordinary.best) === unmet(best)
      && ordinary.best.selection.performedSets > best.selection.performedSets);
    if (closer && defects(ordinary.best) <= defects(best)) ({ best, bestSqueeze } = ordinary);
  }

  return {
    plan: best.plan,
    uncappedPlan,
    selection: best.selection,
    distribution: best.distribution,
    limitedBy: 'time',
    squeeze: bestSqueeze,
    estimatedWorkMinutes: best.distribution.totalWorkMinutes,
    availableWorkMinutes,
    maxSessionWorkMinutes: best.distribution.maxSessionWorkMinutes,
    availableWorkMinutesPerSession,
  };
}
