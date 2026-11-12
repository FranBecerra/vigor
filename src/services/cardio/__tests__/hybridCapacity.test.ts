import { hybridFixture } from '@/test-support/hybridFixture';
import { prepareHybridBundle } from '../hybridAuthoring';
import { reviewHybridCapacity } from '../hybridCapacity';
import { changeCardioSlot, createCardioBlock, type DatedStrength } from '../cardioBlock';
import { withCardioProgression } from '../cardioProgression';
import { saveSportDraft } from '../sportActivities';

const now = Date.UTC(2026, 9, 1);
function fixture(days = 8, zone = 'Europe/Madrid', start = '2026-10-22', cycles = 4) {
  const f = hybridFixture(); f.input.cycleDays = days; f.input.availableDays = Array.from({ length: days }, (_, i) => i);
  const bundle = prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, now);
  return { ...f, bundle, block: createCardioBlock('block', bundle.cardio, start, cycles, zone, now) };
}
function sport(id: string, start: string, durationMinutes = 60, owner = 'owner') {
  return saveSportDraft(id, owner, { sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'PLAN',
    startAt: Date.parse(start), durationMinutes, timeZone: 'Europe/Madrid', effort: null }, now);
}
it('counts dated classes only in their own microcycle and never changes prescriptions or activities', () => {
  const f = fixture(), activity = sport('class', '2026-10-23T16:00:00Z');
  const before = JSON.stringify([f.block, activity]);
  const result = reviewHybridCapacity(f.block, { ...f.settings, totalMinutesPerCycle: 100 }, [activity], []);
  expect(result.cycles.map(c => c.totalMinutes)).toEqual([130, 70, 70, 70]);
  expect(result.cycles[0]).toMatchObject({ strengthMinutes: 30, cardioMinutes: 40, plannedSportMinutes: 60,
    recordedSportMinutes: 0, overBudgetMinutes: 30, remainingMinutes: 0, startDate: '2026-10-22', endDate: '2026-10-29' });
  expect(result.cycles[1].remainingMinutes).toBe(30); expect(result.fits).toBe(false);
  expect(JSON.stringify([f.block, activity])).toBe(before);
});
it.each([7, 8, 10, 14, 31])('uses %i-day cycles rather than calendar weeks', days => {
  const f = fixture(days), result = reviewHybridCapacity(f.block, f.settings, [], []);
  expect(result.cycles).toHaveLength(4); expect(result.cycles.every(r => r.totalMinutes === 70)).toBe(true); expect(result.fits).toBe(true);
});
it.each([
  ['Europe/Madrid', '2026-10-24', '2026-10-31T22:30:00Z'],
  ['Asia/Kathmandu', '2026-10-22', '2026-10-29T17:45:00Z'],
  ['America/New_York', '2026-10-29', '2026-11-06T04:30:00Z'],
])('splits a cross-cycle activity at local midnight, including DST and fractional offsets: %s', (zone, start, instant) => {
  const f = fixture(8, zone, start);
  const result = reviewHybridCapacity(f.block, f.settings, [sport('boundary', instant, 90)], []);
  expect(result.cycles.map(c => c.plannedSportMinutes)).toEqual([30, 60, 0, 0]);
});
it('clips both ends of the horizon and excludes discarded, foreign and out-of-horizon activities', () => {
  const f = fixture(8, 'UTC', '2026-10-22', 1), before = sport('before', '2026-10-21T23:30:00Z', 60);
  const after = sport('after', '2026-10-29T23:30:00Z', 60), discarded = { ...sport('discard', '2026-10-23T00:00Z'), discardedAt: now };
  const result = reviewHybridCapacity(f.block, f.settings, [before, after, discarded, sport('foreign', '2026-10-23T00:00Z', 90, 'other'), sport('outside', '2026-11-10T00:00Z')], []);
  expect(result.cycles[0].plannedSportMinutes).toBe(60);
});
it('uses actual sport duration/date instead of its original reservation, without double counting a replacement', () => {
  const f = fixture(8, 'UTC'), planned = sport('class', '2026-10-23T16:00Z');
  const recorded = saveSportDraft('class', 'owner', { sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'RECORD',
    startAt: Date.parse('2026-11-01T16:00Z'), durationMinutes: 45, timeZone: 'UTC', effort: 6 }, Date.parse('2026-11-02T00:00Z'), planned);
  const changed = changeCardioSlot(f.block, f.block.slots[0].id, '2026-11-01', 'SPORT', recorded, [], Date.parse('2026-11-02T00:00Z'));
  const result = reviewHybridCapacity(changed, f.settings, [recorded], []);
  expect(result.cycles[0]).toMatchObject({ cardioMinutes: 20, plannedSportMinutes: 0, recordedSportMinutes: 0 });
  expect(result.cycles[1].recordedSportMinutes).toBe(45);
});
it('never turns a missing, discarded, foreign or moved sport replacement into free time', () => {
  const f = fixture(8, 'UTC'), activity = sport('class', '2026-10-23T16:00Z');
  const block = changeCardioSlot(f.block, f.block.slots[0].id, '2026-10-23', 'SPORT', activity, [], now);
  for (const activities of [[], [{ ...activity, discardedAt: now }], [{ ...activity, userId: 'other' }],
    [{ ...activity, planned: { ...activity.planned!, startAt: Date.parse('2026-10-24T16:00Z') } }]]) {
    expect(() => reviewHybridCapacity(block, f.settings, activities, [])).toThrow('invalidHybridCapacity');
  }
  expect(reviewHybridCapacity(block, f.settings, [activity], []).cycles[0].totalMinutes).toBe(110);
});
it('counts moved/skipped cardio on its reviewed date and includes provisional future durations', () => {
  const f = fixture(8, 'UTC'), progressive = withCardioProgression(f.block);
  const moved = changeCardioSlot(progressive, progressive.slots[0].id, '2026-11-01', 'CARDIO', null, [], now);
  const next = changeCardioSlot(moved, moved.slots[1].id, moved.slots[1].date, 'SKIPPED', null, [], now);
  const result = reviewHybridCapacity(next, f.settings, [], []);
  expect(result.cycles[0]).toMatchObject({ cardioMinutes: 0, provisional: false });
  expect(result.cycles[1]).toMatchObject({ cardioMinutes: 60, provisional: true });
  expect(result.cycles[2].cardioMinutes).toBe(40); // Availability is already full; no invented progression.
  expect(reviewHybridCapacity(f.block, f.settings, [], []).cycles.every(r => !r.provisional)).toBe(true);
});
it('counts future forecast increases where availability permits without confirming them', () => {
  const f = fixture(); f.input.sessionMinutes = 40; f.input.cardioMinutes = 120;
  const bundle = prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, now);
  const block = withCardioProgression(createCardioBlock('growth', bundle.cardio, '2026-10-22', 4, 'UTC', now));
  const result = reviewHybridCapacity(block, { ...f.settings, totalMinutesPerCycle: 72 }, [], []);
  expect(result.cycles.map(c => c.cardioMinutes)).toEqual([40, 40, 42, 44]);
  expect(result.cycles[3]).toMatchObject({ overBudgetMinutes: 2, provisional: true });
  expect(block.progression!.reviews).toEqual([]);
});
it('replaces assigned strength forecasts by source cycle, including moves outside the horizon', () => {
  const f = fixture(8, 'UTC'), source = f.block.proposal.input.strength;
  const assigned: DatedStrength[] = [
    { id: 'moved', placementId: source[0].id, microcycleIndex: 0, date: '2026-11-01', demand: 'LOW', estimatedMinutes: 45 },
    { id: 'outside', placementId: source[1].id, microcycleIndex: 0, date: '2027-01-01', demand: 'LOW' },
    { id: 'extra', date: '2026-11-02', demand: 'HIGH', estimatedMinutes: 10 },
  ];
  const result = reviewHybridCapacity(f.block, f.settings, [], assigned);
  expect(result.cycles.map(c => c.strengthMinutes)).toEqual([0, 85, 30, 30]);
  const fallback = reviewHybridCapacity(f.block, f.settings, [], [{ id: 'default', placementId: source[0].id, microcycleIndex: 0, date: '2026-10-23', demand: 'LOW' }]);
  expect(fallback.cycles[0].strengthMinutes).toBe(30);
  expect(() => reviewHybridCapacity(f.block, f.settings, [], [{ id: 'unknown', date: '2026-10-23', demand: 'HIGH' }])).toThrow('invalidHybridCapacity');
});
it('checks exact budget and session ceilings without applying the workout ceiling to fixed classes', () => {
  const f = fixture(8, 'UTC'), settings = { ...f.settings, totalMinutesPerCycle: 70, maxSessionMinutes: 30 };
  expect(reviewHybridCapacity(f.block, settings, [], []).fits).toBe(true);
  expect(reviewHybridCapacity(f.block, f.settings, [sport('longClass', '2026-10-23T00:00Z', 180)], []).cycles[0].sessionLimitExceeded).toBe(false);
  const strength: DatedStrength[] = [{ id: 'long', date: '2026-10-23', demand: 'HIGH', estimatedMinutes: 31 }];
  expect(reviewHybridCapacity(f.block, settings, [], strength).cycles[0].sessionLimitExceeded).toBe(true);
  f.input.profile.modalities.CYCLING = { status: 'REGULAR', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 45 };
  f.input.sessionMinutes = 45; f.input.cardioMinutes = 90;
  const bundle = prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, now);
  const block = createCardioBlock('long', bundle.cardio, '2026-10-22', 1, 'UTC', now);
  expect(reviewHybridCapacity(block, settings, [], []).cycles[0].sessionLimitExceeded).toBe(true);
});
it('fails closed on malformed, duplicate or uncertain owned context', () => {
  const f = fixture(), activity = sport('class', '2026-10-23T16:00Z');
  const check = (block: any = f.block, settings: any = f.settings, sports: any = [], strength: any = []) =>
    expect(() => reviewHybridCapacity(block, settings, sports, strength)).toThrow('invalidHybridCapacity');
  check(null); check(f.block, {}); check(f.block, f.settings, null); check(f.block, f.settings, [], null);
  check(f.block, f.settings, [{ ...activity, planned: null }]); check(f.block, f.settings, [activity, activity]);
  const s: DatedStrength = { id: 's', date: '2026-10-23', demand: 'HIGH' };
  for (const bad of [null, { ...s, id: '' }, { ...s, date: 'bad' }, { ...s, demand: 'x' }, { ...s, estimatedMinutes: NaN },
    { ...s, estimatedMinutes: -1 }, { ...s, estimatedMinutes: 601 }, { ...s, microcycleIndex: -1 }]) check(f.block, f.settings, [], [bad]);
  check(f.block, f.settings, [], [s, s]);
});
