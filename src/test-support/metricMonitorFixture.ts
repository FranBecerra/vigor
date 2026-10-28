import type { BioHealthTrend } from '@/models/bioHealth';
import { localCheckInDate } from '@/services/bio/dailyCheckIn';

/** Disposable simulator observations only. No Health reads, storage or athlete records. */
export function metricMonitorFixture(now = Date.now()): BioHealthTrend[] {
  return (['RESTING_HR', 'HRV_SDNN', 'SLEEP'] as const).map((metric) => {
    const days = Array.from({ length: 29 }, (_, index) => {
      const at = new Date(now); at.setDate(at.getDate() - (28 - index));
      const value = metric === 'SLEEP' ? index === 28 ? 450 : 420 + index % 7 * 15
        : metric === 'RESTING_HR' ? index === 28 ? 56 : 52 + index % 5 * 2
          : index === 28 ? 34 : 40 + index % 7 * 2;
      return { date: localCheckInDate(at.getTime()), at: at.getTime(), value, samples: 1 };
    }).filter((_, index) => index !== 21);
    return { metric, status: 'AVAILABLE', sourceId: 'synthetic-monitor-watch', sourceName: 'Synthetic Watch',
      days, latest: days.at(-1), fresh: true };
  });
}
