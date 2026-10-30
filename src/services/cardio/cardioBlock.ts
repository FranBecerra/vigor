import type { CardioBlock, CardioSlot, CardioWorkout } from '@/models/cardioTraining';
import type { SportActivity } from '@/models/sportActivity';
import type { RoutineView } from '@/services/training/routineView';
import { validCalendarDate, shiftCalendarDate } from '@/services/training/trainingCalendar';
import { validSportActivity, validSportIdentity, validSportTimeZone } from './sportActivities';
import { validSavedCardioPlan, type SavedCardioPlan } from './savedCardioPlan';
import { cardioSlotPrescription, validCardioProgression } from './cardioProgressionPolicy';

export const dateInZone = (epoch: number, zone: string): string => {
  if (!Number.isFinite(epoch) || !Number.isFinite(new Date(epoch).getTime()) || !validSportTimeZone(zone)) throw Error('invalidCardioDate');
  const parts = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(epoch);
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-');
};
const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 8.64e15;
const whole = (v: unknown, a: number, b: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= a && v <= b;
export function cardioSlotId(cycle: number, prescription: string): string { return `${cycle}_${prescription}`; }

export function createCardioBlock(id: string, proposal: SavedCardioPlan, startDate: string, cycles: number, timeZone: string, now: number): CardioBlock {
  if (!validSavedCardioPlan(proposal, proposal?.userId) || proposal.archivedAt !== null || !validCalendarDate(startDate)
    || !whole(cycles, 1, 8) || !validSportTimeZone(timeZone) || !timestamp(now) || !validSportIdentity(id)) throw Error('invalidCardioBlock');
  const block: CardioBlock = { schemaVersion: 1, id, userId: proposal.userId, proposal: JSON.parse(JSON.stringify(proposal)), startDate,
    cycles, timeZone, createdAt: now, updatedAt: now, revision: 1, endedAt: null,
    slots: Array.from({ length: cycles }, (_, cycle) => proposal.preview.scheduled.map(s => ({
      id: cardioSlotId(cycle, s.id), cycle, prescriptionId: s.id,
      date: shiftCalendarDate(startDate, cycle * proposal.input.cycleDays + s.dayIndex), disposition: 'CARDIO' as const, sportId: null,
    }))).flat() };
  if (!validCardioBlock(block, proposal.userId)) throw Error('invalidCardioBlock');
  return block;
}

export function validCardioBlock(value: unknown, owner: string): value is CardioBlock {
  if (!value || typeof value !== 'object') return false;
  const b = value as CardioBlock;
  if (b.schemaVersion !== 1 || !validSportIdentity(b.id) || b.userId !== owner || !validSavedCardioPlan(b.proposal, owner)
    || !validCalendarDate(b.startDate) || !validSportTimeZone(b.timeZone) || !whole(b.cycles, 1, 8)
    || !timestamp(b.createdAt) || !timestamp(b.updatedAt) || b.updatedAt < b.createdAt || !whole(b.revision, 1, Number.MAX_SAFE_INTEGER)
    || b.endedAt !== null && (!timestamp(b.endedAt) || b.endedAt < b.createdAt || b.endedAt > b.updatedAt)
    || !Array.isArray(b.slots) || b.slots.length !== b.cycles * b.proposal.preview.scheduled.length) return false;
  const ids = new Set<string>(), sports = new Set<string>();
  const slotsValid = b.slots.every(s => {
    if (!s || !whole(s.cycle, 0, b.cycles - 1) || !b.proposal.preview.scheduled.some(p => p.id === s.prescriptionId)
      || s.id !== cardioSlotId(s.cycle, s.prescriptionId) || ids.has(s.id) || !validCalendarDate(s.date)
      || s.date < b.startDate || s.date > shiftCalendarDate(b.startDate, b.cycles * b.proposal.input.cycleDays - 1)
      || !['CARDIO', 'SKIPPED', 'SPORT'].includes(s.disposition)) return false;
    ids.add(s.id);
    if (s.disposition === 'SPORT') {
      if (!validSportIdentity(s.sportId) || sports.has(s.sportId)) return false;
      sports.add(s.sportId);
    } else if (s.sportId !== null) return false;
    return true;
  });
  return slotsValid && (b.progression === undefined || validCardioProgression(b.progression, b));
}

export function changeCardioSlot(block: CardioBlock, id: string, date: string, disposition: CardioSlot['disposition'], sport: SportActivity | null,
  workouts: readonly CardioWorkout[], now: number): CardioBlock {
  if (!validCardioBlock(block, block.userId) || block.endedAt !== null || !timestamp(now) || now < block.updatedAt
    || block.revision === Number.MAX_SAFE_INTEGER || !block.slots.some(s => s.id === id)
    || workouts.some(w => w.userId === block.userId && w.blockId === block.id && w.slotId === id && w.status !== 'DISCARDED')) throw Error('cardioSlotLocked');
  if (disposition === 'SPORT' && (!validSportActivity(sport, block.userId) || sport.discardedAt !== null
    || dateInZone((sport.record ?? sport.planned)!.startAt, block.timeZone) !== date)) throw Error('invalidCardioSport');
  const next = { ...block, updatedAt: now, revision: block.revision + 1,
    slots: block.slots.map(s => s.id === id ? { ...s, date, disposition, sportId: disposition === 'SPORT' ? sport!.id : null } : { ...s }) };
  if (!validCardioBlock(next, block.userId)) throw Error('invalidCardioBlock');
  return next;
}

export function endCardioBlock(block: CardioBlock, now: number): CardioBlock {
  if (!validCardioBlock(block, block.userId) || block.endedAt !== null || !timestamp(now) || now < block.updatedAt || block.revision === Number.MAX_SAFE_INTEGER) throw Error('invalidCardioBlock');
  return { ...block, endedAt: now, updatedAt: now, revision: block.revision + 1 };
}

export interface DatedStrength { id: string; date: string; demand: 'LOW' | 'HIGH'; placementId?: string; microcycleIndex?: number; estimatedMinutes?: number }
/** Actual assigned/performed dates only. Relative forecasts remain labelled separately. */
export function datedStrength(routine?: RoutineView, timeZone = 'UTC'): DatedStrength[] {
  const lower = new Set(['QUADS', 'HAMSTRINGS', 'GLUTES', 'ADDUCTORS', 'CALVES', 'ERECTORS', 'UNCLASSIFIED']);
  return (routine?.microcycles ?? []).flatMap((micro, cycle) => micro.sessions.flatMap(s => {
    const date = s.completedAtMs !== undefined && Number.isFinite(s.completedAtMs)
      ? dateInZone(s.completedAtMs, timeZone) : s.completedOn ?? s.scheduledOn;
    return !date || !validCalendarDate(date) || s.skippedOn ? [] : [{ id: `${cycle}:${s.plannedSessionIndex}`, date,
      ...(routine?.id && Number.isInteger(routine.currentMicrocycleIndex) ? { placementId: `${routine.id}:${s.plannedSessionIndex}`,
        microcycleIndex: cycle } : {}),
      demand: !s.exercises.length || s.exercises.some(e => [e.primaryMuscle, ...(e.primaryMuscles ?? [])].some(m => lower.has(m))) ? 'HIGH' as const : 'LOW' as const }];
  }));
}
export type CardioCoordinationIssue = 'STRENGTH' | 'SPORT' | 'CARDIO' | 'ACTIVE_DAYS' | 'AVAILABILITY' | 'SPORT_CHANGED' | 'TIME';

/** Cache civil-day arithmetic and sport timezone conversion once per review. */
function coordinationContext(block: CardioBlock, sports: readonly SportActivity[], actualStrength: readonly DatedStrength[]) {
  const input = block.proposal.input;
  const start = Date.parse(`${block.startDate}T12:00:00Z`), cache = new Map<string, number>();
  const day = (date: string) => { if (!cache.has(date)) cache.set(date, Math.round((Date.parse(`${date}T12:00:00Z`) - start) / 86400000)); return cache.get(date)!; };
  const origin = block.proposal.strengthSource?.microcycleIndex;
  // Anchor to the saved source cycle, never to a routine's advancing current cycle.
  const assigned = new Set(actualStrength.filter(s => s.placementId && s.microcycleIndex !== undefined && origin !== undefined)
    .map(s => `${s.microcycleIndex! - origin!}:${s.placementId}`));
  const strength = [...actualStrength.map(s => ({ day: day(s.date), demand: s.demand,
    minutes: s.estimatedMinutes ?? input.strength.find(p => p.id === s.placementId)?.estimatedMinutes ?? 0 })),
    ...Array.from({ length: block.cycles }, (_, cycle) => input.strength.filter(s => !assigned.has(`${cycle}:${s.id}`))
      .map(s => ({ day: cycle * input.cycleDays + s.dayIndex!, demand: s.lowerBodyDemand, minutes: s.estimatedMinutes }))).flat()];
  const usable = new Map(sports.filter(s => validSportActivity(s, block.userId) && s.discardedAt === null)
    .map(s => [s.id, { day: day(dateInZone((s.record ?? s.planned)!.startAt, block.timeZone)), recorded: !!s.record }]));
  const strengthMinutes = new Map<number, number>();
  strength.forEach(s => strengthMinutes.set(s.day, (strengthMinutes.get(s.day) ?? 0) + s.minutes));
  return { day, strengthDays: new Set(strength.map(s => s.day)), highDays: new Set(strength.filter(s => s.demand === 'HIGH').map(s => s.day)), strengthMinutes,
    sports: usable, sportDays: new Set([...usable.values()].map(s => s.day)), prescriptions: new Map(block.slots.map(slot => {
      const base = block.proposal.preview.scheduled.find(p => p.id === slot.prescriptionId)!;
      return [slot.id, block.progression ? { ...base, durationMinutes: cardioSlotPrescription(block, slot.id, true).durationSeconds / 60 } : base];
    })) };
}

function coordinated(block: CardioBlock, context: ReturnType<typeof coordinationContext>) {
  const input = block.proposal.input, active = Array.from({ length: block.cycles }, () => new Set<number>());
  const counts = new Map<number, number>(), highs = new Map<number, number>(), minutes = Array<number>(block.cycles).fill(0), sessions = Array<number>(block.cycles).fill(0);
  const add = (date: number) => active[Math.floor(date / input.cycleDays)]?.add(date);
  for (const day of context.strengthDays) add(day);
  for (const day of context.sportDays) add(day);
  for (const slot of block.slots) {
    if (slot.disposition === 'SKIPPED') continue;
    const day = context.day(slot.date), cycle = Math.floor(day / input.cycleDays); add(day);
    if (slot.disposition === 'CARDIO') {
      counts.set(day, (counts.get(day) ?? 0) + 1);
      const p = context.prescriptions.get(slot.id)!;
      if (p.lowerBodyDemand === 'HIGH') highs.set(day, (highs.get(day) ?? 0) + 1);
      minutes[cycle] += p.durationMinutes; sessions[cycle] += 1;
    }
  }
  return block.slots.map(slot => {
    const issues: CardioCoordinationIssue[] = [];
    if (slot.disposition === 'SKIPPED') return { slot, issues, coveredBySport: false };
    const day = context.day(slot.date), cycle = Math.floor(day / input.cycleDays);
    if (slot.disposition === 'SPORT') {
      const sport = context.sports.get(slot.sportId!);
      if (!sport || sport.day !== day) issues.push('SPORT_CHANGED');
      // A record can cover the selected opportunity, not prove equivalent easy work.
      return { slot, issues, coveredBySport: !!sport?.recorded && !issues.length };
    }
    const high = context.prescriptions.get(slot.id)!.lowerBodyDemand === 'HIGH';
    if (!input.allowDoubles && context.strengthDays.has(day) || high && [day - 1, day, day + 1].some(d => context.highDays.has(d))) issues.push('STRENGTH');
    if ((high ? [day - 1, day, day + 1] : [day]).some(d => context.sportDays.has(d))) issues.push('SPORT');
    if (!input.allowDoubles && counts.get(day)! > 1 || high && (highs.get(day)! > 1 || highs.has(day - 1) || highs.has(day + 1))) issues.push('CARDIO');
    if (!input.availableDays.includes(day % input.cycleDays)) issues.push('AVAILABILITY');
    if (active[cycle].size > input.maxActiveDays) issues.push('ACTIVE_DAYS');
    if (sessions[cycle] > input.sessions || minutes[cycle] > input.cardioMinutes) issues.push('TIME');
    return { slot, issues, coveredBySport: false };
  });
}

/** Date-level heuristics, not physiological clearance or a claim of hours apart. */
export function coordinateCardioBlock(block: CardioBlock, sports: readonly SportActivity[], actualStrength: readonly DatedStrength[]) {
  return coordinated(block, coordinationContext(block, sports, actualStrength));
}

/** Starting another day's opportunity is allowed, but today's context needs review. */
export function cardioStartContext(block: CardioBlock, slotId: string, now: number, sports: readonly SportActivity[], strength: readonly DatedStrength[]) {
  const slot = block.slots.find(s => s.id === slotId);
  if (!slot) throw Error('invalidCardioStart');
  const date = dateInZone(now, block.timeZone);
  if (date < block.startDate || date > shiftCalendarDate(block.startDate, block.cycles * block.proposal.input.cycleDays - 1)) {
    return { date, review: true, issues: ['OUTSIDE_BLOCK' as const] };
  }
  const temporary = { ...block, slots: block.slots.map(s => s.id === slotId ? { ...s, date } : s) };
  const issues = coordinateCardioBlock(temporary, sports, strength).find(s => s.slot.id === slotId)!.issues;
  return { date, review: date !== slot.date || issues.length > 0, issues };
}

/** Deterministic greedy review aid; never moves sports, strength or an executed slot. */
export function improveCardioDates(block: CardioBlock, sports: readonly SportActivity[], strength: readonly DatedStrength[], workouts: readonly CardioWorkout[], now: number) {
  if (!validCardioBlock(block, block.userId) || block.endedAt !== null || !timestamp(now) || now < block.updatedAt || block.revision === Number.MAX_SAFE_INTEGER) throw Error('invalidCardioBlock');
  const context = coordinationContext(block, sports, strength);
  const score = (value: CardioBlock) => coordinated(value, context).reduce((n, r) => n + r.issues.length * 1000
    + (value.proposal.input.placementPolicy && r.slot.disposition === 'CARDIO'
      ? Math.min(5, (context.strengthMinutes.get(context.day(r.slot.date)) ?? 0) / 120) : 0), 0);
  let current = score(block);
  if (!current) return block;
  let next = block;
  for (const slot of block.slots) {
    if (slot.disposition !== 'CARDIO' || workouts.some(w => w.userId === block.userId && w.blockId === block.id && w.slotId === slot.id && w.status !== 'DISCARDED')) continue;
    let best = next;
    for (const day of block.proposal.input.availableDays) {
      const date = shiftCalendarDate(block.startDate, slot.cycle * block.proposal.input.cycleDays + day);
      const candidate = { ...next, slots: next.slots.map(s => s.id === slot.id ? { ...s, date } : s) };
      const count = score(candidate);
      if (count < current) { best = candidate; current = count; }
    }
    // Keep identity/ revision stable if the helper has no real improvement.
    next = best;
  }
  return next === block ? block : { ...next, revision: block.revision + 1, updatedAt: now };
}
