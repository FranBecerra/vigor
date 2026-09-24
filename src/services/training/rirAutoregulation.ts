/**
 * Autorregulación científica (Matriz RIR) y Fatigue Auto-fill — PRD §3.4.
 *
 * RIR = Reps In Reserve (repeticiones en recámara). Menor RIR = más cerca del fallo.
 *
 * Matriz por perfil biomecánico:
 *  - COMPOUND_PRIMARY (axiales: sentadilla, peso muerto, remo libre):
 *      inicio RIR 3, tope rutinario RIR 2. RIR 1-0 SOLO en la serie final de la
 *      última semana previa a la descarga (protege el SNC).
 *  - COMPOUND_SECONDARY (máquinas multiarticulares: prensas, jalones):
 *      inicio RIR 2, progresa a RIR 1-0 en semanas finales.
 *  - ISOLATION (aislamiento): inicio RIR 2, progresión rutinaria hasta el fallo (RIR 0).
 *
 * Funciones puras (objetivo 100% cobertura).
 */
import { ExerciseProfile } from '@/models';

export interface RIRPrescription {
  /** RIR de inicio del bloque. */
  start: number;
  /** RIR mínimo permitido en rutina normal. */
  routineFloor: number;
  /** RIR mínimo absoluto (solo en condiciones especiales, p.ej. serie final pre-deload). */
  peakFloor: number;
}

const RIR_MATRIX: Record<ExerciseProfile, RIRPrescription> = {
  [ExerciseProfile.COMPOUND_PRIMARY]: { start: 3, routineFloor: 2, peakFloor: 0 },
  [ExerciseProfile.COMPOUND_SECONDARY]: { start: 2, routineFloor: 1, peakFloor: 0 },
  [ExerciseProfile.ISOLATION]: { start: 2, routineFloor: 0, peakFloor: 0 },
};

/** Devuelve la prescripción RIR para un perfil. */
export function rirPrescription(profile: ExerciseProfile): RIRPrescription {
  return RIR_MATRIX[profile];
}

/**
 * RIR objetivo para una serie dada.
 * @param profile perfil del ejercicio
 * @param isFinalSetBeforeDeload true si es la serie final de la última semana
 *   previa a la descarga (permite alcanzar peakFloor en axiales)
 */
export function targetRIR(profile: ExerciseProfile, isFinalSetBeforeDeload = false): number {
  const p = RIR_MATRIX[profile];
  return isFinalSetBeforeDeload ? p.peakFloor : p.routineFloor;
}

export interface AutoFillInput {
  /** Carga pautada (kg). */
  plannedWeight: number;
  /** Reps pautadas. */
  plannedReps: number;
  /** Reps realmente logradas en la serie anterior (si el rendimiento decayó). */
  achievedReps: number;
}

export interface AutoFillSuggestion {
  suggestedWeight: number;
  suggestedReps: number;
  /** true si se sugiere un ajuste a la baja (rendimiento por debajo del pautado). */
  isDownAdjusted: boolean;
}

/**
 * Fatigue Auto-fill (PRD §3.4): si el rendimiento decae respecto al pautado,
 * sugiere un ajuste a la baja para la siguiente serie (un solo tap de confirmación).
 *
 * Heurística: si las reps logradas quedaron por debajo de las pautadas, se
 * reduce la carga un 5% (redondeado a 0.5kg) y se mantiene el objetivo de reps.
 * Si se cumplió o superó, no se ajusta.
 */
export function fatigueAutoFill(input: AutoFillInput): AutoFillSuggestion {
  if (!Number.isFinite(input.plannedWeight) || input.plannedWeight <= 0) {
    throw new Error('fatigueAutoFill: plannedWeight debe ser > 0');
  }
  if (!Number.isInteger(input.plannedReps) || input.plannedReps < 1) {
    throw new Error('fatigueAutoFill: plannedReps debe ser entero >= 1');
  }
  if (!Number.isInteger(input.achievedReps) || input.achievedReps < 0) {
    throw new Error('fatigueAutoFill: achievedReps debe ser entero >= 0');
  }

  if (input.achievedReps >= input.plannedReps) {
    return {
      suggestedWeight: input.plannedWeight,
      suggestedReps: input.plannedReps,
      isDownAdjusted: false,
    };
  }

  // Rendimiento por debajo: bajar carga 5%, redondear a 0.5kg.
  const reduced = Math.round(input.plannedWeight * 0.95 * 2) / 2;
  return {
    suggestedWeight: reduced,
    suggestedReps: input.plannedReps,
    isDownAdjusted: true,
  };
}
