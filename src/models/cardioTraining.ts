import type { EasyCardioPrescription } from './cardio';
import type { SessionFeedback } from './sessionFeedback';
import type { SavedCardioPlan } from '@/services/cardio/savedCardioPlan';

export interface CardioSlot {
  id: string;
  cycle: number;
  prescriptionId: string;
  date: string;
  disposition: 'CARDIO' | 'SKIPPED' | 'SPORT';
  sportId: string | null;
}
export interface CardioCycleResponses {
  easy: 'YES' | 'NO' | 'UNKNOWN';
  recovered: 'YES' | 'NO' | 'UNKNOWN';
  symptoms: 'NONE' | 'PRESENT' | 'UNKNOWN';
}
export interface CardioCycleReview {
  cycle: number;
  recordedAt: number;
  responses: CardioCycleResponses;
  decision: 'INCREASE' | 'REPEAT';
  /** Confirmed full-session seconds, in the frozen proposal's prescription order. */
  nextSeconds: number[];
}
export interface CardioProgression {
  policy: 'REVIEWED_DURATION_V1';
  /** Sequential reviews. The first cycle is confirmed at activation. */
  reviews: CardioCycleReview[];
}
/** A finite easy block; new duration increases require explicit microcycle review. */
export interface CardioBlock {
  schemaVersion: 1;
  id: string;
  userId: string;
  proposal: SavedCardioPlan;
  startDate: string;
  timeZone: string;
  cycles: number;
  slots: CardioSlot[];
  createdAt: number;
  updatedAt: number;
  revision: number;
  endedAt: number | null;
  /** Absent on legacy blocks; never upgrade those blocks implicitly. */
  progression?: CardioProgression;
}
/** Timed execution is separate from the planned prescription and from sport records. */
export interface CardioWorkout {
  schemaVersion: 1;
  id: string;
  userId: string;
  blockId: string;
  slotId: string;
  name: string;
  prescription: EasyCardioPrescription;
  status: 'RUNNING' | 'PAUSED' | 'FINISHED' | 'DISCARDED';
  startedAt: number;
  updatedAt: number;
  revision: number;
  /** Accumulated active time before the current running interval. */
  elapsedMs: number;
  finishedAt: number | null;
  actualSeconds: number | null;
  feedback: SessionFeedback | null;
  source: 'TIMER_TIME_EFFORT_V1';
}
