import { proposeCardioStartingPoint as propose, type CardioStartContext } from '../cardioStartingPoint';
import type { CardioHealthRead, CardioHealthWorkout } from '@/models/cardioHealth';
const day = 86400000, now = Date.UTC(2026, 9, 30, 12);
const workout = (days: number, patch: Partial<CardioHealthWorkout> = {}): CardioHealthWorkout => ({
  id: `run-${days}`, kind: 'RUNNING', start: now - days * day, end: now - days * day + 30 * 60000,
  durationSeconds: 1800, sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, mixedActivities: false, ownExport: false, ...patch });
const data: CardioHealthRead = { version: 1, truncated: false, workouts: [1, 4, 8, 11, 15, 18, 22, 25].map(d => workout(d)) };
const context: CardioStartContext = { modality: 'RUNNING', representative: true, response: 'RECOVERED', comfortableMinutes: 40,
  cycleDays: 7, maxSessions: 2, maxSessionMinutes: 40, totalMinutes: 80 };
const result = (ctx: Partial<CardioStartContext> = {}, raw: unknown = data) => propose(raw, now, now, { ...context, ...ctx });
it('uses repeated modality-specific exposure, never a maximum or the beginner label, and mutates nothing', () => {
  const before = JSON.stringify(data);
  expect(result()).toEqual({ policy: 'OBSERVED_EASY_START_POC_V1', state: 'READY', modality: 'RUNNING', cycleDays: 7,
    sessions: 2, sessionMinutes: 30, totalMinutes: 60, observedSessions: 8, representedWeeks: 4,
    typicalMinutes: 30, weeklySessions: 2, weeklyMinutes: 60, cappedBy: [] });
  expect(JSON.stringify(data)).toBe(before);
  expect(result({ modality: 'CYCLING' }).state).toBe('INSUFFICIENT_HISTORY');
  expect(result({ modality: 'CYCLING' }, { ...data, workouts: data.workouts.map(w => ({ ...w, kind: 'CYCLING' })) })).toMatchObject({ state: 'READY', sessionMinutes: 30 });
});
it.each([null, { modality: 'MACHINE' }, { response: 'INVALID' }, { representative: 1 }, { comfortableMinutes: 0 },
  { comfortableMinutes: 601 }, { comfortableMinutes: NaN }, { comfortableMinutes: 1.5 }, { cycleDays: 6 }, { cycleDays: 32 },
  { maxSessions: -1 }, { maxSessions: 15 }, { maxSessionMinutes: -1 }, { maxSessionMinutes: 601 },
  { totalMinutes: -1 }, { totalMinutes: 1441 }])('rejects invalid declared context %j without calculating', patch => {
  expect(propose(data, now, now, patch === null ? null as any : { ...context, ...patch } as any).state).toBe('INVALID_CONTEXT');
});
it.each([[now, NaN], [NaN, now], [now + 1, now], [now - day - 1, now]])('rejects stale/future/unusable read time %j', (observedAt, clock) => {
  expect(propose(data, observedAt, clock, context).state).toBe('STALE_REVIEW');
});
it('allows exactly one elapsed day before expiring the read', () => {
  expect(propose(data, now, now + day, context).state).toBe('READY');
});
it.each([null, {}, { ...data, truncated: true }, { ...data, workouts: [...data.workouts, workout(2, { durationSeconds: 0 })] },
  { ...data, workouts: [...data.workouts, workout(1, { id: 'conflict', sourceId: 'other' })] },
  { version: 1, truncated: false, workouts: [] }])('requires a valid resolved history review %j', raw => {
  expect(result({}, raw).state).toBe('REVIEW_REQUIRED');
});
it('resolves ambiguity only through explicit source/exclusion and keeps provenance filtering', () => {
  const raw = { ...data, workouts: [...data.workouts, workout(1, { id: 'copy', sourceId: 'partner' })] };
  expect(propose(raw, now, now, context, 'watch').state).toBe('READY');
  expect(propose(raw, now, now, context, undefined, ['copy']).state).toBe('READY');
  expect(propose(raw, now, now, context, 'absent').state).toBe('REVIEW_REQUIRED');
});
it('requires a full 28-day shared window, but not the older 42-day window', () => {
  expect(result({}, { ...data, earliestAllowedStart: now - 28 * day + 1 }).state).toBe('LIMITED_HISTORY');
  expect(result({}, { ...data, earliestAllowedStart: now - 28 * day }).state).toBe('READY');
});
it.each([{ representative: undefined }, { representative: false }, { response: 'UNKNOWN' as const }, { comfortableMinutes: undefined }])('requires explicit present-day context %j', ctx => {
  expect(result(ctx).state).toBe('CONTEXT_REQUIRED');
});
it('does not translate symptoms or poor recovery into an arbitrary numeric reduction', () => {
  expect(result({ response: 'DISCOMFORT' }).state).toBe('DISCOMFORT');
  expect(result({ response: 'DIFFICULT' }).state).toBe('REVIEW_TOLERANCE');
  expect(result({ response: 'DISCOMFORT' }, { ...data, workouts: [] }).state).toBe('DISCOMFORT');
});
it.each([{ days: [1, 8, 15] }, { days: [1, 2, 3, 4] }, { days: [11, 15, 22, 25] }, { days: [29, 30, 36, 38] }])('requires repetition across three bins and recency %j', ({ days }) => {
  expect(result({}, { ...data, workouts: days.map(d => workout(d)) }).state).toBe('INSUFFICIENT_HISTORY');
});
it('handles exact window and recency boundaries, odd medians and a represented empty bin', () => {
  const records = [0.5, 8, 15, 28, 30].map(d => workout(d));
  expect(result({}, { ...data, workouts: records })).toMatchObject({ state: 'READY', observedSessions: 4, representedWeeks: 4 });
  expect(result({}, { ...data, workouts: [10, 15, 22, 25].map(d => workout(d, d === 10 ? { start: now - 10 * day - 1800000, end: now - 10 * day } : {})) }).state).toBe('READY');
  expect(result({}, { ...data, workouts: [1, 8, 15, 16, 17].map(d => workout(d)) })).toMatchObject({ state: 'READY', representedWeeks: 3, weeklySessions: 1 });
});
it('excludes manual, mixed, own and expressly excluded sessions without borrowing sport exposure', () => {
  const raw = { ...data, workouts: [workout(1), ...data.workouts.slice(1).map((w, i) => ({ ...w,
    manuallyEntered: i % 3 === 0, mixedActivities: i % 3 === 1, ownExport: i % 3 === 2 })), workout(2, { kind: 'TENNIS' })] };
  expect(result({}, raw).state).toBe('INSUFFICIENT_HISTORY');
  expect(propose(data, now, now, context, undefined, data.workouts.slice(1).map(w => w.id)).state).toBe('INSUFFICIENT_HISTORY');
});
it('applies every availability/comfort cap without rounding above it', () => {
  expect(result({ comfortableMinutes: 12 })).toMatchObject({ state: 'READY', sessionMinutes: 12, cappedBy: ['COMFORT'] });
  expect(result({ maxSessionMinutes: 17 })).toMatchObject({ state: 'READY', sessionMinutes: 17, cappedBy: ['SESSION_TIME'] });
  expect(result({ maxSessions: 1 })).toMatchObject({ state: 'READY', sessions: 1, sessionMinutes: 30, cappedBy: ['SESSION_COUNT'] });
  expect(result({ totalMinutes: 31 })).toMatchObject({ state: 'READY', sessionMinutes: 15, totalMinutes: 30, cappedBy: ['TOTAL_TIME'] });
  for (const cap of [{ maxSessions: 0 }, { maxSessionMinutes: 0 }, { totalMinutes: 0 }, { totalMinutes: 1 }]) expect(result(cap).state).toBe('TIME_TOO_LOW');
});
it('caps duration by typical observed volume rather than multiplying an exceptional long session', () => {
  const minutes = [100, 100, 100, 100, 100, 10, 10, 10];
  const raw = { ...data, workouts: data.workouts.map((w, i) => ({ ...w, durationSeconds: minutes[i] * 60, end: w.start + minutes[i] * 60000 })) };
  expect(result({ comfortableMinutes: 200, maxSessionMinutes: 200, totalMinutes: 1000 }, raw)).toMatchObject({ state: 'READY', sessionMinutes: 77, totalMinutes: 154, cappedBy: ['OBSERVED_VOLUME'] });
});
it.each([8, 10, 14, 31])('scales observation frequency to a %i-day cycle without redefining it as a week', cycleDays => {
  const r = result({ cycleDays, maxSessions: 14, totalMinutes: 1440 });
  expect(r.state).toBe('READY');
  if (r.state === 'READY') {
    expect(r.sessions).toBe(Math.floor(2 * cycleDays / 7));
    expect(r.totalMinutes).toBeLessThanOrEqual(60 * cycleDays / 7);
    expect(r.sessionMinutes).toBeLessThanOrEqual(30);
  }
});
it('handles sub-minute active records without inventing a one-minute prescription', () => {
  expect(result({}, { ...data, workouts: data.workouts.map(w => ({ ...w, durationSeconds: 20 })) }).state).toBe('TIME_TOO_LOW');
});
