/** Device-local observations. Never stored in Firestore or attached to workout exports. */
export type BioHealthMetric = 'SLEEP' | 'RESTING_HR' | 'HRV_SDNN';
export const BIO_HEALTH_METRICS: readonly BioHealthMetric[] = ['SLEEP', 'RESTING_HR', 'HRV_SDNN'];
export interface BioHealthSample {
  id: string;
  metric: BioHealthMetric;
  start: number;
  end: number;
  /** Minutes are derived from sleep intervals; bpm and milliseconds for quantities. */
  value: number;
  sourceId: string;
  sourceName: string;
  manuallyEntered: boolean;
}
export interface BioHealthResult { samples: BioHealthSample[]; error: boolean; truncated: boolean }
export type BioHealthRead = Record<BioHealthMetric, BioHealthResult>;
export interface BioHealthBridge {
  bioAvailable(): Promise<boolean>;
  /** Completion does not establish that any read permission was granted. */
  authorizeBio(): Promise<void>;
  readBio(start: number, end: number): Promise<BioHealthRead>;
}
export interface BioHealthDay { date: string; value: number; at: number; samples: number }
export interface BioHealthTrend {
  metric: BioHealthMetric;
  status: 'AVAILABLE' | 'EMPTY' | 'ERROR' | 'TRUNCATED';
  sourceId?: string;
  sourceName?: string;
  days: BioHealthDay[];
  latest?: BioHealthDay;
  fresh: boolean;
  /** Descriptive reference, not a recovery threshold or population norm. */
  reference?: { median: number; days: number; from: string; to: string };
}
