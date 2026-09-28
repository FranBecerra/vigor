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
import { selectExercises, type SelectionResult } from './exerciseSelection';
import {
  SESSION_OVERHEAD_MINUTES,
  workMinutesAvailable,
  type TrainingCapacity,
} from './trainingCapacity';
import { planStrengthMesocycle, type StrengthProgramReport } from './strengthProgram';
import { TrainingGoal } from './volumePlan';
import {
  distributeSelection,
  type SessionDistribution,
  type SessionExercise,
} from './sessionDistribution';

/** Qué techo ha limitado el volumen del plan. */
export type LimitingFactor =
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
  /** Athlete-selected structure; AUTO resolves from their session count. */
  split?: SplitStructure;
  /** Optional last completed/planned session, used to avoid immediate overlap. */
  previousSession?: readonly SessionExercise[];
}

/** Pasos de la bisección. Diez dan una precisión de recorte de 0,002. */
const SQUEEZE_SEARCH_STEPS = 10;

export function planMesocycle(input: MesocyclePlanInput): MesocyclePlan {
  // Strength prescribes its lifts instead of drawing them (§3.7).
  if (input.goal === TrainingGoal.STRENGTH) return planStrengthMesocycle(input);
  const {
    capacity,
    catalogue,
    seed,
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

  const evaluate = (squeeze: number) => {
    const plan = squeezePlan(uncappedPlan, squeeze);
    const selection = selectExercises({
      volumePlan: plan,
      catalogue,
      seed,
      timeConstrained: squeeze > 0,
    });
    const distribution = distributeSelection({
      selection,
      split,
      sessionsPerMicrocycle: capacity.sessionsPerMicrocycle,
      previousSession,
      maxWorkMinutesPerSession: availableWorkMinutesPerSession,
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
    return { plan, selection, distribution, fitsCapacity };
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
      limitedBy: 'recovery',
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

  // Bisección del recorte MÍNIMO que cabe: se cede el volumen justo y no más.
  let low = 0;
  let high = MAX_SQUEEZE;
  let best = fullySqueezed;
  let bestSqueeze = MAX_SQUEEZE;

  for (let step = 0; step < SQUEEZE_SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    const candidate = evaluate(middle);
    if (candidate.fitsCapacity) {
      best = candidate;
      bestSqueeze = middle;
      high = middle;
    } else {
      low = middle;
    }
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
