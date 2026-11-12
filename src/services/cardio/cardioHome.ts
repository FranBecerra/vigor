import type { CardioBlock, CardioSlot, CardioWorkout } from '@/models/cardioTraining';
import type { RoutineView } from '@/services/training/routineView';
import type { RoutineDay } from '@/services/training/routineRestDays';
import type { SportActivity } from '@/models/sportActivity';
import { shiftCalendarDate, validCalendarDate } from '@/services/training/trainingCalendar';
import { cardioSlotPrescription } from './cardioProgressionPolicy';
import { cardioStrengthChanged } from './savedCardioPlan';
import { dateInZone } from './cardioBlock';
import { timestampMillis } from '@/services/training/workoutRuntime';

export interface CardioHomeSession {
  block: CardioBlock;
  slot: CardioSlot;
  workout?: CardioWorkout;
  completed: boolean;
  resolved: boolean;
  date: string;
  seconds: number;
}

/** Read-only projection of validated owner-scoped stores. A reservation is not completion. */
export function cardioHomeSessions(block: CardioBlock, workouts: readonly CardioWorkout[], sports: readonly SportActivity[] = []): CardioHomeSession[] {
  return block.slots.map(slot => {
    const ordered = workouts.filter(w => w.userId === block.userId && w.blockId === block.id && w.slotId === slot.id)
      .sort((a, b) => b.updatedAt - a.updatedAt || b.revision - a.revision || a.id.localeCompare(b.id));
    const latest = new Map<string, CardioWorkout>();
    ordered.forEach(w => { if (!latest.has(w.id)) latest.set(w.id, w); });
    const workout = [...latest.values()].find(w => w.status !== 'DISCARDED');
    const completed = workout?.status === 'FINISHED';
    const sport = slot.disposition === 'SPORT' && sports.find(s => s.userId === block.userId && s.id === slot.sportId && s.discardedAt === null);
    return { block, slot, workout, completed, resolved: completed || slot.disposition === 'SKIPPED'
      || !!(sport && sport.record && dateInZone(sport.record.startAt, block.timeZone) === slot.date),
      date: completed ? dateInZone(workout.startedAt, block.timeZone) : slot.date,
      seconds: completed ? workout.actualSeconds! : cardioSlotPrescription(block, slot.id).durationSeconds };
  }).sort((a, b) => a.slot.cycle - b.slot.cycle || a.date.localeCompare(b.date) || a.slot.id.localeCompare(b.slot.id));
}

/** Progress follows resolved opportunities, never elapsed calendar days or a reserved class. */
export function cardioHomeCycle(block: CardioBlock, sessions: readonly CardioHomeSession[]) {
  return sessions.find(s => !s.resolved)?.slot.cycle ?? block.cycles - 1;
}

/** Add dated cardio beside existing days; strength IDs/order/checks remain untouched. */
export function cardioCalendarRows(routine: RoutineView, days: readonly RoutineDay[], blocks: readonly CardioBlock[],
  workouts: readonly CardioWorkout[], owner: string): Map<string, CardioHomeSession[]> {
  const result = new Map<string, CardioHomeSession[]>();
  const current = routine.microcycles[routine.currentMicrocycleIndex];
  if (!routine.isActive || !current || routine.mesocycleSnapshot?.userId !== owner) return result;
  for (const block of blocks.filter(b => b.userId === owner && b.endedAt === null)) {
    const source = block.proposal.strengthSource;
    const cycle = source?.microcycleIndex === undefined ? -1 : routine.currentMicrocycleIndex - source.microcycleIndex;
    // Only an unchanged, explicitly linked relative rhythm can supply dates for undated strength days.
    const forecast = source?.routineId === routine.id && cycle >= 0 && cycle < block.cycles
      && block.createdAt >= timestampMillis(routine.mesocycleSnapshot!.startedAt)
      && block.proposal.input.cycleDays === days.length && !cardioStrengthChanged({ ...block.proposal,
        strengthSource: { ...source, microcycleIndex: routine.currentMicrocycleIndex } }, routine);
    const dates = days.map((day, index) => {
      const session = day.kind === 'workout' ? current.sessions.find(s => s.plannedSessionIndex === day.sessionIndex) : undefined;
      const explicit = session?.scheduledOn ?? session?.completedOn;
      return explicit && validCalendarDate(explicit) ? explicit : forecast ? shiftCalendarDate(block.startDate, cycle * days.length + index) : undefined;
    });
    for (const entry of cardioHomeSessions(block, workouts)) {
      const matches = dates.flatMap((date, index) => date === entry.date ? [index] : []);
      // Ambiguous dates must not duplicate the same workout in the calendar.
      if (matches.length !== 1) continue;
      const key = days[matches[0]].id;
      result.set(key, [...(result.get(key) ?? []), entry]);
    }
  }
  return result;
}
