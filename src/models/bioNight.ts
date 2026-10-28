/** Device-memory-only observations. Never attach these to workouts or cloud records. */
export const BIO_NIGHT_METRICS = ['SLEEP', 'HEART_RATE', 'HRV_SDNN', 'HRV_RMSSD'] as const;
export type BioNightMetric = typeof BIO_NIGHT_METRICS[number];
export interface BioNightSample {
  id: string;
  metric: BioNightMetric;
  sourceId: string;
  sourceName: string;
  start: number;
  end: number;
  value: number;
  manuallyEntered: boolean;
  sleepState?: 'ASLEEP' | 'AWAKE' | 'IN_BED';
}
export interface BioNightResult {
  samples: BioNightSample[];
  error: boolean;
  truncated: boolean;
  unsupported?: boolean;
}
export interface BioNightRead { version: 1; metrics: Record<BioNightMetric, BioNightResult> }
export interface BioNightBridge {
  available(): Promise<boolean>;
  authorize(): Promise<void>;
  read(start: number, end: number): Promise<BioNightRead>;
}
export interface BioNightInterval { start: number; end: number }
export interface BioNightCardiac {
  metric: Exclude<BioNightMetric, 'SLEEP'>;
  status: 'AVAILABLE' | 'EMPTY' | 'ERROR' | 'TRUNCATED' | 'UNSUPPORTED';
  median?: number;
  samples: number;
  /** Occupied sixths of the sleep-episode span; not continuous sensor coverage. */
  occupiedBins: number;
  spanMinutes: number;
  /** Why no admitted sample matches this episode; never infer a denied read permission. */
  missingReason?: 'NO_READABLE_SAMPLES' | 'SOURCE_MISMATCH' | 'OUTSIDE_SLEEP';
}
export interface BioSleepEpisode {
  id: string;
  date: string;
  sourceId: string;
  sourceName: string;
  start: number;
  end: number;
  asleepMinutes: number;
  awakeMinutes: number;
  unobservedMinutes: number;
  asleep: BioNightInterval[];
  primary: boolean;
  cardiac: BioNightCardiac[];
}
export interface BioNightAnalysis {
  policy: 'SLEEP_MATCHED_V1';
  status: 'AVAILABLE' | 'EMPTY' | 'ERROR' | 'TRUNCATED' | 'UNSUPPORTED';
  episodes: BioSleepEpisode[];
  latest?: BioSleepEpisode;
  fresh: boolean;
  /** Date-matched previous primary episodes from the same source, never pooled HRV methods. */
  references: Partial<Record<BioNightMetric, { median: number; days: number }>>;
}
