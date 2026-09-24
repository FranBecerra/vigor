/**
 * Usuario, biomarcadores de salud y despliegue social.
 * Fuente de verdad: PRD.md §2.3 (wearables), §5.2 (perfil dietético), §7 (privacidad).
 */
import type { DietaryProfile } from './nutrition';
import type { Timestampish } from './common';

/** Perfil del atleta. */
export interface UserProfile {
  id: string;
  displayName: string;
  dietaryProfile: DietaryProfile;
  bodyWeightKg?: number;
  age?: number;
  createdAt: Timestampish;
}

/**
 * Biomarcadores clínicos (PRD §2.3, §7).
 * Vive en PrivateHealthData: subcolección blindada por reglas de seguridad,
 * inaccesible desde el exterior (PRD §7).
 */
export interface PrivateHealthData {
  id: string;
  userId: string;
  /** Frecuencia cardíaca en reposo (bpm). */
  restingHeartRate?: number;
  /** Variabilidad de la frecuencia cardíaca (ms) — SDNN/rMSSD (PRD §2.3). */
  hrv?: number;
  vo2max?: number;
  recordedAt: Timestampish;
}

/**
 * Evento público opcional del feed social (PRD §7).
 * Solo comparte volumen, ejercicios y marcas de e1RM. Nunca biomarcadores.
 */
export interface FeedEvent {
  id: string;
  userId: string;
  type: 'E1RM_PR' | 'VOLUME_MILESTONE' | 'MESOCYCLE_COMPLETED';
  payload: Record<string, number | string>;
  createdAt: Timestampish;
}
