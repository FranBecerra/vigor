import type { CardioBlock } from '@/models/cardioTraining';
import type { SportActivity } from '@/models/sportActivity';
import { shiftCalendarDate, validCalendarDate } from '@/services/training/trainingCalendar';
import { validSportActivity } from './sportActivities';
import { dateInZone, strengthCalendarLoad, validCardioBlock, type DatedStrength } from './cardioBlock';
import { cardioSlotPrescription } from './cardioProgressionPolicy';
import { validHybridSettings, type HybridSettings } from './hybridAuthoring';

/** First instant of a civil date in the block zone; no 24-hour-day assumption through DST. */
function dateBoundary(date: string, format: Intl.DateTimeFormat): number {
  let low = Date.parse(`${date}T00:00:00Z`) - 36 * 3600000, high = low + 72 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2), parts = format.formatToParts(middle);
    const local = ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-');
    if (local < date) low = middle + 1; else high = middle;
  }
  return low;
}

/** Planning estimates only. No dose mutation, sport equivalence, actual-workout import or physiological clearance. */
export function reviewHybridCapacity(block: CardioBlock, settings: HybridSettings,
  sports: readonly SportActivity[], actualStrength: readonly DatedStrength[]) {
  if (!validCardioBlock(block, block?.userId) || !validHybridSettings(settings) || !Array.isArray(sports) || !Array.isArray(actualStrength)
    || actualStrength.some(s => !s || typeof s.id !== 'string' || !s.id || !validCalendarDate(s.date)
      || !['LOW', 'HIGH'].includes(s.demand) || s.estimatedMinutes !== undefined && (!Number.isFinite(s.estimatedMinutes) || s.estimatedMinutes < 0 || s.estimatedMinutes > 600)
      || s.microcycleIndex !== undefined && (!Number.isSafeInteger(s.microcycleIndex) || s.microcycleIndex < 0)
      || s.estimatedMinutes === undefined && !block.proposal.input.strength.some(p => p.id === s.placementId))
    || new Set(actualStrength.map(s => s.id)).size !== actualStrength.length) throw Error('invalidHybridCapacity');
  const owned = sports.filter(s => s?.userId === block.userId);
  if (owned.some(s => !validSportActivity(s, block.userId)) || new Set(owned.map(s => s.id)).size !== owned.length) throw Error('invalidHybridCapacity');
  const usableSports = new Map(owned.filter(s => s.discardedAt === null).map(s => [s.id, s]));
  if (block.slots.some(slot => {
    if (slot.disposition !== 'SPORT') return false;
    const activity = usableSports.get(slot.sportId!);
    return !activity || dateInZone((activity.record ?? activity.planned)!.startAt, block.timeZone) !== slot.date;
  })) throw Error('invalidHybridCapacity');
  const days = block.proposal.input.cycleDays, format = new Intl.DateTimeFormat('en', {
    timeZone: block.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dates = Array.from({ length: block.cycles + 1 }, (_, i) => shiftCalendarDate(block.startDate, i * days));
  const boundaries = dates.map(date => dateBoundary(date, format));
  const cycles = Array.from({ length: block.cycles }, (_, cycle) => ({ cycle, startDate: dates[cycle],
    endDate: shiftCalendarDate(dates[cycle + 1], -1), strengthMinutes: 0, cardioMinutes: 0,
    plannedSportMinutes: 0, recordedSportMinutes: 0, provisional: !!block.progression && cycle > block.progression.reviews.length,
    sessionLimitExceeded: false, totalMinutes: 0, remainingMinutes: 0, overBudgetMinutes: 0 }));
  for (const s of strengthCalendarLoad(block, actualStrength)) {
    const row = cycles[Math.floor(s.day / days)];
    if (!row) continue;
    row.strengthMinutes += s.minutes;
    if (s.minutes > settings.maxSessionMinutes) row.sessionLimitExceeded = true;
  }
  for (const slot of block.slots) {
    if (slot.disposition !== 'CARDIO') continue;
    const cycle = Math.floor((Date.parse(`${slot.date}T12:00Z`) - Date.parse(`${block.startDate}T12:00Z`)) / 86400000 / days);
    const minutes = cardioSlotPrescription(block, slot.id, true).durationSeconds / 60;
    cycles[cycle].cardioMinutes += minutes;
    if (minutes > settings.maxSessionMinutes) cycles[cycle].sessionLimitExceeded = true;
  }
  for (const sport of owned) {
    if (sport.discardedAt !== null) continue;
    const timing = (sport.record ?? sport.planned)!;
    const end = timing.startAt + timing.durationMinutes * 60000;
    for (const row of cycles) {
      const minutes = Math.max(0, Math.min(end, boundaries[row.cycle + 1]) - Math.max(timing.startAt, boundaries[row.cycle])) / 60000;
      if (sport.record) row.recordedSportMinutes += minutes; else row.plannedSportMinutes += minutes;
    }
  }
  for (const row of cycles) {
    row.totalMinutes = row.strengthMinutes + row.cardioMinutes + row.plannedSportMinutes + row.recordedSportMinutes;
    row.remainingMinutes = Math.max(0, settings.totalMinutesPerCycle - row.totalMinutes);
    row.overBudgetMinutes = Math.max(0, row.totalMinutes - settings.totalMinutesPerCycle);
  }
  return { cycles, fits: cycles.every(row => row.overBudgetMinutes === 0 && !row.sessionLimitExceeded) };
}
