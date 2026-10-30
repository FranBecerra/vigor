import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '@/test-support/cardioFixture';
import { changeCardioSlot, cardioStartContext, coordinateCardioBlock, createCardioBlock, datedStrength, dateInZone, endCardioBlock, improveCardioDates, validCardioBlock } from '../cardioBlock';
import { saveSportDraft } from '../sportActivities';
import { startCardioWorkout, transitionCardioWorkout } from '../cardioWorkout';
import { shiftCalendarDate } from '@/services/training/trainingCalendar';

const sport = (date = now, id = 'padel', mode: 'PLAN' | 'RECORD' = 'PLAN') => saveSportDraft(id, 'owner', { sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode,
  startAt: date, durationMinutes: 60, timeZone: 'Europe/Madrid', effort: null }, Math.max(now, date + 3600000));
it('creates a finite eight-day block with exact easy prescriptions and no automatic progression', () => {
  const b = cardioFixture(), before = JSON.stringify(b.proposal);
  expect(b.slots).toHaveLength(4); expect(b.slots[2].date).toBe(shiftCalendarDate(b.slots[0].date, 8));
  expect(b.proposal.preview.prescriptions.every(p => p.stimulus === 'EASY')).toBe(true);
  b.slots[0].date = '2026-11-01'; expect(JSON.stringify(b.proposal)).toBe(before); expect(validCardioBlock(b, 'owner')).toBe(true);
  expect(dateInZone(Date.UTC(2026, 9, 29, 0, 30), 'America/New_York')).toBe('2026-10-28');
  expect(dateInZone(Date.UTC(2026, 9, 25, 2, 30), 'Europe/Madrid')).toBe('2026-10-25');
  expect(() => dateInZone(NaN, 'UTC')).toThrow(); expect(() => dateInZone(now, 'invalid')).toThrow();
});
it.each([null, { schemaVersion: 2 }, { id: '../bad' }, { userId: 'other' }, { proposal: null }, { startDate: '2026-02-30' },
  { timeZone: 'invalid' }, { cycles: 0 }, { cycles: 9 }, { createdAt: 0 }, { updatedAt: now - 1 }, { revision: 0 }, { endedAt: now - 1 },
  { endedAt: now + 1 }, { slots: [] }, { slots: null }])('rejects malformed blocks %p', patch => {
  expect(validCardioBlock(patch === null ? null : { ...cardioFixture(), ...patch }, 'owner')).toBe(false);
});
it('validates each slot and rejects duplicate ids, cycles, sport links and dates outside the finite horizon', () => {
  const b = cardioFixture();
  for (const patch of [null, { cycle: 99 }, { prescriptionId: 'missing' }, { id: 'bad' }, { date: '2026-10-28' }, { date: '2027-01-01' }, { date: 'invalid' }, { disposition: 'BAD' }, { sportId: 'not-sport' }, { disposition: 'SPORT', sportId: null }]) {
    expect(validCardioBlock({ ...b, slots: b.slots.map((s, i) => i ? s : patch === null ? null : { ...s, ...patch }) }, 'owner')).toBe(false);
  }
  expect(validCardioBlock({ ...b, slots: [b.slots[0], b.slots[0], ...b.slots.slice(2)] }, 'owner')).toBe(false);
  const a = changeCardioSlot(b, b.slots[0].id, '2026-10-29', 'SPORT', sport(), [], now + 1);
  expect(validCardioBlock(a, 'owner')).toBe(true);
  expect(() => changeCardioSlot(a, a.slots[1].id, '2026-10-29', 'SPORT', sport(), [], now + 2)).toThrow();
  expect(() => createCardioBlock('b', { ...b.proposal, archivedAt: now }, b.startDate, 2, 'UTC', now)).toThrow();
  expect(() => createCardioBlock('b', b.proposal, b.startDate, 9, 'UTC', now)).toThrow();
  expect(() => createCardioBlock('b', b.proposal, '9999-12-31', 8, 'UTC', now)).toThrow();
});
it('moves, skips, restores and explicitly substitutes without changing sport records or marking a reservation complete', () => {
  const b = cardioFixture(), lesson = sport(), copy = JSON.stringify([b, lesson]);
  const linked = changeCardioSlot(b, b.slots[0].id, '2026-10-29', 'SPORT', lesson, [], now + 1);
  expect(coordinateCardioBlock(linked, [lesson], [])[0].coveredBySport).toBe(false);
  const record = sport(now, 'padel', 'RECORD');
  expect(coordinateCardioBlock(linked, [record], [])[0].coveredBySport).toBe(true);
  expect(coordinateCardioBlock(linked, [], [])[0].issues).toContain('SPORT_CHANGED');
  expect(coordinateCardioBlock(linked, [sport(now + 86400000)], [])[0].issues).toContain('SPORT_CHANGED');
  const skipped = changeCardioSlot(linked, linked.slots[0].id, linked.slots[0].date, 'SKIPPED', null, [], now + 2);
  expect(coordinateCardioBlock(skipped, [lesson], [])[0].issues).toEqual([]);
  expect(changeCardioSlot(skipped, skipped.slots[0].id, skipped.slots[0].date, 'CARDIO', null, [], now + 3).slots[0].sportId).toBeNull();
  expect(JSON.stringify([b, lesson])).toBe(copy);
  expect(() => changeCardioSlot(b, b.slots[0].id, '2026-10-30', 'SPORT', lesson, [], now)).toThrow();
  expect(() => changeCardioSlot(b, b.slots[0].id, '2026-10-29', 'SPORT', { ...lesson, userId: 'other' }, [], now)).toThrow();
});
it('locks executed slots, rejects stale/ended actions and preserves completed history on block ending', () => {
  const b = cardioFixture(), id = b.slots[0].id, run = startCardioWorkout(b, id, now, 'run');
  expect(() => changeCardioSlot(b, id, '2026-10-30', 'CARDIO', null, [run], now + 1)).toThrow('cardioSlotLocked');
  const discarded = transitionCardioWorkout(run, 'DISCARD', now + 1);
  expect(changeCardioSlot(b, id, '2026-10-30', 'CARDIO', null, [discarded], now + 2).slots[0].date).toBe('2026-10-30');
  const ended = endCardioBlock(b, now + 1); expect(ended.endedAt).toBe(now + 1); expect(b.endedAt).toBeNull();
  expect(() => endCardioBlock(ended, now + 2)).toThrow(); expect(() => endCardioBlock(b, now - 1)).toThrow();
  expect(() => endCardioBlock({ ...b, revision: Number.MAX_SAFE_INTEGER }, now)).toThrow();
  for (const bad of [ended, { ...b, updatedAt: now + 1 }, { ...b, revision: Number.MAX_SAFE_INTEGER }]) expect(() => changeCardioSlot(bad, id, '2026-10-30', 'CARDIO', null, [], now)).toThrow();
  expect(() => changeCardioSlot(b, 'missing', '2026-10-30', 'CARDIO', null, [], now)).toThrow();
});
it('uses actual strength dates separately from labelled forecasts and identifies all dated limit breaches', () => {
  expect(datedStrength()).toEqual([]);
  const routine = { microcycles: [{ sessions: [
    { name: 'Upper', plannedSessionIndex: 0, scheduledOn: '2026-10-29', exercises: [{ primaryMuscle: 'CHEST', secondaryMuscles: [] }] },
    { plannedSessionIndex: 1, scheduledOn: '2026-10-30', completedOn: '2026-10-31', exercises: [{ primaryMuscle: 'QUADS', secondaryMuscles: [] }] },
    { plannedSessionIndex: 2, scheduledOn: 'invalid', exercises: [] }, { plannedSessionIndex: 3, exercises: [] },
    { plannedSessionIndex: 4, scheduledOn: '2026-11-01', skippedOn: '2026-11-01', exercises: [] },
    { plannedSessionIndex: 5, scheduledOn: '2026-11-02', exercises: [] },
  ] }] } as any;
  expect(datedStrength(routine).map(s => [s.date, s.demand])).toEqual([['2026-10-29', 'LOW'], ['2026-10-31', 'HIGH'], ['2026-11-02', 'HIGH']]);
  const midnight = { microcycles: [{ sessions: [{ plannedSessionIndex: 0, completedOn: '2026-10-28', completedAtMs: Date.UTC(2026, 9, 28, 23, 30), exercises: [] }] }] } as any;
  expect(datedStrength(midnight, 'Europe/Madrid')[0].date).toBe('2026-10-29');
  let b = cardioFixture({ availableDays: [0, 3], maxActiveDays: 2 });
  b = changeCardioSlot(b, b.slots[1].id, b.slots[0].date, 'CARDIO', null, [], now + 1);
  const issues = coordinateCardioBlock(b, [sport(), { ...sport(), userId: 'other' }, { ...sport(), discardedAt: now }], datedStrength(routine))[0].issues;
  expect(issues).toEqual(expect.arrayContaining(['STRENGTH', 'SPORT', 'CARDIO', 'ACTIVE_DAYS']));
  const otherCycle = changeCardioSlot(b, b.slots[2].id, '2026-10-30', 'CARDIO', null, [], now + 2);
  expect(coordinateCardioBlock(otherCycle, [], [])[2].issues).toEqual(expect.arrayContaining(['AVAILABILITY', 'TIME']));
  const cycling = cardioFixture({ modalities: ['CYCLING'], allowDoubles: true });
  expect(coordinateCardioBlock(cycling, [], [{ id: 'a', date: cycling.slots[0].date, demand: 'HIGH' }])[0].issues).not.toContain('STRENGTH');
  const forecast = cardioFixture({ strength: [{ id: 'r:0', name: 'Lower', dayIndex: 0, estimatedMinutes: 60, lowerBodyDemand: 'HIGH' }] });
  expect(coordinateCardioBlock(forecast, [], []).map(r => r.issues)).toHaveLength(4);
});
it('optimizes finite dates without moving sports, strength or performed work, and crosses DST by civil date', () => {
  const b = cardioFixture(), original = JSON.stringify(b), strength = [{ id: 'lower', date: b.slots[0].date, demand: 'HIGH' as const }];
  const moved = improveCardioDates(b, [], strength, [], now + 1);
  expect(coordinateCardioBlock(moved, [], strength).reduce((n, r) => n + r.issues.length, 0)).toBeLessThan(coordinateCardioBlock(b, [], strength).reduce((n, r) => n + r.issues.length, 0));
  expect(moved.revision).toBe(2); expect(JSON.stringify(b)).toBe(original);
  expect(improveCardioDates(b, [], [], [], now)).toBe(b);
  const run = startCardioWorkout(b, b.slots[0].id, now, 'run'); expect(improveCardioDates(b, [], strength, [run], now).slots[0].date).toBe(b.slots[0].date);
  const linked = changeCardioSlot(b, b.slots[0].id, '2026-10-29', 'SPORT', sport(), [], now);
  expect(improveCardioDates(linked, [sport()], strength, [], now).slots[0]).toEqual(linked.slots[0]);
  expect(() => improveCardioDates(endCardioBlock(b, now), [], [], [], now)).toThrow();
});

it('reviews actual-today context when starting ahead/late without silently moving the saved schedule', () => {
  const b = cardioFixture(), copy = JSON.stringify(b);
  expect(cardioStartContext(b, b.slots[0].id, now, [], []).review).toBe(false);
  expect(cardioStartContext(b, b.slots[1].id, now, [], []).review).toBe(true);
  expect(cardioStartContext(b, b.slots[0].id, now, [sport()], []).issues).toContain('SPORT');
  expect(cardioStartContext(b, b.slots[0].id, now - 20 * 86400000, [], []).issues).toEqual(['OUTSIDE_BLOCK']);
  expect(() => cardioStartContext(b, 'missing', now, [], [])).toThrow(); expect(JSON.stringify(b)).toBe(copy);
});

it('replaces the matching v2 forecast with its assigned date, preserving other cycles and unrelated strength', () => {
  const b = cardioFixture({ placementPolicy: 'BALANCED_V2', sessions: 1, strength: [
    { id: 'r:0', name: 'Lower', dayIndex: 3, estimatedMinutes: 60, lowerBodyDemand: 'HIGH' },
  ] });
  const sunday = changeCardioSlot(b, b.slots[0].id, '2026-11-01', 'CARDIO', null, [], now + 1);
  const actual = [{ id: '0:0', placementId: 'r:0', microcycleIndex: 0, date: '2026-10-29', demand: 'HIGH' as const }];
  expect(coordinateCardioBlock(sunday, [], [])[0].issues).toContain('STRENGTH');
  expect(coordinateCardioBlock(sunday, [], actual)[0].issues).not.toContain('STRENGTH');
  expect(coordinateCardioBlock(sunday, [], [...actual, { id: 'unrelated', date: '2026-11-01', demand: 'HIGH' as const }])[0].issues).toContain('STRENGTH');
  const next = changeCardioSlot(sunday, b.slots[1].id, '2026-11-09', 'CARDIO', null, [], now + 2);
  expect(coordinateCardioBlock(next, [], actual)[1].issues).toContain('STRENGTH');
  const advanced = { id: 'r', currentMicrocycleIndex: 1, microcycles: [{ sessions: [
    { plannedSessionIndex: 0, completedOn: '2026-10-29', exercises: [{ primaryMuscle: 'QUADS' }] },
  ] }, { sessions: [] }] } as any;
  expect(datedStrength(advanced)[0]).toMatchObject({ microcycleIndex: 0, placementId: 'r:0' });
  expect(coordinateCardioBlock(sunday, [], datedStrength(advanced))[0].issues).not.toContain('STRENGTH');
  const laterOrigin = { ...sunday, proposal: { ...sunday.proposal, strengthSource: { ...sunday.proposal.strengthSource!, microcycleIndex: 4 } } };
  expect(coordinateCardioBlock(laterOrigin, [], actual.map(s => ({ ...s, microcycleIndex: 4 })))[0].issues).not.toContain('STRENGTH');
});

it('does not classify upper-body secondary stabilizers as a leg session and accepts a three-day gap', () => {
  const strength = datedStrength({ id: 'r', currentMicrocycleIndex: 0, microcycles: [{ sessions: [
    { plannedSessionIndex: 0, completedOn: '2026-11-01', exercises: [{ primaryMuscle: 'CHEST', secondaryMuscles: ['GLUTES'] }] },
  ] }] } as any);
  expect(strength[0].demand).toBe('LOW');
  const b = cardioFixture({ sessions: 1, allowDoubles: true });
  const sunday = changeCardioSlot(b, b.slots[0].id, '2026-11-01', 'CARDIO', null, [], now + 1);
  expect(coordinateCardioBlock(sunday, [], strength)[0].issues).not.toContain('STRENGTH');
  expect(coordinateCardioBlock(sunday, [], [{ id: 'lower', date: '2026-10-29', demand: 'HIGH' }])[0].issues).not.toContain('STRENGTH');
});

it('improves v2 same-day balance without moving performed opportunities or exceeding availability', () => {
  const free = cardioFixture({ placementPolicy: 'BALANCED_V2' });
  expect(improveCardioDates(free, [], [], [], now + 1)).toBe(free);
  const b = cardioFixture({ placementPolicy: 'BALANCED_V2', sessions: 1, availableDays: [0, 2], allowDoubles: true, maxActiveDays: 2,
    strength: [{ id: 'r:0', name: 'Upper', dayIndex: 0, estimatedMinutes: 90, lowerBodyDemand: 'LOW' },
      { id: 'r:1', name: 'Push', dayIndex: 2, estimatedMinutes: 30, lowerBodyDemand: 'LOW' }] });
  const heavy = changeCardioSlot(b, b.slots[0].id, '2026-10-29', 'CARDIO', null, [], now + 1);
  const moved = improveCardioDates(heavy, [], [], [], now + 2);
  expect(moved.slots[0].date).toBe('2026-10-31');
  expect(coordinateCardioBlock(moved, [], [])[0].issues).toEqual([]);
  const run = startCardioWorkout(heavy, heavy.slots[0].id, now + 1, 'run');
  expect(improveCardioDates(heavy, [], [], [run], now + 2).slots[0].date).toBe('2026-10-29');
});
