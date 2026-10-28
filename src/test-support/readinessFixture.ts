/** Fabricated observations only. No Health or athlete repository access. */
import type { BioNightAnalysis, BioSleepEpisode } from '@/models/bioNight';
import { localCheckInDate } from '@/services/bio/dailyCheckIn';
export const READINESS_FIXTURE_NOW = new Date(2026, 9, 27, 10).getTime();
export function readinessFixture(days = 42, now = READINESS_FIXTURE_NOW): BioNightAnalysis {
  const episodes = Array.from({ length: days }, (_, day): BioSleepEpisode => {
    const date = new Date(now); date.setHours(7, 0, 0, 0); date.setDate(date.getDate() - day);
    const end = date.getTime(), start = end - 8 * 3600000;
    return { id: `synthetic:${day}`, sourceId: 'synthetic', sourceName: 'Synthetic Watch', date: localCheckInDate(end),
      start, end, asleepMinutes: 480, awakeMinutes: 0, unobservedMinutes: 0, primary: true, asleep: [{ start, end }],
      cardiac: (['HEART_RATE', 'HRV_SDNN', 'HRV_RMSSD'] as const).map((metric) => ({ metric, status: 'AVAILABLE',
        median: metric === 'HEART_RATE' ? 50 : metric === 'HRV_SDNN' ? 60 : 70, samples: 5, occupiedBins: 4, spanMinutes: 360 })) };
  });
  return { policy: 'SLEEP_MATCHED_V1', status: 'AVAILABLE', episodes, latest: episodes[0], fresh: true, references: {} };
}
