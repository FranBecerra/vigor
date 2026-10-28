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

/** Modality-specific self-report; never inferred from a strength experience label. */
export type CardioPlanningModality = 'RUNNING' | 'CYCLING' | 'MACHINE';
export type CardioExperienceStatus = 'NEW' | 'RETURNING' | 'REGULAR' | 'UNSURE';
export type CardioQualityExposure = 'CURRENTLY_TOLERATED' | 'NOT_TOLERATED' | 'UNKNOWN';

export interface CardioModalityProfile {
  status: CardioExperienceStatus;
  /** User-reported recent consistent weeks, if known. */
  consistentWeeks?: number;
  /** User-reported current sessions per week in this modality, if known. */
  sessionsPerWeek?: number;
  /** Typical tolerated session duration in minutes, if known. */
  typicalSessionMinutes?: number;
  /** Running only; maximum single-run distance in the recent 30-day period, if known. */
  recentLongestRunKm?: number;
  /** Whether this modality's harder work is currently part of the user's practice. */
  qualityExposure: CardioQualityExposure;
}

/** Draft-only model. It is not persisted or derived from strength experience. */
export interface CardioProfile {
  schemaVersion: 1;
  modalities: Partial<Record<CardioPlanningModality, CardioModalityProfile>>;
}

export type CardioPlanningGoal = 'GENERAL_FITNESS' | 'AEROBIC_BASE' | 'VO2_FITNESS';

export interface CardioPlanCandidate {
  id: string;
  modality: CardioPlanningModality;
  stimulus: 'EASY' | 'QUALITY';
  /** Complete elapsed session duration, including warm-up, recoveries and cool-down. */
  durationMinutes: number;
  /** Allowed relative day slots within the microcycle. */
  candidateDays: number[];
  /** Transparent scheduling heuristic for local lower-body overlap. */
  lowerBodyDemand: 'LOW' | 'HIGH';
}

export interface CardioStrengthAnchor {
  id: string;
  dayIndex: number;
  lowerBodyDemand: 'LOW' | 'HIGH';
}

export interface CardioPlanningConstraints {
  cycleDays: number;
  availableDays: number[];
  maxSessions: number;
  maxActiveDays: number;
  totalMinutes: number;
  maxSessionMinutes: number;
  allowDoubles: boolean;
  goal: CardioPlanningGoal;
  profile: CardioProfile;
  candidates: CardioPlanCandidate[];
  fixedStrength: CardioStrengthAnchor[];
}

export interface ScheduledCardioCandidate extends CardioPlanCandidate {
  dayIndex: number;
  overlap: 'NONE' | 'SAME_DAY' | 'ADJACENT_DAY';
}

export interface CardioPlanOmission {
  candidateId: string;
  reason: 'QUALITY_EXPOSURE_UNKNOWN' | 'QUALITY_NOT_TOLERATED' | 'SESSION_CAP' | 'TIME_CAP' | 'NO_AVAILABLE_DAY';
}

export interface CardioConstraintPlan {
  scheduled: ScheduledCardioCandidate[];
  omitted: CardioPlanOmission[];
  usedMinutes: number;
  activeDays: number[];
}

/** A reviewable time/effort prescription, independent of sensor calibration. */
export interface EasyCardioPrescription {
  schemaVersion: 1;
  policy: 'EASY_START_V1';
  id: string;
  modality: CardioPlanningModality;
  stimulus: 'EASY';
  durationSeconds: number;
  allowWalking: boolean;
  basis: 'CURRENT_PRACTICE' | 'FAMILIARIZATION';
  adjustments: Array<'UNKNOWN_DURATION' | 'TOLERATED_DURATION_CAP' | 'AVAILABILITY_CAP'>;
  segments: Array<{
    phase: 'WARMUP' | 'EASY' | 'COOLDOWN';
    durationSeconds: number;
    effort: { scale: 'VIGOR_CARDIO_EFFORT_0_10_V1'; min: number; max: number };
    talkTest: 'COMFORTABLE_CONVERSATION';
  }>;
}

export interface EasyCardioRequest {
  id: string;
  modality: CardioPlanningModality;
  /** Requested full session duration, before availability and tolerance caps. */
  durationMinutes: number;
  candidateDays: number[];
  /** Explicit scheduling input; not inferred from a favorable readiness score. */
  lowerBodyDemand: 'LOW' | 'HIGH';
}

export interface EasyCardioDraftPlan extends CardioConstraintPlan {
  /** Only scheduled prescriptions are returned for review. No athlete write occurs. */
  prescriptions: EasyCardioPrescription[];
}

/**
 * Sesión de cardio ejecutada o planificada.
 * Los campos target* son la pauta; los actual* el registro real (paralelo a
 * WorkoutSet en fuerza).
 */
export interface CardioSession {
  /** Shared perception contract; does not convert legacy heart-rate zones or set RIR. */
  sessionFeedback?: import('./sessionFeedback').SessionFeedback;
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
