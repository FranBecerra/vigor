/**
 * Analítica Ponderada por Grupo Muscular.
 * Fuente de verdad: PRD.md §6 (modelo 3), §3.2 (MPI y e1RM ponderado),
 * §3.3 (triggers de descarga).
 */
import type { MuscleGroup } from './biomechanics';

/** Estado de adaptación de un grupo muscular (PRD §6 modelo 3). */
export type MuscleGroupStatus = 'PROGRESSING' | 'STAGNANT' | 'REGRESSING';

/**
 * Analítica de un grupo muscular dentro del mesociclo (PRD §3.2, §6 modelo 3).
 * currentMPI = MPI_Grupo (%) = sum(w_i * Δe1RM_i) / sum(w_i)  (PRD §3.2.3).
 */
export interface MuscleGroupAnalytics {
  id: string;
  muscleGroup: MuscleGroup;
  /** Índice de Progreso Muscular relativo (%) (PRD §3.2.3). */
  currentMPI: number;
  /** exerciseId -> e1RM inicial (mejor marca de microciclos iniciales del bloque) (PRD §3.2.1). */
  baselineE1RM: Record<string, number>;
  /** exerciseId -> e1RM de la última sesión. */
  currentE1RM: Record<string, number>;
  /** exerciseId -> peso biomecánico w_i (0.50 / 0.35 / 0.15) (PRD §3.2.2). */
  exerciseWeights: Record<string, number>;
  /** Contador de microciclos planos consecutivos para el stall detection (PRD §3.3.1). */
  consecutiveFlatMicrocycles: number;
  status: MuscleGroupStatus;
}

/**
 * Causa que dispara una descarga automática (PRD §3.3).
 * STALL = MPI<=0% 2 semanas + recovery bajo/fatiga alta.
 * SAFETY_OVERRIDE = dolor articular EVA>4.
 * MANUAL_ABORT = interrupción por el usuario.
 */
export type DeloadTrigger = 'STALL' | 'SAFETY_OVERRIDE' | 'MANUAL_ABORT';
