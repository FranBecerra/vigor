import type { SessionFeedback } from './sessionFeedback';

export const SPORT_KINDS = ['PADEL', 'FOOTBALL', 'TENNIS', 'BASKETBALL', 'HIKING', 'RUNNING', 'CYCLING', 'MACHINE', 'OTHER'] as const;
export type SportKind = typeof SPORT_KINDS[number];
export type SportContext = 'CLASS' | 'MATCH' | 'FREE';

export interface SportTiming {
  startAt: number;
  durationMinutes: number;
  timeZone: string;
}

/** Actual manual exposure, independent of the original appointment. */
export interface SportRecord extends SportTiming {
  source: 'MANUAL';
  feedback: SessionFeedback | null;
}

/** Private, versioned activity aggregate. Raw health samples never enter this document. */
export interface SportActivity {
  schemaVersion: 1;
  id: string;
  userId: string;
  sport: SportKind;
  context: SportContext;
  name: string;
  notes: string;
  planned: SportTiming | null;
  record: SportRecord | null;
  createdAt: number;
  updatedAt: number;
  revision: number;
  discardedAt: number | null;
}

export interface SportActivityDraft {
  sport: SportKind;
  context: SportContext;
  name: string;
  notes: string;
  mode: 'PLAN' | 'RECORD';
  startAt: number;
  durationMinutes: number;
  timeZone: string;
  effort: number | null;
}

/** Device-local contract for the mandatory subsequent sensor phase. */
export interface CardioLiveObservation {
  metric: 'HEART_RATE' | 'SPEED' | 'POWER';
  unit: 'BPM' | 'METRES_PER_SECOND' | 'WATTS';
  value: number;
  observedAt: number;
  receivedAt: number;
  sourceId: string;
  quality: 'VALID' | 'UNRELIABLE';
}
