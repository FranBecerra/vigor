import { SetType, type PlannedSession } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { calendarFromTemplate, calendarRecovery, calendarVolumeRate, moveCalendarEntry, preferredRestBoundaries, proposeCalendar, shiftCalendarDate, updateCalendar,
  validCalendarDate } from '../trainingCalendar';

it('dates the exact undated structure without changing rest positions or workout order', () => {
  const template = { days: 3, slots: [{ kind: 'rest' as const },
    { kind: 'workout' as const, sessionIndex: 0 }, { kind: 'workout' as const, sessionIndex: 1 }] };
  const result = calendarFromTemplate('2026-03-28', 2, template);
  expect(result['rest:2026-03-28']).toMatchObject({ checked: false, microcycleIndex: 2 });
  expect(result['2:0'].date).toBe('2026-03-29');
  expect(result['2:1'].date).toBe('2026-03-30');
  expect(() => calendarFromTemplate('invalid', 2, template)).toThrow();
  expect(() => calendarFromTemplate('2026-03-28', -1, template)).toThrow();
});

it('validates civil dates including leap years and DST boundaries', () => {
  expect(validCalendarDate('2024-02-29')).toBe(true);
  expect(validCalendarDate('2025-02-29')).toBe(false);
  expect(validCalendarDate('2026-13-01')).toBe(false);
  expect(validCalendarDate('yesterday')).toBe(false);
  expect(shiftCalendarDate('2026-03-28', 2)).toBe('2026-03-30');
  expect(() => shiftCalendarDate('bad', 1)).toThrow();
});

it('supports non-seven-day microcycles and independent rest checkmarks', () => {
  const calendar = proposeCalendar('2026-09-30', 9, 2, [0, 1, 2, 3]);
  expect(Object.values(calendar).filter((e) => e.kind === 'workout')).toHaveLength(4);
  expect(Object.values(calendar).filter((e) => e.kind === 'rest')).toHaveLength(5);
  const rest = Object.values(calendar).find((e) => e.kind === 'rest')!;
  if (rest.kind !== 'rest') throw new Error();
  const checked = updateCalendar(calendar, { ...rest, checked: true });
  expect(Object.values(checked).filter((e) => e.kind === 'workout')).toEqual(
    Object.values(calendar).filter((e) => e.kind === 'workout'));
  expect(calendarVolumeRate(checked, 2, 90)).toEqual({ days: 9, setsPerSevenDays: 70 });
  expect(calendarVolumeRate({}, 0, 90)).toBeNull();
});

it('rejects collisions and impossible or malformed schedules', () => {
  const calendar = proposeCalendar('2026-01-01', 7, 0, [0, 1, 2]);
  expect(() => updateCalendar(calendar, { kind: 'rest', date: '2026-01-01', microcycleIndex: 0, checked: false })).toThrow();
  expect(() => updateCalendar({}, { kind: 'workout', date: '2026-01-01', microcycleIndex: -1, sessionIndex: 0 })).toThrow();
  expect(() => proposeCalendar('2026-01-01', 2, 0, [0, 1, 2])).toThrow();
  expect(() => proposeCalendar('2026-01-01', 7, 0, [0, 0])).toThrow();
  expect(() => proposeCalendar('2026-01-01', 29, 0, [0])).toThrow();
});

it('moves a workout into an unchecked rest day and leaves rest on its old date', () => {
  const calendar = proposeCalendar('2026-01-01', 7, 0, [0, 1, 2]);
  const moved = moveCalendarEntry(calendar, '0:0', '2026-01-02');
  expect(moved['0:0'].date).toBe('2026-01-02');
  expect(moved['rest:2026-01-01']).toMatchObject({ kind: 'rest', checked: false });
  expect(moved['rest:2026-01-02']).toBeUndefined();
  expect(calendar['0:0'].date).toBe('2026-01-01');
  expect(() => moveCalendarEntry(calendar, 'missing', '2026-01-02')).toThrow();
  expect(moveCalendarEntry(calendar, '0:0', '2026-01-01')).toBe(calendar);
  const checked = updateCalendar(calendar, { kind: 'rest', date: '2026-01-02', microcycleIndex: 0, checked: true });
  expect(() => moveCalendarEntry(checked, '0:0', '2026-01-02')).toThrow();
});

it('checks actual gaps across microcycle boundaries without assuming a universal recovery threshold', () => {
  const exercise = EXERCISE_CATALOGUE[0];
  const sessions: PlannedSession[] = [{ index: 0, focus: 'PUSH', estimatedWorkMinutes: 12,
    exercises: [{ exerciseId: exercise.id, order: 0, isEdited: false,
      sets: Array.from({ length: 3 }, () => ({ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 })) }] }];
  const calendar = { '0:0': { kind: 'workout' as const, date: '2026-01-01', microcycleIndex: 0, sessionIndex: 0 },
    '1:0': { kind: 'workout' as const, date: '2026-01-02', microcycleIndex: 1, sessionIndex: 0 } };
  expect(calendarRecovery(calendar, () => sessions, new Map([[exercise.id, exercise]]))[0])
    .toMatchObject({ gapDays: 1, reviewSuggested: true, sharedMuscles: [exercise.primaryMuscle] });
  const later = updateCalendar(calendar, { ...calendar['1:0'], date: '2026-01-04' });
  expect(calendarRecovery(later, () => sessions, new Map([[exercise.id, exercise]]))[0].reviewSuggested).toBe(false);
  expect(calendarRecovery(calendar, () => [], new Map())[0].sharedMuscles).toEqual([]);
  const pair = [sessions[0], { ...sessions[0], index: 1 }];
  expect(preferredRestBoundaries(pair, new Map([[exercise.id, exercise]]))).toEqual([1]);
  const spaced = proposeCalendar('2026-01-01', 3, 0, [0, 1], [1]);
  expect(spaced['0:1'].date).toBe('2026-01-03');
  expect(preferredRestBoundaries(pair, new Map())).toEqual([]);
});
