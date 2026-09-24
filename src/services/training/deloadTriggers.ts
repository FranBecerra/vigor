/**
 * Triggers de descarga (Deload) — PRD §3.3.
 *
 * El sistema fuerza una descarga (Volumen −50%, Carga 85-90%, RIR +3/4) bajo:
 *  1. STALL: durante 2 microciclos consecutivos el MPI ≤ 0% de forma
 *     generalizada, combinado con Recovery Score < 5 o Fatigue Score alto.
 *  2. SAFETY_OVERRIDE: dolor articular EVA > 4 en la sesión.
 *  3. MANUAL_ABORT: el usuario lo solicita.
 *
 * Funciones puras (objetivo 100% cobertura).
 */
import type { DeloadTrigger } from '@/models';

/** Umbrales configurables del deload (PRD §3.3). */
export const DELOAD_THRESHOLDS = {
  /** Microciclos planos consecutivos que disparan el stall. */
  flatMicrocycles: 2,
  /** Recovery Score por debajo del cual el stall se confirma. */
  lowRecovery: 5,
  /** Fatigue Score por encima del cual se considera alto. */
  highFatigue: 7,
  /** Dolor EVA por encima del cual salta el safety override. */
  painEVA: 4,
} as const;

export interface DeloadEvaluationInput {
  /** Microciclos consecutivos con MPI ≤ 0% (contador de stall). */
  consecutiveFlatMicrocycles: number;
  /** Recovery Score del último check-in (1-10). */
  recoveryScore: number;
  /** Fatigue Score del último check-in. */
  fatigueScore: number;
  /** Peor dolor EVA reportado en la sesión (0-10). */
  maxPainEVA: number;
  /** El usuario ha pulsado "abortar". */
  manualAbort: boolean;
}

/**
 * Evalúa si debe dispararse un deload y por qué causa.
 * Prioridad: SAFETY_OVERRIDE (seguridad) > MANUAL_ABORT > STALL.
 * Devuelve el trigger, o null si no procede.
 */
export function evaluateDeload(input: DeloadEvaluationInput): DeloadTrigger | null {
  // 1. Seguridad primero: dolor articular por encima del umbral.
  if (input.maxPainEVA > DELOAD_THRESHOLDS.painEVA) {
    return 'SAFETY_OVERRIDE';
  }
  // 2. Aborto manual del usuario.
  if (input.manualAbort) {
    return 'MANUAL_ABORT';
  }
  // 3. Estancamiento: 2+ microciclos planos + recuperación baja o fatiga alta.
  const stalled = input.consecutiveFlatMicrocycles >= DELOAD_THRESHOLDS.flatMicrocycles;
  const poorlyRecovered =
    input.recoveryScore < DELOAD_THRESHOLDS.lowRecovery ||
    input.fatigueScore >= DELOAD_THRESHOLDS.highFatigue;
  if (stalled && poorlyRecovered) {
    return 'STALL';
  }
  return null;
}
