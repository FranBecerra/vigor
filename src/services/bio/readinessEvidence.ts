import type { BioHealthMetric, BioHealthTrend } from '@/models/bioHealth';
import { BIO_HEALTH_METRICS } from '@/models/bioHealth';
import { median } from './healthTrends';
import { localCheckInDate } from './dailyCheckIn';

export interface ReadinessSignal {
  metric: BioHealthMetric;
  state: 'IN_RANGE' | 'OUTSIDE_RANGE' | 'INSUFFICIENT';
  recent?: number;
  lower?: number;
  upper?: number;
  referenceDays: number;
  recentDays: number;
}
export interface ReadinessEvidence {
  state: 'IN_RANGE' | 'MIXED' | 'MULTIPLE_CHANGES' | 'INSUFFICIENT';
  signals: ReadinessSignal[];
  policy: 'PERSONAL_RANGES_POC_V1';
}

function quantile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b), position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position), remainder = position - lower;
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * remainder;
}

/**
 * Reviewable POC only, not connected to the athlete's production Bio home.
 * Personal 10th–90th percentile bands are display heuristics, not validated readiness cutoffs.
 * No subjective daily form, invented weights, numerical recovery score or plan change.
 */
export function previewReadinessEvidence(trends: readonly BioHealthTrend[], now: number): ReadinessEvidence {
  const date = new Date(now), validNow = Number.isFinite(date.getTime());
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 6);
  const from = new Date(cutoff); from.setDate(from.getDate() - 28);
  const recentStart = validNow ? localCheckInDate(cutoff.getTime()) : '';
  const baselineStart = validNow ? localCheckInDate(from.getTime()) : '';
  const signals: ReadinessSignal[] = BIO_HEALTH_METRICS.map((metric) => {
    const trend = trends.find((entry) => entry.metric === metric);
    const empty: ReadinessSignal = { metric, state: 'INSUFFICIENT', referenceDays: 0, recentDays: 0 };
    if (!validNow || !trend?.sourceId || trend.status !== 'AVAILABLE' || !trend.latest || !trend.fresh
      || trend.latest.at > now || trend.latest.at < now - 36 * 3600000) return empty;
    const unique = new Map(trend.days.filter((day) => Number.isFinite(day.value) && day.value > 0 && day.at <= now
      && /^\d{4}-\d{2}-\d{2}$/.test(day.date)).map((day) => [day.date, day]));
    const days = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
    const reference = days.filter((day) => day.date >= baselineStart && day.date < recentStart);
    const recent = metric === 'SLEEP' ? days.filter((day) => day.date === trend.latest!.date) : days.filter((day) => day.date >= recentStart);
    const counts = { ...empty, referenceDays: reference.length, recentDays: recent.length };
    if (reference.length < 14 || recent.length < (metric === 'SLEEP' ? 1 : 3)) return counts;
    const lower = quantile(reference.map((day) => day.value), 0.1), upper = quantile(reference.map((day) => day.value), 0.9);
    const current = median(recent.map((day) => day.value));
    // An unusually high HRV is a change too, not automatically "better recovery".
    const outside = current < lower || current > upper;
    return { metric, state: outside ? 'OUTSIDE_RANGE' : 'IN_RANGE', recent: current, lower, upper,
      referenceDays: reference.length, recentDays: recent.length };
  });
  const altered = signals.filter((signal) => signal.state === 'OUTSIDE_RANGE').length;
  return { policy: 'PERSONAL_RANGES_POC_V1', signals,
    state: signals.some((signal) => signal.state === 'INSUFFICIENT') ? 'INSUFFICIENT' : altered >= 2 ? 'MULTIPLE_CHANGES' : altered === 1 ? 'MIXED' : 'IN_RANGE' };
}
