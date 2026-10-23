import type { Mesocycle, PlannedSession } from '@/models';
import type { ScheduleTemplate } from '@/models/routine';
import { validateScheduleTemplate } from './scheduleTemplate';
import { moveItem } from './workoutReview';

export type RoutineRestDay = NonNullable<Mesocycle['restDays']>[number];
export type RoutineDay = { kind: 'workout'; sessionIndex: number; id: string } | { kind: 'rest'; id: string };

export function orderedRoutineSessions<T extends { index: number }>(sessions: readonly T[], order?: readonly number[]): T[] {
  if (!order || order.length !== sessions.length || new Set(order).size !== sessions.length
    || order.some((index) => !sessions.some((session) => session.index === index))) return [...sessions];
  return order.map((index) => sessions.find((session) => session.index === index)!);
}

/** IDs stay attached to prescriptions/checkmarks when workouts and rest markers move. */
export function routineDays(sessions: readonly Pick<PlannedSession, 'index'>[], days: readonly RoutineRestDay[]): RoutineDay[] {
  restDaysTemplate(sessions, days);
  return [...days.filter((day) => day.afterSessionIndex === null).map((day) => ({ kind: 'rest' as const, id: day.id })),
    ...sessions.flatMap((session) => [{ kind: 'workout' as const, sessionIndex: session.index, id: `session-${session.index}` },
      ...days.filter((day) => day.afterSessionIndex === session.index).map((day) => ({ kind: 'rest' as const, id: day.id }))])];
}

export function moveRoutineDay(slots: readonly RoutineDay[], from: number, to: number) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= slots.length || to >= slots.length) throw Error('invalidRoutineMove');
  const moved = moveItem(slots, from, to);
  const sessionOrder = moved.flatMap((day) => day.kind === 'workout' ? [day.sessionIndex] : []);
  let afterSessionIndex: number | null = null;
  const restDays = moved.flatMap((day) => {
    if (day.kind === 'workout') { afterSessionIndex = day.sessionIndex; return []; }
    return [{ id: day.id, afterSessionIndex }];
  });
  const scheduleTemplate = restDaysTemplate(sessionOrder.map((index) => ({ index })), restDays);
  return { sessionOrder, restDays, scheduleTemplate };
}
export function routineRestDays(meso: Pick<Mesocycle, 'restDays' | 'scheduleTemplate'>): RoutineRestDay[] {
  if (meso.restDays) return meso.restDays.map((day) => ({ ...day }));
  let afterSessionIndex: number | null = null;
  return (meso.scheduleTemplate?.slots ?? []).flatMap((slot, index) => {
    if (slot.kind === 'workout') { afterSessionIndex = slot.sessionIndex; return []; }
    return [{ id: `rest-${index}`, afterSessionIndex }];
  });
}
export function restDayKey(microcycleIndex: number, id: string): string {
  if (!Number.isInteger(microcycleIndex) || microcycleIndex < 0 || typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw Error('invalidRestDay');
  return `${microcycleIndex}:${id}`;
}
export function restDaysTemplate(sessions: readonly Pick<PlannedSession, 'index'>[], days: readonly RoutineRestDay[]): ScheduleTemplate {
  const indexes = sessions.map((session) => session.index);
  if (new Set(days.map((day) => day.id)).size !== days.length || indexes.length + days.length > 28
    || days.some((day) => { try { restDayKey(0, day.id); } catch { return true; }
      return day.afterSessionIndex !== null && !indexes.includes(day.afterSessionIndex); })) throw Error('invalidRestDay');
  const slots: ScheduleTemplate['slots'] = days.filter((day) => day.afterSessionIndex === null).map(() => ({ kind: 'rest' }));
  for (const index of indexes) {
    slots.push({ kind: 'workout', sessionIndex: index });
    slots.push(...days.filter((day) => day.afterSessionIndex === index).map(() => ({ kind: 'rest' as const })));
  }
  const template = { days: slots.length, slots }; validateScheduleTemplate(template, indexes); return template;
}
