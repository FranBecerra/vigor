import { cardioFixture } from '@/test-support/cardioFixture';
import type { CardioHealthWorkout } from '@/models/cardioHealth';
import { cardioHealthCandidates, createLinkedCardioWorkout } from '../cardioHealthLink';
import { cardioHomeSessions } from '../cardioHome';
import { transitionCardioWorkout, validCardioWorkout } from '../cardioWorkout';
import { vigorPlanningHistory } from '../planningHistory';

const now = Date.UTC(2026, 9, 31, 16);
const block = cardioFixture({}, now);
const slot = block.slots[0];
const record: CardioHealthWorkout = {
  id: 'raw-identifier', kind: 'RUNNING', start: now - 3_600_000, end: now - 1_200_000, durationSeconds: 2200,
  sourceId: 'watch', sourceName: 'Apple Watch', manuallyEntered: false, ownExport: false, mixedActivities: false,
  averageHeartRateBpm: 142, distanceMetres: 4200, linkKey: 'b'.repeat(64),
};
const read = (...workouts: CardioHealthWorkout[]) => ({ version: 1 as const, truncated: false, workouts });
const make = () => createLinkedCardioWorkout(block, slot.id, record.id, read(record), [], now, 'result');

it('uses only explicitly selected verified records and keeps the actual date separate from the prescribed date', () => {
  const workout = make();
  expect(validCardioWorkout(workout, block.userId)).toBe(true);
  expect(workout).toMatchObject({ source: 'APPLE_HEALTH_LINK_V1', status: 'FINISHED', actualSeconds: 2200,
    startedAt: record.start, finishedAt: record.end, feedback: null, healthLinkKey: record.linkKey });
  expect(workout).not.toHaveProperty('distanceMetres');
  expect(workout).not.toHaveProperty('averageHeartRateBpm');
  expect(JSON.stringify(workout)).not.toContain(record.id);
  expect(cardioHomeSessions(block, [workout]).find(s => s.slot.id === slot.id)).toMatchObject({
    date: '2026-10-31', seconds: 2200, completed: true, slot: { date: slot.date },
  });
  expect(validCardioWorkout({ ...workout, healthLinkKey: undefined }, block.userId)).toBe(false);
  expect(vigorPlanningHistory([workout], block.userId, now).workouts).toEqual([]);
});

it('excludes unmatched modalities, times outside the Health window, manual, mixed, self-exported and unkeyed records', () => {
  const variants: Partial<CardioHealthWorkout>[] = [
    { kind: 'CYCLING' }, { start: now - 43 * 86400000, end: now - 43 * 86400000 + 3600000 }, { manuallyEntered: true },
    { mixedActivities: true }, { ownExport: true }, { linkKey: undefined }, { end: now + 1 },
  ];
  variants.forEach(patch => expect(cardioHealthCandidates(block, slot.id, read({ ...record, ...patch }), [], now)).toEqual([]));
  expect(cardioHealthCandidates(block, 'missing', read(record), [], now)).toEqual([]);
  expect(cardioHealthCandidates(block, slot.id, { ...read(record), truncated: true }, [], now)).toEqual([]);
});

it('locks recorded opportunities and used Health records until explicit unlink', () => {
  const workout = make();
  expect(cardioHealthCandidates(block, slot.id, read(record), [workout], now)).toEqual([]);
  expect(cardioHealthCandidates(block, block.slots[1].id, read(record), [workout], now)).toEqual([]);
  const unlinked = transitionCardioWorkout(workout, 'DISCARD', now + 1);
  expect(cardioHealthCandidates(block, slot.id, read(record), [unlinked], now + 1)).toEqual([record]);
  expect(() => createLinkedCardioWorkout(block, slot.id, 'unselected', read(record), [], now, 'result')).toThrow('healthCardioUnavailable');
});

it('links a recent run from before the block began and preserves its real date', () => {
  const mondayStart = Date.UTC(2026, 9, 26, 15);
  const monday = { ...record, start: mondayStart, end: mondayStart + 2400000 };
  const sunday = { ...monday, id: 'previous-week', linkKey: 'c'.repeat(64),
    start: new Date(2026, 9, 25, 23).getTime(), end: new Date(2026, 9, 25, 23, 40).getTime() };
  expect(cardioHealthCandidates(block, slot.id, read(sunday, monday), [], now)).toEqual([monday]);
  expect(() => createLinkedCardioWorkout(block, slot.id, sunday.id, read(sunday), [], now, 'out-of-week'))
    .toThrow('healthCardioUnavailable');
  expect(cardioHealthCandidates(block, slot.id, read(monday), [], now)).toEqual([monday]);
  const workout = createLinkedCardioWorkout(block, slot.id, monday.id, read(monday), [], now, 'older-run');
  expect(workout.startedAt).toBe(monday.start);
  expect(cardioHomeSessions(block, [workout]).find(s => s.slot.id === slot.id)).toMatchObject({ date: '2026-10-26', completed: true });
});
