/**
 * Métricas agregadas de una sesión por microciclo — LÓGICA PURA (PRD §8.7).
 *
 * La vista del mesociclo no debe mezclar segmentos de ejercicios distintos: una
 * columna de 19 cuadrados no explica nada. Esta capa resume cada sesión con
 * dos señales que sí se pueden comparar de un vistazo:
 *
 *  - VOLUMEN: series de trabajo planificadas.
 *  - INTENSIDAD: RIR objetivo MEDIO, ponderado por series.
 *
 * Los ejercicios detallados siguen debajo del gráfico; este módulo nunca los
 * aplana visualmente ni les atribuye un significado que no tienen.
 */
import { countWorkingSets, type PlannedExercise } from './sessionSummary';

/** Un microciclo reducido a las decisiones que afectan su prescripción. */
export interface MicrocyclePrescription<TSession> {
  id: string;
  number: number;
  sessions: readonly TSession[];
  isDeload: boolean;
  isProjected: boolean;
  /** Variación de series frente a la estructura base de la sesión. */
  volumeAdjustmentSets: number;
  /** Variación de RIR frente a la estructura base; negativo = más intensidad. */
  intensityAdjustmentRIR: number;
}

/** Métrica que pinta una única columna del gráfico. */
export interface SessionMicrocycleMetric {
  id: string;
  number: number;
  isDeload: boolean;
  isProjected: boolean;
  volumeSets: number;
  averageRIR: number;
}

/** RIR objetivo medio, ponderado por las series de trabajo de cada ejercicio. */
export function averageTargetRIR(exercises: readonly PlannedExercise[]): number {
  let weightedRIR = 0;
  let workingSets = 0;

  for (const exercise of exercises) {
    const count = countWorkingSets(exercise.sets);
    weightedRIR += exercise.targetRIR * count;
    workingSets += count;
  }

  return workingSets === 0 ? 0 : weightedRIR / workingSets;
}

/** Acota y redondea el RIR de presentación a un decimal. */
export function clampRIR(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(5, Math.max(0, value)) * 10) / 10;
}

/**
 * Construye las métricas de una sesión a lo largo del mesociclo.
 *
 * Si un microciclo no contiene la sesión seleccionada (datos incompletos), se
 * emite volumen 0 y RIR 0 en lugar de inventar datos.
 */
export function sessionMicrocycleMetrics<TSession extends { exercises: readonly PlannedExercise[] }>(
  microcycles: readonly MicrocyclePrescription<TSession>[],
  sessionIndex: number,
): SessionMicrocycleMetric[] {
  return microcycles.map((microcycle) => {
    const session = microcycle.sessions[sessionIndex];
    const baseVolume = session ? session.exercises.reduce(
      (sum, exercise) => sum + countWorkingSets(exercise.sets),
      0,
    ) : 0;
    const baseRIR = session ? averageTargetRIR(session.exercises) : 0;

    return {
      id: microcycle.id,
      number: microcycle.number,
      isDeload: microcycle.isDeload,
      isProjected: microcycle.isProjected,
      volumeSets: Math.max(0, baseVolume + microcycle.volumeAdjustmentSets),
      averageRIR: clampRIR(baseRIR + microcycle.intensityAdjustmentRIR),
    };
  });
}

/** Mayor volumen de una serie de métricas; mínimo 1 para no dividir por cero. */
export function maxVolume(metrics: readonly SessionMicrocycleMetric[]): number {
  return Math.max(1, ...metrics.map((metric) => metric.volumeSets));
}
