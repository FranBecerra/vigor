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
  sourceId: string;
  sourceName: string;
  manuallyEntered: boolean;
  ownExport: boolean;
  mixedActivities: boolean;
  /** Hashed external provenance, never a raw metadata/account identifier. */
  externalId?: string;
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
