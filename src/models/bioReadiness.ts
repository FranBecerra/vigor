/** Experimental, device-memory-only policy. Not the legacy cloud ReadinessScore. */
export type ReadinessMetric = 'HEART_RATE' | 'HRV_SDNN' | 'HRV_RMSSD';
export type ReadinessReason = 'NO_OBSERVATIONS' | 'STALE' | 'SLEEP_GOAL' | 'SLEEP_COVERAGE'
  | 'PULSE_COVERAGE' | 'HRV_COVERAGE' | 'UNUSUAL_SIGNAL';
export interface ReadinessSignal {
  metric: ReadinessMetric;
  current?: number;
  recent?: number;
  reference?: number;
  baselineDays: number;
  recentDays: number;
  referenceWindows: number;
  currentDeviation?: number;
  trendDeviation?: number;
  score?: number;
  unusual: boolean;
}
export interface BioReadinessIndex {
  policy: 'RECOVERY_CONTEXT_V1';
  calculatedAt: number;
  date?: string;
  sourceName?: string;
  score?: number;
  /** Coverage only: never a calibrated probability that the index is correct. */
  coverage: 'INSUFFICIENT' | 'LIMITED' | 'ESTABLISHED';
  reasons: ReadinessReason[];
  sleep: { score?: number; goalMinutes?: number; currentMinutes?: number; observedDays: number };
  cardiac: { score?: number; pulse?: ReadinessSignal; hrv?: ReadinessSignal };
}
