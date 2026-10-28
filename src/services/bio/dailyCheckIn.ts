import type { DailyCheckIn, DailyCheckInAnswers } from '@/models/dailyCheckIn';

export const DAILY_CHECK_IN_OPTIONS = {
  recovery: ['WORSE', 'USUAL', 'BETTER'],
  energy: ['LOWER', 'USUAL', 'HIGHER'],
  sleep: ['WORSE', 'USUAL', 'BETTER'],
  discomfort: ['NONE', 'PRESENT'],
} as const;
export const DAILY_CHECK_IN_FIELDS = Object.keys(DAILY_CHECK_IN_OPTIONS) as (keyof DailyCheckInAnswers)[];

/** Device-local calendar date, not a UTC day or an assumed training microcycle. */
export function localCheckInDate(time: number): string {
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) throw Error('invalidCheckInDate');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function normalizeDailyCheckInAnswers(input: unknown): DailyCheckInAnswers {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const values = input as Record<string, unknown>;
  return Object.fromEntries(DAILY_CHECK_IN_FIELDS.flatMap((field) =>
    (DAILY_CHECK_IN_OPTIONS[field] as readonly unknown[]).includes(values[field]) ? [[field, values[field]]] : []));
}

export function validDailyCheckIn(input: unknown, uid: string, date: string): input is DailyCheckIn {
  if (!input || typeof input !== 'object') return false;
  const item = input as DailyCheckIn;
  if (item.id !== date || item.localDate !== date || item.userId !== uid || item.questionnaireVersion !== 1) return false;
  if (!Number.isInteger(item.timezoneOffsetMinutes) || Math.abs(item.timezoneOffsetMinutes) > 840) return false;
  if (!Number.isFinite(item.createdAt) || item.createdAt < 0 || !Number.isFinite(item.updatedAt) || item.updatedAt < item.createdAt) return false;
  // Reconstruct the reporting calendar date using its captured offset, even after travel.
  const calendarDate = new Date(item.updatedAt - item.timezoneOffsetMinutes * 60_000);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date) return false;
  const clean = normalizeDailyCheckInAnswers(item.answers);
  return Object.keys(clean).length > 0 && JSON.stringify(clean) === JSON.stringify(
    Object.fromEntries(DAILY_CHECK_IN_FIELDS.filter((field) => item.answers?.[field] !== undefined).map((field) => [field, item.answers[field]])),
  ) && Object.keys(item.answers).every((field) => DAILY_CHECK_IN_FIELDS.includes(field as keyof DailyCheckInAnswers));
}

export function createDailyCheckIn(uid: string, date: string, answers: unknown, now: number, previous?: DailyCheckIn): DailyCheckIn {
  const clean = normalizeDailyCheckInAnswers(answers);
  if (!uid || now < 0 || localCheckInDate(now) !== date || !Object.keys(clean).length) throw Error('invalidCheckIn');
  return { id: date, userId: uid, localDate: date, questionnaireVersion: 1,
    timezoneOffsetMinutes: new Date(now).getTimezoneOffset(), answers: clean,
    createdAt: previous && validDailyCheckIn(previous, uid, date) ? Math.min(previous.createdAt, now) : now, updatedAt: now };
}
