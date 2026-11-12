import type { SportRepeatRule } from '@/models/sportActivity';
import { shiftCalendarDate, validCalendarDate } from '../training/trainingCalendar';

export const MAX_SPORT_OCCURRENCES = 52;
const DAY = 86400000;
const validEpoch = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v < 8.64e15;
const whole = (v: unknown, a: number, b: number) => typeof v === 'number' && Number.isInteger(v) && v >= a && v <= b;

function formatter(zone: string) {
  if (typeof zone !== 'string' || !zone || zone.length > 100) throw Error('invalidSportRecurrence');
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}
function civil(format: Intl.DateTimeFormat, epoch: number) {
  const parts = format.formatToParts(epoch);
  const value = (key: string) => parts.find((p) => p.type === key)!.value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, clock: `${value('hour')}:${value('minute')}:${value('second')}` };
}
export function sportLocalDate(epoch: number, zone: string): string {
  if (!validEpoch(epoch)) throw Error('invalidSportRecurrence');
  try { return civil(formatter(zone), epoch).date; } catch { throw Error('invalidSportRecurrence'); }
}
export function sportLocalWeekday(epoch: number, zone: string): number {
  return new Date(`${sportLocalDate(epoch, zone)}T12:00:00Z`).getUTCDay();
}

export function validSportRepeatRule(value: unknown): value is SportRepeatRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as SportRepeatRule;
  if (Object.keys(r).some((k) => !['frequency', 'interval', 'untilDate', 'weekdays'].includes(k))
    || !['WEEKLY', 'MONTHLY'].includes(r.frequency) || !whole(r.interval, 1, 12)
    || typeof r.untilDate !== 'string' || !validCalendarDate(r.untilDate)) return false;
  return r.frequency === 'MONTHLY' ? r.weekdays === undefined : Array.isArray(r.weekdays) && r.weekdays.length > 0
    && r.weekdays.length <= 7 && new Set(r.weekdays).size === r.weekdays.length && r.weekdays.every((d) => whole(d, 0, 6));
}

/** Keep wall-clock time through DST. Omit nonexistent times; choose the earlier ambiguous instant. */
function resolveCivil(date: string, clock: string, format: Intl.DateTimeFormat, milliseconds: number): number | null {
  const naive = Date.parse(`${date}T${clock}Z`);
  const offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 6) {
    const probe = naive + h * 3600000;
    const local = civil(format, probe);
    offsets.add(Date.parse(`${local.date}T${local.clock}Z`) - probe);
  }
  const matches = [...offsets].map((offset) => naive - offset).filter((epoch) => {
    const local = civil(format, epoch); return local.date === date && local.clock === clock;
  }).sort((a, b) => a - b);
  return matches.length ? matches[0] + milliseconds : null;
}

export interface SportRecurrencePreview { starts: number[]; skippedDates: string[] }
/** At most a civil year and 52 occurrences. No infinite series or elapsed-24h recurrence. */
export function previewSportRecurrence(startAt: number, zone: string, rule: SportRepeatRule): SportRecurrencePreview {
  if (!validEpoch(startAt) || !validSportRepeatRule(rule)) throw Error('invalidSportRecurrence');
  let format: Intl.DateTimeFormat;
  try { format = formatter(zone); } catch { throw Error('invalidSportRecurrence'); }
  const anchor = civil(format, startAt);
  const span = (Date.parse(`${rule.untilDate}T12:00Z`) - Date.parse(`${anchor.date}T12:00Z`)) / DAY;
  if (span < 1 || span > 366) throw Error('invalidSportRecurrence');
  const anchorDate = new Date(`${anchor.date}T12:00Z`);
  const mondayOffset = (anchorDate.getUTCDay() + 6) % 7;
  const starts: number[] = [], skippedDates: string[] = [];
  for (let day = 0; day <= span; day++) {
    const date = shiftCalendarDate(anchor.date, day), current = new Date(`${date}T12:00Z`);
    const monthOffset = (current.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 + current.getUTCMonth() - anchorDate.getUTCMonth();
    const included = rule.frequency === 'WEEKLY'
      ? Math.floor((day + mondayOffset) / 7) % rule.interval === 0 && rule.weekdays!.includes(current.getUTCDay())
      : monthOffset % rule.interval === 0 && current.getUTCDate() === anchorDate.getUTCDate();
    if (!included) continue;
    // Preserve the athlete's exact chosen first instant, including DST's repeated hour.
    const resolved = day === 0 ? startAt : resolveCivil(date, anchor.clock, format, startAt % 1000);
    if (resolved === null) { skippedDates.push(date); continue; }
    starts.push(resolved);
    if (starts.length > MAX_SPORT_OCCURRENCES) throw Error('sportRecurrenceTooLarge');
  }
  if (starts.length < 2) throw Error('invalidSportRecurrence');
  return { starts, skippedDates };
}
