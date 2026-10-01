/** Calendar dates use civil UTC arithmetic to avoid DST changing day distances. */
import type { TrainingCalendarEntry } from '@/models/routine';
import type { PlannedSession, Exercise } from '@/models';
import { validateScheduleTemplate, type ScheduleTemplate } from './scheduleTemplate';
export type TrainingCalendar = Record<string, TrainingCalendarEntry>;
const DAY = 86_400_000;

export function calendarFromTemplate(start: string, microcycleIndex: number, template: ScheduleTemplate): TrainingCalendar {
  validateScheduleTemplate(template, template.slots.flatMap((s) => s.kind === 'workout' ? [s.sessionIndex] : []));
  return template.slots.reduce((calendar, slot, day) => updateCalendar(calendar,
    slot.kind === 'workout' ? { ...slot, date: shiftCalendarDate(start, day), microcycleIndex }
      : { kind: 'rest', date: shiftCalendarDate(start, day), microcycleIndex, checked: false }), {} as TrainingCalendar);
}

export function validCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}
export function shiftCalendarDate(date: string, days: number): string {
  if (!validCalendarDate(date) || !Number.isInteger(days)) throw new Error('Invalid calendar date');
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
export function calendarEntryKey(entry: TrainingCalendarEntry): string {
  return entry.kind === 'workout' ? `${entry.microcycleIndex}:${entry.sessionIndex}` : `rest:${entry.date}`;
}
export function updateCalendar(calendar: TrainingCalendar, entry: TrainingCalendarEntry): TrainingCalendar {
  if (!validCalendarDate(entry.date) || !Number.isInteger(entry.microcycleIndex) || entry.microcycleIndex < 0
    || (entry.kind === 'workout' && (!Number.isInteger(entry.sessionIndex) || entry.sessionIndex < 0))) {
    throw new Error('Invalid calendar entry');
  }
  const key = calendarEntryKey(entry);
  if (Object.entries(calendar).some(([id, existing]) => id !== key && existing.date === entry.date)) {
    throw new Error('A workout or rest day is already scheduled on this date');
  }
  return { ...calendar, [key]: entry };
}

export function moveCalendarEntry(calendar: TrainingCalendar, key: string, date: string): TrainingCalendar {
  const entry = calendar[key];
  if (!entry) throw new Error('Missing calendar entry');
  if (entry.date === date) return calendar;
  const copy = { ...calendar };
  delete copy[key];
  const destinationRest = copy[`rest:${date}`];
  if (destinationRest?.kind === 'rest' && !destinationRest.checked) delete copy[`rest:${date}`];
  let result = updateCalendar(copy, { ...entry, date });
  if (entry.kind === 'workout') result = updateCalendar(result, {
    kind: 'rest', date: entry.date, microcycleIndex: entry.microcycleIndex, checked: false,
  });
  return result;
}

/** Even spacing is a scheduling convenience, not a recovery guarantee. */
export function proposeCalendar(start: string, days: number, microcycleIndex: number,
  sessionIndexes: readonly number[], restBeforeSessionIndexes: readonly number[] = []): TrainingCalendar {
  if (!validCalendarDate(start) || !Number.isInteger(days) || days < sessionIndexes.length || days > 28
    || days < 1 || new Set(sessionIndexes).size !== sessionIndexes.length) throw new Error('Invalid calendar range');
  let result: TrainingCalendar = {};
  const gaps = Array<number>(sessionIndexes.length).fill(0);
  let spareDays = days - sessionIndexes.length;
  for (const index of new Set(restBeforeSessionIndexes)) {
    const position = sessionIndexes.indexOf(index);
    if (position > 0 && spareDays > 0) { gaps[position - 1] += 1; spareDays -= 1; }
  }
  while (spareDays > 0 && gaps.length) {
    const smallest = Math.min(...gaps);
    gaps[gaps.indexOf(smallest)] += 1;
    spareDays -= 1;
  }
  let offset = 0;
  const byDay = new Map(sessionIndexes.map((index, position) => {
    const day = restBeforeSessionIndexes.length ? offset : Math.floor(position * days / sessionIndexes.length);
    offset += 1 + gaps[position];
    return [day, index];
  }));
  for (let day = 0; day < days; day += 1) {
    const date = shiftCalendarDate(start, day);
    const index = byDay.get(day);
    result = updateCalendar(result, index === undefined ? { kind: 'rest', date, microcycleIndex, checked: false }
      : { kind: 'workout', date, microcycleIndex, sessionIndex: index });
  }
  return result;
}

/** Allocate available rest slots first to pairs sharing more direct work. */
export function preferredRestBoundaries(sessions: readonly PlannedSession[], catalogue: ReadonlyMap<string, Exercise>): number[] {
  const direct = sessions.map((session) => {
    const counts = new Map<string, number>();
    session.exercises.forEach((entry) => {
      const muscle = catalogue.get(entry.exerciseId)?.primaryMuscle;
      if (muscle) counts.set(muscle, (counts.get(muscle) ?? 0) + entry.sets.length);
    });
    return counts;
  });
  return sessions.slice(1).map((session, position) => ({ index: session.index,
    overlap: [...direct[position]].reduce((sum, [muscle, sets]) =>
      sum + Math.min(sets, direct[position + 1].get(muscle) ?? 0), 0),
  })).filter((entry) => entry.overlap > 0).sort((a, b) => b.overlap - a.overlap || a.index - b.index)
    .map((entry) => entry.index);
}

/** Describes actual gaps, including the boundary between dated microcycles. */
export function calendarRecovery(calendar: TrainingCalendar,
  resolveSessions: (microcycleIndex: number) => readonly PlannedSession[], catalogue: ReadonlyMap<string, Exercise>) {
  const workouts = Object.values(calendar).filter((e): e is Extract<TrainingCalendarEntry, { kind: 'workout' }> =>
    e.kind === 'workout').sort((a, b) => a.date.localeCompare(b.date));
  const direct = (entry: typeof workouts[number]) => {
    const counts = new Map<string, number>();
    resolveSessions(entry.microcycleIndex).find((s) => s.index === entry.sessionIndex)?.exercises.forEach((e) => {
      const muscle = catalogue.get(e.exerciseId)?.primaryMuscle;
      if (muscle) counts.set(muscle, (counts.get(muscle) ?? 0) + e.sets.length);
    });
    return counts;
  };
  return workouts.slice(1).map((next, index) => {
    const previous = workouts[index];
    const a = direct(previous); const b = direct(next);
    const sharedMuscles = [...a.keys()].filter((muscle) => a.get(muscle)! >= 3 && (b.get(muscle) ?? 0) >= 3);
    const gapDays = Math.round((Date.parse(next.date) - Date.parse(previous.date)) / DAY);
    return { previous, next, gapDays, sharedMuscles, reviewSuggested: gapDays <= 1 && sharedMuscles.length > 0 };
  });
}

export function calendarVolumeRate(calendar: TrainingCalendar, microcycleIndex: number, sets: number) {
  const dates = Object.values(calendar).filter((e) => e.microcycleIndex === microcycleIndex).map((e) => e.date).sort();
  if (!dates.length) return null;
  const days = Math.round((Date.parse(dates.at(-1)!) - Date.parse(dates[0])) / DAY) + 1;
  return { days, setsPerSevenDays: sets * 7 / days };
}
