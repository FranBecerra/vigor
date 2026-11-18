/** Device-memory only. Never place Health observations in a plan or account document. */
export const HEALTH_CARDIO_KINDS = ['RUNNING', 'CYCLING', 'WALKING', 'HIKING', 'ROWING', 'ELLIPTICAL', 'STAIRS', 'SWIMMING', 'TENNIS', 'FOOTBALL', 'BASKETBALL', 'HIIT', 'MIXED'] as const;
export type HealthCardioKind = typeof HEALTH_CARDIO_KINDS[number];
export interface CardioHealthWorkout {
  id: string;
  kind: HealthCardioKind;
  start: number;
  end: number;
  durationSeconds: number;
  distanceMetres?: number;
  /** Device-memory Vigor history feedback, never inferred from Health. */
  sessionEffort?: number;
  /** Workout-associated average only, when provided by HealthKit. */
  averageHeartRateBpm?: number;
  /** Associated system or user five-zone durations, ordered from lowest to highest. */
  heartRateZoneSeconds?: number[];
  sourceId: string;
  sourceName: string;
  manuallyEntered: boolean;
  ownExport: boolean;
  mixedActivities: boolean;
  /** Hashed external provenance, never a raw metadata/account identifier. */
  externalId?: string;
  /** Opaque, stable match key. The raw HealthKit UUID is never persisted by a link. */
  linkKey?: string;
}
export interface CardioHealthRead {
  version: 1;
  truncated: boolean;
  workouts: CardioHealthWorkout[];
  /** Known limited access only. Absence never establishes full access. */
  earliestAllowedStart?: number;
}
export interface CardioHealthBridge {
  available(): Promise<boolean>;
  authorize(): Promise<void>;
  read(start: number, end: number): Promise<CardioHealthRead>;
}
