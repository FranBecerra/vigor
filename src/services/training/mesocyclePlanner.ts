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
import { SplitStructure, type Exercise } from '@/models';
import {
  MAX_SQUEEZE,
  RegionEmphasis,
  buildVolumePlan,
  squeezePlan,
  type VolumePlan,
  type VolumePlanInput,
} from './volumePlan';
import { selectExercises, directVolumeFloor, type RankingPolicy, type SelectionResult } from './exerciseSelection';
import { criteriaOf } from './exerciseCatalogue';
import {
  SESSION_OVERHEAD_MINUTES,
  workMinutesAvailable,
  type TrainingCapacity,
} from './trainingCapacity';
import { planStrengthMesocycle, type StrengthProgramReport } from './strengthProgram';
import { TrainingGoal } from './volumePlan';
import { workloadTemplateRecovery } from './scheduleTemplate';
import {
  distributeSelection,
  sessionSequencingWarnings,
  repairSessionAllocation,
  orderSessionExercises,
  MIN_HYPERTROPHY_SESSION_SETS,
  type SessionDistribution,
  type SessionExercise,
} from './sessionDistribution';

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

/** Promote the coupled candidate only when it preserves the baseline constraints. */
export function planMesocycle(input: MesocyclePlanInput): MesocyclePlan {
  if ((input.rankingPolicy !== undefined && input.rankingPolicy !== 'coupled-control')
    || input.goal !== TrainingGoal.HYPERTROPHY) return planWithPolicy(input);
  const baseline = planWithPolicy({ ...input, rankingPolicy: 'legacy-weighted' });
  const candidate = planWithPolicy({ ...input, rankingPolicy: 'volume-aware' });
  const incumbent = promoteCandidate(input, baseline, candidate, 'volume-aware');
  if (input.rankingPolicy === 'coupled-control') return incumbent;
  let best = promoteCandidate(input, incumbent, planWithPolicy({ ...input, rankingPolicy: 'accessory-aware' }), 'accessory-aware');
  if (best.limitedBy === 'time') {
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

export interface PolicyPromotionDecision {
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

function refreshPlacement(plan: MesocyclePlan, sessions: SessionDistribution['sessions'], previous?: readonly SessionExercise[]): MesocyclePlan {
  const frequencyByMuscle: SessionDistribution['frequencyByMuscle'] = {};
  sessions.forEach((session) => {
    session.exercises = orderSessionExercises(session.exercises);
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
      sequencingWarnings: sessionSequencingWarnings(sessions, previous) } };
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
