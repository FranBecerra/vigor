/** Undated workout/rest structure. Rest slots never count as workout progression. */
import { SetType, type Exercise, type PlannedSession } from '@/models';
import type { ScheduleSlot, ScheduleTemplate } from '@/models/routine';
export type { ScheduleSlot, ScheduleTemplate } from '@/models/routine';

export interface ScheduleWorkload { index: number; directSets: ReadonlyMap<string, number> }

function workloadOverlap(workloads: readonly ScheduleWorkload[]) {
  return workloads.map((workload, index) => {
    const next = workloads[(index + 1) % workloads.length];
    const muscles = [...workload.directSets.keys()].filter((muscle) =>
      workload.directSets.get(muscle)! >= 3 && (next.directSets.get(muscle) ?? 0) >= 3);
    return { from: workload.index, to: next.index, muscles,
      cost: muscles.reduce((sum, muscle) => sum + Math.min(workload.directSets.get(muscle)!, next.directSets.get(muscle)!), 0) };
  });
}

export function validateScheduleTemplate(template: ScheduleTemplate, sessionIndexes: readonly number[]): void {
  if (!Number.isInteger(template.days) || template.days < 1 || template.days > 28
    || template.slots.length !== template.days || new Set(sessionIndexes).size !== sessionIndexes.length
    || sessionIndexes.some((index) => !Number.isInteger(index) || index < 0)) throw new Error('Invalid schedule template');
  const prescribed = template.slots.flatMap((slot) => slot.kind === 'workout' ? [slot.sessionIndex] : []);
  if (prescribed.length !== sessionIndexes.length || prescribed.some((index, i) => index !== sessionIndexes[i])
    || template.slots.some((slot) => slot.kind !== 'workout' && slot.kind !== 'rest')) throw new Error('Invalid workout sequence');
}

/** Shared direct work, including the last-to-first boundary of a repeatable cycle. */
export function scheduleOverlap(sessions: readonly PlannedSession[], catalogue: ReadonlyMap<string, Exercise>) {
  const direct = sessions.map((session) => {
    const result = new Map<string, number>();
    session.exercises.forEach((e) => {
      const muscle = catalogue.get(e.exerciseId)?.primaryMuscle;
      const sets = e.sets.filter((s) => s.setType !== SetType.WARMUP).length;
      if (muscle) result.set(muscle, (result.get(muscle) ?? 0) + sets);
    });
    return result;
  });
  return workloadOverlap(sessions.map((session, index) => ({ index: session.index, directSets: direct[index] })));
}

export function buildScheduleTemplate(sessions: readonly PlannedSession[], catalogue: ReadonlyMap<string, Exercise>,
  days = Math.max(7, sessions.length)): ScheduleTemplate {
  return buildSlots(sessions.map((session) => session.index), scheduleOverlap(sessions, catalogue), days);
}

function buildSlots(indexes: readonly number[], overlaps: ReturnType<typeof workloadOverlap>, days: number): ScheduleTemplate {
  if (!Number.isInteger(days) || days < Math.max(1, indexes.length) || days > 28) throw new Error('Invalid cycle length');
  const gaps = Array<number>(indexes.length).fill(0);
  for (let rest = 0; rest < days - indexes.length && gaps.length; rest += 1) {
    const minimum = Math.min(...gaps);
    let best = gaps.indexOf(minimum);
    for (let i = 1; i < gaps.length; i += 1) {
      // Spread rest before stacking days in one gap; prioritize overlap among ties.
      if (gaps[i] !== minimum) continue;
      const score = (overlaps[i].cost + 1) / (gaps[i] + 1);
      const current = (overlaps[best].cost + 1) / (gaps[best] + 1);
      if (score > current) best = i;
    }
    gaps[best] += 1;
  }
  const slots: ScheduleSlot[] = indexes.length ? indexes.flatMap((index, i) => [
    { kind: 'workout' as const, sessionIndex: index },
    ...Array.from({ length: gaps[i] }, () => ({ kind: 'rest' as const })),
  ]) : Array.from({ length: days }, () => ({ kind: 'rest' as const }));
  const result = { days, slots };
  validateScheduleTemplate(result, indexes);
  return result;
}

export function moveRestSlot(template: ScheduleTemplate, from: number, to: number): ScheduleTemplate {
  const indexes = template.slots.flatMap((s) => s.kind === 'workout' ? [s.sessionIndex] : []);
  validateScheduleTemplate(template, indexes);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0
    || from >= template.days || to >= template.days || template.slots[from].kind !== 'rest') throw new Error('Invalid rest move');
  const slots = [...template.slots];
  const [rest] = slots.splice(from, 1); slots.splice(to, 0, rest);
  const result = { days: template.days, slots };
  validateScheduleTemplate(result, indexes);
  return result;
}

export function templateRecovery(template: ScheduleTemplate, sessions: readonly PlannedSession[],
  catalogue: ReadonlyMap<string, Exercise>) {
  validateScheduleTemplate(template, sessions.map((s) => s.index));
  return recoveryPairs(template, scheduleOverlap(sessions, catalogue));
}

/** Same rest-placement algorithm before prescriptions exist; no fabricated sets/RIR. */
export function workloadTemplateRecovery(workloads: readonly ScheduleWorkload[], days = Math.max(7, workloads.length)) {
  const overlaps = workloadOverlap(workloads);
  return recoveryPairs(buildSlots(workloads.map((workload) => workload.index), overlaps, days), overlaps);
}

function recoveryPairs(template: ScheduleTemplate, overlaps: ReturnType<typeof workloadOverlap>) {
  return overlaps.map((pair) => {
    const from = template.slots.findIndex((s) => s.kind === 'workout' && s.sessionIndex === pair.from);
    const to = template.slots.findIndex((s) => s.kind === 'workout' && s.sessionIndex === pair.to);
    const gapDays = to > from ? to - from : template.days - from + to;
    return { ...pair, gapDays, reviewSuggested: gapDays === 1 && pair.muscles.length > 0 };
  });
}
