import type { SessionFeedback } from './sessionFeedback';

export const SPORT_KINDS = ['PADEL', 'FOOTBALL', 'TENNIS', 'BASKETBALL', 'HIKING', 'RUNNING', 'CYCLING', 'MACHINE', 'OTHER'] as const;
export type SportKind = typeof SPORT_KINDS[number];
export type SportContext = 'CLASS' | 'MATCH' | 'FREE';

/** Finite civil-calendar recurrence. Weekdays use Sunday=0; missing month days are skipped. */
export interface SportRepeatRule {
  frequency: 'WEEKLY' | 'MONTHLY';
  interval: number;
  untilDate: string;
  weekdays?: number[];
}
export interface SportOccurrenceIdentity {
  seriesId: string;
  index: number;
  originalStartAt: number;
}

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
  occurrence?: SportOccurrenceIdentity;
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
  /** Only new planned activities may create a series; editing always affects one occurrence. */
  repeat?: SportRepeatRule;
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

/** One atomic, bounded private document; individual occurrences remain independent records. */
export interface SportActivitySeries {
  schemaVersion: 2;
  id: string;
  userId: string;
  rule: SportRepeatRule;
  anchorStartAt: number;
  timeZone: string;
  createdAt: number;
  occurrences: Record<string, SportActivity>;
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
