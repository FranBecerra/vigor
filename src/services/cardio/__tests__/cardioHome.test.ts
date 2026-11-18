import { cardioHomeSessions, cardioHomeCycle, cardioCalendarRows } from '../cardioHome';
import { hybridFixture } from '@/test-support/hybridFixture';
import { prepareHybridBundle } from '../hybridAuthoring';
import { changeCardioSlot, createCardioBlock } from '../cardioBlock';
import { shiftCalendarDate } from '@/services/training/trainingCalendar';
import { startCardioWorkout, transitionCardioWorkout } from '../cardioWorkout';
import { toRoutineView } from '@/services/training/routineView';
import { routineDays, routineRestDays } from '@/services/training/routineRestDays';

const now = Date.UTC(2026, 10, 10, 12);
function fixture() {
  const f = hybridFixture(); f.draft.mesocycle.startedAt = now - 1000;
  const bundle = prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, now);
  const routine = toRoutineView({ ...bundle.routine, isActive: true }, bundle.mesocycle, f.exercises, f.labels)!;
  const block = createCardioBlock('block', bundle.cardio, '2026-11-10', 4, 'Europe/Madrid', now);
  const days = routineDays(bundle.mesocycle.plannedSessions!, routineRestDays(bundle.mesocycle));
  return { block, routine, days };
}
it('shows an eight-day linked rhythm without changing either plan or merging block identities', () => {
  const f = fixture(), before = JSON.stringify(f);
  const rows = cardioCalendarRows(f.routine, f.days, [f.block], [], 'owner');
  expect([...rows.values()].flat().map(s => s.slot.id).sort()).toEqual(f.block.slots.filter(s => s.cycle === 0).map(s => s.id).sort());
  expect(rows.size).toBeGreaterThan(0); expect(JSON.stringify(f)).toBe(before);
  expect(cardioHomeCycle(f.block, cardioHomeSessions(f.block, []))).toBe(0);
});

it('moves an adjusted opportunity to the new shared-calendar day without changing its cycle or dose', () => {
  const { block, routine, days } = fixture();
  const slot = block.slots[0];
  const previous = cardioCalendarRows(routine, days, [block], [], 'owner');
  const target = days.findIndex(day => !previous.get(day.id)?.some(entry => entry.slot.id === slot.id));
  const nextDate = shiftCalendarDate(block.startDate, target);
  const moved = changeCardioSlot(block, slot.id, nextDate, 'CARDIO', null, [], now + 1);
  const calendar = cardioCalendarRows(routine, days, [moved], [], 'owner');
  const instances = [...calendar].flatMap(([key, entries]) => entries.filter(entry => entry.slot.id === slot.id).map(entry => ({ key, entry })));
  expect(instances).toEqual([{ key: days[target].id, entry: expect.objectContaining({
    slot: { ...slot, date: nextDate }, date: nextDate, seconds: cardioHomeSessions(block, []).find(entry => entry.slot.id === slot.id)!.seconds,
  }) }]);
});
it('keeps unknown, changed, inactive and foreign-owner strength context out of the relative calendar', () => {
  const f = fixture();
  for (const routine of [{ ...f.routine, isActive: false }, { ...f.routine, mesocycleSnapshot: undefined },
    { ...f.routine, id: 'other' }, { ...f.routine, currentMicrocycleIndex: 99 }]) {
    expect(cardioCalendarRows(routine, f.days, [f.block], [], 'owner').size).toBe(0);
  }
  expect(cardioCalendarRows(f.routine, f.days, [f.block], [], 'other').size).toBe(0);
  expect(cardioCalendarRows(f.routine, f.days, [{ ...f.block, userId: 'other' }, { ...f.block, endedAt: now }], [], 'owner').size).toBe(0);
  const changed = { ...f.block, proposal: { ...f.block.proposal, strengthSource: { ...f.block.proposal.strengthSource!, fingerprint: 'changed' } } };
  expect(cardioCalendarRows(f.routine, f.days, [changed], [], 'owner').size).toBe(0);
});
it('uses explicit strength dates for detached cardio and does not duplicate ambiguous dates', () => {
  const { block, routine, days } = fixture();
  const slot = block.slots[0], detached = { ...block, proposal: { ...block.proposal, strengthSource: null } };
  const current = routine.microcycles[0];
  routine.microcycles = [{ ...current, sessions: current.sessions.map((s, i) => ({ ...s, scheduledOn: i === 0 ? slot.date : undefined })) }];
  expect([...cardioCalendarRows(routine, days, [detached], [], 'owner').values()].flat().map(e => e.slot.id)).toContain(slot.id);
  routine.microcycles[0].sessions.forEach(s => { s.scheduledOn = slot.date; });
  expect(cardioCalendarRows(routine, days, [detached], [], 'owner').size).toBe(0);
});
it('projects later independent cycle positions only within a compatible horizon', () => {
  const f = fixture(); f.routine.currentMicrocycleIndex = 1;
  expect([...cardioCalendarRows(f.routine, f.days, [f.block], [], 'owner').values()].flat().every(s => s.slot.cycle === 1)).toBe(true);
  expect([...cardioCalendarRows(f.routine, f.days, [f.block], [], 'owner').values()].flat()).toHaveLength(2);
  expect(cardioCalendarRows(f.routine, f.days.slice(0, 7), [f.block], [], 'owner').size).toBe(0);
});
it('resolves skips separately from completed work and ignores discarded/foreign workouts', () => {
  const { block } = fixture();
  const start = startCardioWorkout(block, block.slots[0].id, now + 1000, 'workout');
  const done = transitionCardioWorkout(start, 'FINISH', now + 61000, 60);
  const rows = cardioHomeSessions(block, [done, { ...done, userId: 'other' }]);
  expect(rows[0]).toMatchObject({ completed: true, seconds: 60 });
  expect(cardioHomeCycle(block, rows)).toBe(0);
  const discarded = { ...done, status: 'DISCARDED' as const, updatedAt: done.updatedAt + 1, revision: done.revision + 1 };
  expect(cardioHomeSessions(block, [done, discarded])[0].completed).toBe(false);
  block.slots.filter(s => s.cycle === 0).forEach(s => { s.disposition = 'SKIPPED'; });
  expect(cardioHomeCycle(block, cardioHomeSessions(block, []))).toBe(1);
  expect(cardioHomeSessions(block, [])[0]).toMatchObject({ resolved: true, completed: false });
  block.slots.forEach(s => { s.disposition = 'SKIPPED'; });
  expect(cardioHomeCycle(block, cardioHomeSessions(block, []))).toBe(3);
});
it('does not turn a sport reservation, missing record or wrong-day sport into completed cardio', () => {
  const { block } = fixture(); block.slots[0] = { ...block.slots[0], disposition: 'SPORT', sportId: 'sport' };
  const sport: any = { id: 'sport', userId: 'owner', discardedAt: null, record: null };
  expect(cardioHomeSessions(block, [], [sport])[0].resolved).toBe(false);
  sport.record = { startAt: Date.parse(block.slots[0].date + 'T12:00:00Z') };
  expect(cardioHomeSessions(block, [], [sport])[0]).toMatchObject({ resolved: true, completed: false });
  sport.record.startAt += 86400000;
  expect(cardioHomeSessions(block, [], [sport])[0].resolved).toBe(false);
});

it('uses the latest correction and deterministically orders two sessions on the same day', () => {
  const { block, routine, days } = fixture();
  const start = startCardioWorkout(block, block.slots[0].id, now + 1000, 'a');
  const done = transitionCardioWorkout(start, 'FINISH', now + 61000, 60);
  const corrected = { ...done, revision: done.revision + 1, actualSeconds: 120 };
  expect(cardioHomeSessions(block, [done, corrected])[0].seconds).toBe(120);
  const other = { ...corrected, id: 'b' };
  expect(cardioHomeSessions(block, [other, corrected])[0].workout?.id).toBe('a');
  block.slots[1].date = block.slots[0].date;
  const rows = [...cardioCalendarRows(routine, days, [block], [], 'owner').values()].flat();
  expect(rows).toHaveLength(2); expect(new Set(rows.map(r => r.slot.id)).size).toBe(2);
});

it('does not reuse an earlier mesocycle anchor after the strength routine starts a successor', () => {
  const { block, routine, days } = fixture();
  routine.mesocycleSnapshot = { ...routine.mesocycleSnapshot!, startedAt: block.createdAt + 1 };
  expect(cardioCalendarRows(routine, days, [block], [], 'owner').size).toBe(0);
  expect(cardioCalendarRows(routine, [], [], [], 'owner').size).toBe(0);
});
