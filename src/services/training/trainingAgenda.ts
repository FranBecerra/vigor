import type { CardioBlock, CardioWorkout } from '@/models/cardioTraining';
import type { SportActivity } from '@/models/sportActivity';
import { cardioHomeCycle, cardioHomeSessions, type CardioHomeSession } from '@/services/cardio/cardioHome';
import { moveItem } from './workoutReview';
import { countWorkingSets } from './sessionSummary';
import { routineDays, routineRestDays, type RoutineDay } from './routineRestDays';
import type { RoutineView, SessionView } from './routineView';
import { shiftCalendarDate, validCalendarDate } from './trainingCalendar';
import { timestampMillis } from './workoutRuntime';
import { dateInZone } from '@/services/cardio/cardioBlock';

export type StrengthAgendaEntry = { kind: 'strength'; id: string; date?: string; routine: RoutineView; session: SessionView; sets: number };
export type AgendaEntry = { group?: string } & (StrengthAgendaEntry
  | { kind: 'cardio'; id: string; date?: string; session: CardioHomeSession; sport?: SportActivity; upcoming?: true }
  | { kind: 'rest'; id: string; mesocycleId: string; cycle: number; restDayId: string; checked: boolean; extra?: false }
  | ({ kind: 'rest'; extra: true } & AgendaExtraRest)
  | { kind: 'sport'; id: string; date: string; sport: SportActivity });
export type AgendaMove = { id: string; anchor: string; direction: -1 | 1 };
export type AgendaExtraRest = { id: string; scope: string; checked: boolean };

export function pendingAgendaSession(entry: AgendaEntry) {
  if (entry.kind === 'strength') return !entry.session.completedOn && !entry.session.skippedOn;
  return entry.kind === 'cardio' && !entry.upcoming && entry.session.slot.disposition === 'CARDIO' && !entry.session.resolved;
}

const civilOffset = (date: string, anchor: string) =>
  Math.round((Date.parse(date) - Date.parse(anchor)) / 86400000);

export function agendaMove(rows: readonly AgendaEntry[], id: string, direction: -1 | 1): AgendaMove | null {
  const from = rows.findIndex(row => row.id === id);
  if (from < 0) return null;
  for (let to = from + direction; to >= 0 && to < rows.length; to += direction) {
    const move = agendaMoveTo(rows, from, to);
    if (move) return move;
  }
  return null;
}

export function movableAgendaEntry(row: AgendaEntry) {
  return row.kind === 'rest'
    || row.kind === 'cardio' && row.session.slot.disposition === 'CARDIO' && row.session.completed
    || pendingAgendaSession(row) && !(row.kind === 'cardio' && row.session.workout);
}

export function agendaMoveTo(rows: readonly AgendaEntry[], from: number, to: number): AgendaMove | null {
  const source = rows[from], target = rows[to];
  const next = rows.findIndex(row => row.group === source?.group && pendingAgendaSession(row));
  return from !== to && source && target && source.group === target.group && movableAgendaEntry(source) && movableAgendaEntry(target)
    && canReorderAgendaPosition(source, next, from, to)
    ? { id: source.id, anchor: target.id, direction: from < to ? 1 : -1 } : null;
}

export function canReorderAgendaPosition(source: AgendaEntry, next: number, from: number, to: number) {
  return !pendingAgendaSession(source) || next < 0 || (from >= next && to > next);
}

/** Keep overdue work available without opening a future cardio microcycle early. */
export function agendaCardioCycle(block: CardioBlock, sessions: readonly CardioHomeSession[], today: string) {
  const next = cardioHomeCycle(block, sessions);
  const days = block.proposal.input.cycleDays;
  if (!validCalendarDate(today)) return next;
  const elapsed = civilOffset(today, block.startDate);
  if (elapsed < 0) return -1;
  const calendarCycle = Math.floor(elapsed / days);
  // A workout keeps its cycle open after an early start or completion.
  const reached = sessions.reduce((cycle, session) => {
    const workout = session.workout;
    const started = workout && dateInZone(workout.startedAt, block.timeZone) <= today;
    const due = !session.resolved && session.slot.disposition === 'CARDIO' && session.slot.date <= today;
    return started || due ? Math.max(cycle, session.slot.cycle) : cycle;
  }, calendarCycle);
  const current = Math.min(next, reached);
  if (sessions.some(session => session.slot.cycle === current && session.workout)) return current;
  if (current > 0 && days === 7 && sessions.filter(s => s.slot.cycle === current).length === 1
    && sessions.filter(s => s.slot.cycle === current - 1).length === 1) {
    const prior = sessions.find(s => s.slot.cycle === current - 1 && s.completed);
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const monday = shiftCalendarDate(today, -((weekday + 6) % 7));
    if (prior && prior.date >= monday && prior.date <= today) return current - 1;
  }
  return current;
}

/** Plan positions seed a single sequence. The clock never advances a pending session. */
export function trainingAgenda(owner: string, routines: readonly RoutineView[], blocks: readonly CardioBlock[],
  workouts: readonly CardioWorkout[], sports: readonly SportActivity[], today?: string, moves: readonly AgendaMove[] = [],
  extraRests: readonly AgendaExtraRest[] = [], removedRestIds: readonly string[] = []) {
  const active = blocks.filter(b => b.userId === owner && b.endedAt === null);
  const tomorrow = today && validCalendarDate(today) ? shiftCalendarDate(today, 1) : undefined;
  const positioned: { position: number; row: AgendaEntry }[] = [];
  const strengthPositions = new Map<string, number>();
  const strengthCycles = new Map<string, { cycle: number; days: number; startedAt: number }>();
  const ownSports = sports.filter(s => s.userId === owner && s.discardedAt === null);
  const reserved = new Set<string>();
  let restScope: string | undefined;
  for (const routine of routines) {
    const meso = routine.mesocycleSnapshot;
    const cycle = routine.currentMicrocycleIndex;
    const sessions = routine.microcycles[cycle]?.sessions ?? [];
    if (!routine.isActive || routine.domain !== 'STRENGTH' || (meso && meso.userId !== owner)) continue;
    if (sessions.length) restScope ??= `strength:${routine.mesocycleId}:${cycle}`;
    let days: RoutineDay[] = [];
    if (meso) {
      try { days = routineDays(sessions.map(s => ({ index: s.plannedSessionIndex })), routineRestDays(meso)); }
      catch { /* Legacy data can still use the routine's session order. */ }
    }
    if (meso && days.length && sessions.length) strengthCycles.set(routine.id, { cycle, days: days.length, startedAt: timestampMillis(meso.startedAt) });
    sessions.forEach((session, index) => {
      const planned = days.findIndex(d => d.kind === 'workout' && d.sessionIndex === session.plannedSessionIndex);
      const position = planned >= 0 ? planned : index;
      strengthPositions.set(`${routine.id}:${session.plannedSessionIndex}`, position);
      positioned.push({ position, row: {
        kind: 'strength', id: `strength:${routine.mesocycleId}:${cycle}:${session.plannedSessionIndex}`, routine, session,
        date: session.completedOn ?? session.skippedOn,
        sets: (session.performedExercises ?? session.exercises).reduce((sum, e) => sum + countWorkingSets(e.sets), 0),
      } });
    });
    days.forEach((day, position) => {
      if (day.kind === 'rest') positioned.push({ position, row: {
        kind: 'rest', id: `rest:${routine.mesocycleId}:${cycle}:${day.id}`,
        mesocycleId: routine.mesocycleId, cycle, restDayId: day.id,
        checked: meso?.restDayChecks?.[`${cycle}:${day.id}`] === true,
      } });
    });
  }
  for (const block of active) {
    const sessions = cardioHomeSessions(block, workouts, sports);
    const days = block.proposal.input.cycleDays;
    const eligible = agendaCardioCycle(block, sessions, today ?? '');
    const running = sessions.find(session => session.workout?.status === 'RUNNING' || session.workout?.status === 'PAUSED');
    const source = block.proposal.strengthSource;
    const strength = source && strengthCycles.get(source.routineId);
    const pairedCycle = strength && source?.microcycleIndex !== undefined && strength.days === days && block.createdAt >= strength.startedAt
      ? strength.cycle - source.microcycleIndex : -1;
    const paired = pairedCycle >= 0 && pairedCycle < block.cycles;
    const group = strengthCycles.size && !(strength ? strength.days === days : [...strengthCycles.values()].some(item => item.days === days))
      ? block.id : undefined;
    const tomorrowCycle = tomorrow ? agendaCardioCycle(block, sessions, tomorrow) : eligible;
    const previewTomorrow = !paired && !running && tomorrowCycle > eligible && sessions.some(session =>
      session.slot.cycle === tomorrowCycle && session.slot.date === tomorrow
      && session.slot.disposition === 'CARDIO' && !session.resolved && !session.workout);
    const cycle = running?.slot.cycle ?? (paired ? Math.min(pairedCycle, cardioHomeCycle(block, sessions))
      : previewTomorrow ? tomorrowCycle : eligible);
    const anchors = !group && source ? block.proposal.input.strength.flatMap(({ id, dayIndex }) => {
      const position = strengthPositions.get(id);
      return position === undefined || dayIndex === undefined ? [] : [{ day: dayIndex, position }];
    }).sort((a, b) => a.day - b.day) : [];
    const useAnchors = anchors.length > 0 && anchors.every((anchor, index) => index === 0 || anchor.position > anchors[index - 1].position);
    if (cycle >= 0 && sessions.length && !group) restScope ??= `cardio:${block.id}:${cycle}`;
    for (const session of sessions) {
      if (session.slot.cycle !== cycle || previewTomorrow && session.slot.date !== tomorrow) continue;
      const upcoming = cycle > eligible && !session.resolved && !session.workout;
      const sport = session.slot.sportId ? ownSports.find(s => s.id === session.slot.sportId) : undefined;
      if (sport) reserved.add(sport.id);
      const dayFromBlockStart = civilOffset(session.slot.date, block.startDate);
      const day = dayFromBlockStart - cycle * days;
      const plannedDay = block.proposal.preview.scheduled.find(plan => plan.id === session.slot.prescriptionId)?.dayIndex;
      const rescheduled = plannedDay !== undefined && dayFromBlockStart !== session.slot.cycle * days + plannedDay;
      let position = day;
      if (useAnchors) {
        const next = anchors.findIndex(anchor => anchor.day >= day);
        const right = anchors[next];
        const left = next < 0 ? anchors.at(-1)! : anchors[next - 1];
        if (!right) position = left.position + day - left.day;
        else if (!left) position = right.position + day - right.day;
        else position = left.position + (right.position - left.position) * (day - left.day) / (right.day - left.day);
      }
      positioned.push({
        position,
        row: { kind: 'cardio', id: `cardio:${block.id}:${session.slot.id}`, session, sport,
          ...(upcoming ? { upcoming: true as const } : {}), ...(group ? { group } : {}),
          date: upcoming || rescheduled || session.completed || session.slot.disposition === 'SPORT' ? session.date : undefined },
      });
    }
  }
  const priority = { strength: 0, cardio: 1, rest: 2, sport: 3 } as const;
  let rows = positioned.sort((a, b) => a.position - b.position || priority[a.row.kind] - priority[b.row.kind]).map(e => e.row);
  if (restScope) for (const rest of extraRests) {
    if (rest.scope === restScope) rows.push({ ...rest, kind: 'rest', extra: true });
  }
  for (const move of moves) {
    const from = rows.findIndex(row => row.id === move.id), target = rows.findIndex(row => row.id === move.anchor);
    if (from < 0 || target < 0 || from === target || rows[from].group !== rows[target].group) continue;
    const insert = target - Number(from < target) + Number(move.direction === 1);
    rows = moveItem(rows, from, insert);
  }
  const removed = new Set(removedRestIds);
  rows = rows.filter(row => row.kind !== 'rest' || !removed.has(row.id));
  const combined = rows.filter(row => !row.group);
  rows = [...combined, ...rows.filter(row => row.group)];
  const nextId = rows.find(pendingAgendaSession)?.id;
  // Fixed commitments use their own civil dates. They never advance or block the sequence.
  if (today && validCalendarDate(today)) {
    const horizon = Math.max(7, ...active.map(block => block.proposal.input.cycleDays));
    const fixed = ownSports.flatMap<Extract<AgendaEntry, { kind: 'sport' }>>(sport => {
      if (!sport.planned || sport.record || reserved.has(sport.id)) return [];
      const date = dateInZone(sport.planned.startAt, sport.planned.timeZone);
      return date >= today && civilOffset(date, today) < horizon ? [{ kind: 'sport', id: `sport:${sport.id}`, date, sport }] : [];
    }).sort((a, b) => a.sport.planned!.startAt - b.sport.planned!.startAt);
    const firstPending = nextId ? rows.findIndex(row => row.id === nextId) : 0;
    const groups = new Map<number, typeof fixed>();
    for (const event of fixed) {
      const index = Math.min(combined.length, firstPending + civilOffset(event.date, today));
      groups.set(index, [...(groups.get(index) ?? []), event]);
    }
    rows = [...rows.flatMap((row, index) => [...(groups.get(index) ?? []), row]), ...(groups.get(rows.length) ?? [])];
  }
  return { rows, nextId, restScope };
}
