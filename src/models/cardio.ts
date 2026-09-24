/**
 * Entrenamiento de Cardio (PRD §8.4).
 *
 * Dominio separado de la fuerza: NO computa en el MPI (que es específico de
 * e1RM/fuerza). Tiene su propio conjunto de métricas y su volumen semanal.
 * Se planifica y ejecuta desde la sección Entrenar.
 */
import type { Timestampish } from './common';

/** Modalidad de cardio. */
export enum CardioType {
  RUNNING = 'RUNNING',
  CYCLING = 'CYCLING',
  ROWING = 'ROWING',
  ELLIPTICAL = 'ELLIPTICAL',
  SWIMMING = 'SWIMMING',
  WALKING = 'WALKING',
  HIIT = 'HIIT',
  OTHER = 'OTHER',
}

/** Zona de frecuencia cardíaca (modelo clásico de 5 zonas). */
export enum HeartRateZone {
  Z1 = 'Z1', // recuperación
  Z2 = 'Z2', // aeróbico base
  Z3 = 'Z3', // tempo
  Z4 = 'Z4', // umbral
  Z5 = 'Z5', // VO2max / anaeróbico
}

/**
 * Sesión de cardio ejecutada o planificada.
 * Los campos target* son la pauta; los actual* el registro real (paralelo a
 * WorkoutSet en fuerza).
 */
export interface CardioSession {
  id: string;
  userId: string;
  mesocycleId: string;
  microcycleId: string;
  microcycleIndex: number;
  type: CardioType;
  /** Duración objetivo y real en minutos. */
  targetDurationMin: number;
  actualDurationMin?: number;
  /** Distancia en km (opcional, según modalidad). */
  targetDistanceKm?: number;
  actualDistanceKm?: number;
  /** Zona de FC objetivo principal de la sesión. */
  targetZone?: HeartRateZone;
  /** Minutos reales por zona de FC (para el desglose de volumen). */
  minutesPerZone?: Partial<Record<HeartRateZone, number>>;
  /** Gasto energético estimado (kcal). */
  estimatedKcal?: number;
  averageHeartRate?: number;
  performedAt: Timestampish;
  completedAt?: Timestampish;
}

/**
 * Volumen semanal PLANIFICADO por microciclo (PRD §8.1).
 * Métricas del entrenamiento pautado, distinto del histórico ejecutado.
 */
export interface WeeklyVolumePlan {
  id: string;
  userId: string;
  mesocycleId: string;
  microcycleId: string;
  microcycleIndex: number;
  /** Fuerza: series planificadas por grupo muscular (MuscleGroup -> nº series). */
  strengthSetsPerGroup: Record<string, number>;
  /** Cardio: minutos planificados por modalidad (CardioType -> minutos). */
  cardioMinutesByType: Partial<Record<CardioType, number>>;
}
