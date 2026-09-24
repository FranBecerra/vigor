/**
 * Coach de Readiness (PRD §8.3).
 *
 * Combina sueño + HRV + RHR (y su tendencia) en un "estado de hoy" con
 * recomendación de carga, al estilo Bevel. Alimenta y puede reforzar los
 * triggers de deload (§3.3). Lógica pura y testeable (objetivo 100% cobertura).
 */
import type { Timestampish } from './common';

/** Recomendación de carga para hoy según el estado del atleta. */
export enum LoadRecommendation {
  /** Empujar: buen estado, se puede subir carga/intensidad. */
  PUSH = 'PUSH',
  /** Mantener el plan tal cual. */
  MAINTAIN = 'MAINTAIN',
  /** Reducir: fatiga/mala recuperación, bajar volumen o intensidad. */
  REDUCE = 'REDUCE',
  /** Descansar: estado muy pobre, priorizar recuperación. */
  REST = 'REST',
}

/**
 * Estado de readiness calculado para un día.
 * `score` 0-100 resume la disposición del atleta; los inputs se guardan para
 * trazabilidad y para que el coach explique el porqué.
 */
export interface ReadinessScore {
  id: string;
  userId: string;
  /** Día al que corresponde (inicio del día). */
  date: Timestampish;
  /** Puntuación 0-100. */
  score: number;
  recommendation: LoadRecommendation;
  /** Inputs normalizados (0-1) que alimentaron el cálculo, para explicabilidad. */
  inputs: {
    sleepScore?: number;
    hrvScore?: number;
    rhrScore?: number;
    /** Tendencia reciente (p. ej. HRV subiendo/bajando), -1..1. */
    trend?: number;
  };
  /** Texto corto que el coach muestra al usuario. */
  message?: string;
  createdAt: Timestampish;
}
