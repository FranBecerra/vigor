import { moveRoutineDay, orderedRoutineSessions, restDayKey, restDaysTemplate, routineDays, routineRestDays } from '../routineRestDays';

const sessions = [{ index: 2 }, { index: 5 }];
it('moves workouts and consecutive rest markers without renumbering prescriptions or check IDs', () => {
  const days = [{ id: 'a', afterSessionIndex: 2 }, { id: 'b', afterSessionIndex: 2 }];
  const slots = routineDays(sessions, days); const snapshot = JSON.stringify(slots);
  const moved = moveRoutineDay(slots, 3, 0);
  expect(moved.sessionOrder).toEqual([5, 2]);
  expect(moved.restDays).toEqual(days);
  const next = moveRoutineDay(routineDays(orderedRoutineSessions(sessions, moved.sessionOrder), moved.restDays), 2, 0);
  expect(next.restDays).toEqual([{ id: 'a', afterSessionIndex: null }, { id: 'b', afterSessionIndex: 2 }]);
  expect(next.scheduleTemplate.days).toBe(4); expect(JSON.stringify(slots)).toBe(snapshot);
  expect(orderedRoutineSessions(sessions, [5, 2])).toEqual([sessions[1], sessions[0]]);
  for (const invalid of [[2, 2], [9, 2], [2], []]) expect(orderedRoutineSessions(sessions, invalid)).toEqual(sessions);
  for (const [from, to] of [[-1, 0], [0, 9], [NaN, 1], [0.5, 1]]) expect(() => moveRoutineDay(slots, from, to)).toThrow();
});
it('seeds stable rest markers before/after sessions without civil dates', () => {
  const scheduleTemplate = { days: 5, slots: [{ kind: 'rest' as const }, { kind: 'workout' as const, sessionIndex: 2 },
    { kind: 'rest' as const }, { kind: 'workout' as const, sessionIndex: 5 }, { kind: 'rest' as const }] };
  const days = routineRestDays({ scheduleTemplate });
  expect(days).toEqual([{ id: 'rest-0', afterSessionIndex: null }, { id: 'rest-2', afterSessionIndex: 2 }, { id: 'rest-4', afterSessionIndex: 5 }]);
  expect(restDaysTemplate(sessions, days)).toEqual(scheduleTemplate);
  expect(routineRestDays({})).toEqual([]);
  expect(routineRestDays({ restDays: [] })).toEqual([]);
  const saved = [{ id: 'saved', afterSessionIndex: 5 }];
  expect(routineRestDays({ restDays: saved, scheduleTemplate })).toEqual(saved);
  expect(routineRestDays({ restDays: saved })[0]).not.toBe(saved[0]);
});
it('preserves workout ordering and check identity through add/remove, including long microcycles', () => {
  const days = Array.from({ length: 8 }, (_, i) => ({ id: `rest-${i}`, afterSessionIndex: i % 2 ? 5 : 2 }));
  expect(restDaysTemplate(sessions, days).days).toBe(10);
  expect(restDaysTemplate(sessions, days).slots.filter((slot) => slot.kind === 'workout')).toEqual([
    { kind: 'workout', sessionIndex: 2 }, { kind: 'workout', sessionIndex: 5 },
  ]);
  expect(restDayKey(0, 'rest-1')).not.toBe(restDayKey(1, 'rest-1'));
  expect(restDayKey(8, 'rest-1')).toBe('8:rest-1');
  expect(restDaysTemplate(sessions, []).days).toBe(2);
});
it.each([-1, 0.5, NaN, Infinity])('rejects invalid microcycle index %s', (index) => expect(() => restDayKey(index, 'id')).toThrow());
it.each(['', 'a.b', 'a/b', 'a:b', 'a'.repeat(101), undefined])('rejects invalid rest identity %s', (id) => expect(() => restDayKey(0, id as string)).toThrow());
it('rejects duplicates, missing anchors, invalid IDs and oversized or empty schedules', () => {
  const day = { id: 'rest', afterSessionIndex: 2 };
  expect(() => restDaysTemplate(sessions, [day, day])).toThrow();
  expect(() => restDaysTemplate(sessions, [{ ...day, afterSessionIndex: 9 }])).toThrow();
  expect(() => restDaysTemplate(sessions, [{ ...day, id: 'invalid/id' }])).toThrow();
  expect(() => restDaysTemplate(sessions, Array.from({ length: 27 }, (_, i) => ({ ...day, id: `r${i}` })))).toThrow();
  expect(() => restDaysTemplate([], [])).toThrow();
});
