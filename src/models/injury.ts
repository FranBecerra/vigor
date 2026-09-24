/**
 * Sistema Clínico de Lesiones y Rehabilitación.
 * Fuente de verdad: PRD.md §6 (modelo 4), §4 (protocolo de readaptación).
 */
import type { MovementVector, MuscleGroup } from './biomechanics';
import type { Timestampish } from './common';

/**
 * Fases del protocolo de readaptación (PRD §4.1):
 * ACUTE      -> veto absoluto del vector afectado.
 * SUBACUTE   -> veto dinámico; solo isométrico analítico prescrito.
 * REHAB      -> reintroducción progresiva (tempos lentos, excéntricas controladas).
 * RESOLVED   -> volumen estándar + monitorización pasiva durante 2 mesociclos.
 */
export enum InjuryPhase {
  ACUTE = 'ACUTE',
  SUBACUTE = 'SUBACUTE',
  REHAB = 'REHAB',
  RESOLVED = 'RESOLVED',
}

export interface InjuryTracker {
  id: string;
  userId: string;
  /** Articulación afectada, ej. "Codo Izquierdo" (PRD §6 modelo 4). */
  articulation: string;
  currentPhase: InjuryPhase;
  /** Vectores de movimiento vetados mientras dure la fase (PRD §4.1). */
  bannedVectors: MovementVector[];
  /** Grupos musculares asociados a la articulación, para el veto/swap. */
  affectedMuscles: MuscleGroup[];
  /** Último dolor reportado en escala EVA 0-10 (PRD §4.2). */
  latestPainScore: number;
  /** Índice del mesociclo en el que se resolvió, para la monitorización pasiva (PRD §4.1). */
  resolvedAtMesocycleIndex?: number;
  createdAt: Timestampish;
  updatedAt: Timestampish;
}

/**
 * Bloque de rehabilitación pre/post-workout (PRD §4.2).
 * NO computa en el volumen semanal de hipertrofia. Opt-in, saltable en 1 tap.
 */
export interface RehabRoutine {
  id: string;
  userId: string;
  injuryId: string;
  placement: 'PRE_WORKOUT' | 'POST_WORKOUT';
  exerciseIds: string[];
}

/**
 * Registro de dolor EVA (PRD §4.2). Se dispara el modal "1 tap" tras entrenar
 * una articulación AGUDA/SUBAGUDA o completar una RehabRoutine.
 */
export interface PainLog {
  id: string;
  userId: string;
  injuryId: string;
  sessionId?: string;
  /** EVA 0-10. */
  painScore: number;
  createdAt: Timestampish;
}