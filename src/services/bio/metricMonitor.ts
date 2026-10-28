import type { BioHealthDay, BioHealthTrend } from '@/models/bioHealth';
import { HEALTH_REFERENCE_DAYS, HEALTH_REFERENCE_MIN_DAYS } from './healthTrends';
import { localCheckInDate } from './dailyCheckIn';
import { validSleepGoal } from './sleepGoal';

export type MetricPosition = 'WITHIN' | 'BELOW' | 'ABOVE' | 'TARGET_MET' | 'TARGET_BELOW'
  | 'GOAL_MISSING' | 'BUILDING' | 'STALE' | 'MISSING' | 'ERROR';
export interface MetricRange { lower: number; upper: number; count: number; from: string; to: string }
export interface MetricMonitor {
  latest?: BioHealthDay;
  days: BioHealthDay[];
  range?: MetricRange;
  goal?: number;
  position: MetricPosition;
}
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(new Date(`${date}T12:00:00`).getTime())
  && localCheckInDate(new Date(`${date}T12:00:00`).getTime()) === date;
const validDay = (day: BioHealthDay, now: number) => !!day && validDate(day.date)
  && day.date <= localCheckInDate(now) && Number.isFinite(day.value) && day.value > 0 && Number.isFinite(day.at) && day.at > 0 && day.at <= now;

/** R7 interpolated empirical quantile; input is nonempty and finite. Not a medical threshold. */
function quantile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b), at = (sorted.length - 1) * fraction;
  const lower = Math.floor(at), upper = Math.ceil(at);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (at - lower);
}

/** Same-source descriptive daily range only. Never feeds the readiness score or prescription. */
export function buildMetricMonitor(trend: BioHealthTrend, sleepGoal: unknown, now: number): MetricMonitor {
  const empty: MetricMonitor = { position: 'MISSING', days: [] };
  if (trend.status === 'ERROR' || trend.status === 'TRUNCATED') return { ...empty, position: 'ERROR' };
  if (!Number.isFinite(new Date(now).getTime()) || trend.status !== 'AVAILABLE' || !trend.sourceId
    || !trend.latest || !validDay(trend.latest, now)) return empty;
  const latest = trend.latest;
  const unique = new Map<string, BioHealthDay>();
  for (const day of trend.days) if (validDay(day, now) && day.date <= latest.date
    && (!unique.has(day.date) || unique.get(day.date)!.at < day.at)) unique.set(day.date, day);
  unique.set(latest.date, latest);
  const days = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(`${latest.date}T12:00:00`); start.setDate(start.getDate() - HEALTH_REFERENCE_DAYS);
  const previous = days.filter((day) => day.date >= localCheckInDate(start.getTime()) && day.date < latest.date);
  const range: MetricRange | undefined = previous.length >= HEALTH_REFERENCE_MIN_DAYS ? {
    lower: quantile(previous.map((day) => day.value), .1), upper: quantile(previous.map((day) => day.value), .9),
    count: previous.length, from: previous[0].date, to: previous.at(-1)!.date,
  } : undefined;
  const goal = trend.metric === 'SLEEP' && validSleepGoal(sleepGoal) ? sleepGoal : undefined;
  const position: MetricPosition = !trend.fresh || latest.at < now - 36 * 3_600_000 ? 'STALE'
    : trend.metric === 'SLEEP' ? goal === undefined ? 'GOAL_MISSING' : latest.value < goal ? 'TARGET_BELOW' : 'TARGET_MET'
    : !range ? 'BUILDING' : latest.value < range.lower ? 'BELOW' : latest.value > range.upper ? 'ABOVE' : 'WITHIN';
  return { latest, days, range, goal, position };
}

/** A real domain around observations and bounds; a constant history is not given invented bounds. */
export function metricDomain(values: number[]): { lower: number; upper: number } | undefined {
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!finite.length) return undefined;
  const lower = Math.min(...finite), upper = Math.max(...finite);
  const padding = Math.max((upper - lower) * .25, upper * .02, .5);
  return { lower: lower - padding, upper: upper + padding };
}
export function metricCoordinate(value: number, domain: { lower: number; upper: number }) {
  return Math.max(0, Math.min(1, (value - domain.lower) / (domain.upper - domain.lower)));
}

/** Calendar slots, not sample indices: absent days break the line instead of implying observations. */
export function metricChartSlots(view: MetricMonitor): { date: string; day?: BioHealthDay }[] {
  if (!view.latest) return [];
  const cursor = new Date(`${view.latest.date}T12:00:00`); cursor.setDate(cursor.getDate() - 13);
  const byDate = new Map(view.days.map((day) => [day.date, day]));
  return Array.from({ length: 14 }, () => {
    const date = localCheckInDate(cursor.getTime()); cursor.setDate(cursor.getDate() + 1);
    return { date, day: byDate.get(date) };
  });
}
