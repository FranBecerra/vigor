import type { RehabBlock, RehabLog, RehabPrescription, RehabSetLog } from '@/models';
import { isValidCustomExercise, recordingOf } from './customExercises';

export function localDateKey(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error('invalidDate');
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function dateFromKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('invalidDate');
  const value = new Date(`${key}T12:00:00`);
  if (!Number.isFinite(value.getTime()) || localDateKey(value) !== key) throw new Error('invalidDate');
  return value;
}
export function weekStartKey(key: string) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return localDateKey(date);
}
const positiveInteger = (value: number, max: number) => Number.isInteger(value) && value > 0 && value <= max;
export function validateRehabBlock(block: RehabBlock): void {
  if (!block.userId || !block.id || block.version !== 1 || !block.name.trim() || block.name.trim().length > 120
    || !Number.isFinite(block.createdAt) || block.createdAt < 0 || !Number.isFinite(block.updatedAt)
    || block.updatedAt < 0 || typeof block.active !== 'boolean') throw new Error('invalidBlock');
  if (!block.items.length || block.items.length > 30 || new Set(block.items.map((item) => item.id)).size !== block.items.length) throw new Error('invalidItems');
  for (const item of block.items) validateRehabItem(item, block.userId);
  if (block.schedule.kind === 'WEEKLY') {
    if (!positiveInteger(block.schedule.target, 7)) throw new Error('invalidSchedule');
  } else if (block.schedule.kind === 'DAYS') {
    if (!block.schedule.days.length || new Set(block.schedule.days).size !== block.schedule.days.length
      || block.schedule.days.some((day) => !positiveInteger(day, 7))) throw new Error('invalidSchedule');
  } else if (block.schedule.kind === 'ROUTINE') {
    if (!block.schedule.routineId || !block.schedule.sessionIndexes.length
      || new Set(block.schedule.sessionIndexes).size !== block.schedule.sessionIndexes.length
      || block.schedule.sessionIndexes.some((index) => !Number.isInteger(index) || index < 0 || index > 6)) throw new Error('invalidSchedule');
  } else throw new Error('invalidSchedule');
}
export function validateRehabItem(item: RehabPrescription, ownerId: string): void {
  if (!item.id || item.exerciseId !== item.exerciseSnapshot.id || (item.exerciseSnapshot.isCustom && item.exerciseSnapshot.ownerId !== ownerId)) throw new Error('invalidExercise');
  if (item.exerciseSnapshot.isCustom && !isValidCustomExercise(item.exerciseSnapshot, ownerId)) throw new Error('invalidExercise');
  const mode = recordingOf(item.exerciseSnapshot);
  if (!['REPETITIONS', 'SECONDS'].includes(mode.measure)
    || !['NONE', 'TOTAL_KG', 'PER_HAND_KG', 'ADDED_KG', 'ASSISTANCE_KG', 'LEVEL'].includes(mode.load)) throw new Error('invalidRecording');
  if (!positiveInteger(item.sets, 20) || !positiveInteger(item.min, mode.measure === 'SECONDS' ? 3600 : 999)
    || !positiveInteger(item.max, mode.measure === 'SECONDS' ? 3600 : 999) || item.min > item.max
    || !Number.isFinite(item.restSeconds) || item.restSeconds < 0 || item.restSeconds > 3600
    || item.notes.length > 2000 || (item.load !== undefined && (!Number.isFinite(item.load) || item.load < 0 || item.load > 10000))
    || (mode.load === 'NONE' && item.load !== undefined)) throw new Error('invalidPrescription');
}
export function rehabWeekCompletions(block: RehabBlock, logs: readonly RehabLog[], today: string): number {
  dateFromKey(today);
  const start = weekStartKey(today);
  return new Set(logs.filter((log) => log.userId === block.userId && log.blockId === block.id
    && log.status === 'COMPLETED' && log.date >= start && log.date <= today
    && (() => { try { dateFromKey(log.date); return true; } catch { return false; } })()).map((log) => log.date)).size;
}
export function rehabIsDue(block: RehabBlock, logs: readonly RehabLog[], today: string, workoutKey?: string,
  context?: { routineId?: string; sessionIndex?: number }): boolean {
  const date = dateFromKey(today);
  if (!block.active || block.archivedAt !== undefined) return false;
  if (block.schedule.kind === 'ROUTINE' && (block.schedule.routineId !== context?.routineId
    || context.sessionIndex === undefined || !block.schedule.sessionIndexes.includes(context.sessionIndex))) return false;
  const todayLogs = logs.filter((log) => log.userId === block.userId && log.blockId === block.id && log.date === today);
  if (todayLogs.some((log) => log.status === 'COMPLETED' || (workoutKey !== undefined
    && log.status === 'SKIPPED' && log.workoutKey === workoutKey))) return false;
  if (block.schedule.kind === 'ROUTINE') return true;
  return block.schedule.kind === 'DAYS' ? block.schedule.days.includes(date.getDay() || 7)
    : rehabWeekCompletions(block, logs, today) < block.schedule.target;
}
export function newRehabLog(block: RehabBlock, today: string, now: number, workoutKey?: string): RehabLog {
  validateRehabBlock(block); dateFromKey(today);
  if (!Number.isFinite(now) || now < 0) throw new Error('invalidDate');
  return { id: `${block.id}:${today}`, userId: block.userId, blockId: block.id, date: today,
    status: 'IN_PROGRESS', blockSnapshot: JSON.parse(JSON.stringify(block)), updatedAt: now,
    ...(workoutKey ? { workoutKey } : {}), sets: block.items.flatMap((item) =>
      Array.from({ length: item.sets }, (_, index) => ({ itemId: item.id, index,
        recording: recordingOf(item.exerciseSnapshot), completed: false }))) };
}
export function rehabSetComplete(set: RehabSetLog): boolean {
  return typeof set.actual === 'number' && Number.isFinite(set.actual) && set.actual > 0
    && Number.isInteger(set.actual) && set.actual <= (set.recording.measure === 'SECONDS' ? 3600 : 999)
    && (set.recording.load === 'NONE' || (typeof set.load === 'number' && Number.isFinite(set.load) && set.load >= 0 && set.load <= 10000));
}
export function validateRehabLog(log: RehabLog): void {
  validateRehabBlock(log.blockSnapshot); dateFromKey(log.date);
  if (log.userId !== log.blockSnapshot.userId || log.blockId !== log.blockSnapshot.id
    || log.id !== `${log.blockId}:${log.date}` || !Number.isFinite(log.updatedAt)
    || !['IN_PROGRESS', 'COMPLETED', 'SKIPPED'].includes(log.status)
    || (log.workoutKey !== undefined && (typeof log.workoutKey !== 'string' || !log.workoutKey))) throw new Error('invalidLog');
  const expected = newRehabLog(log.blockSnapshot, log.date, log.updatedAt).sets;
  if (expected.length !== log.sets.length) throw new Error('invalidLog');
  log.sets.forEach((set, index) => {
    const canonical = expected[index];
    if (canonical.itemId !== set.itemId || canonical.index !== set.index
      || canonical.recording.measure !== set.recording.measure || canonical.recording.load !== set.recording.load
      || typeof set.completed !== 'boolean' || (set.completed && !rehabSetComplete(set))
      || (set.actual !== undefined && (!Number.isFinite(set.actual) || set.actual < 0))
      || (set.load !== undefined && (!Number.isFinite(set.load) || set.load < 0 || set.recording.load === 'NONE'))) throw new Error('invalidLog');
  });
  if (log.status === 'COMPLETED' && (!Number.isFinite(log.completedAt) || !log.sets.every((set) => set.completed && rehabSetComplete(set)))) throw new Error('invalidLog');
  if (log.status !== 'COMPLETED' && log.completedAt !== undefined) throw new Error('invalidLog');
}
export function updateRehabSet(log: RehabLog, itemId: string, index: number,
  patch: Partial<Pick<RehabSetLog, 'actual' | 'load' | 'completed'>>, now: number): RehabLog {
  if (!Number.isFinite(now) || !log.sets.some((set) => set.itemId === itemId && set.index === index)) throw new Error('invalidSet');
  const { completedAt: _, ...open } = log;
  return { ...open, updatedAt: now, status: 'IN_PROGRESS', sets: log.sets.map((set) => {
    if (set.itemId !== itemId || set.index !== index) return set;
    const next = { ...set, ...patch };
    if (patch.completed && !rehabSetComplete(next)) throw new Error('invalidActual');
    if (!rehabSetComplete(next)) next.completed = false;
    return next;
  }) };
}
export function finishRehabLog(log: RehabLog, now: number): RehabLog {
  if (!Number.isFinite(now) || !log.sets.length || !log.sets.every((set) => set.completed && rehabSetComplete(set))) throw new Error('incompleteBlock');
  return { ...log, status: 'COMPLETED', completedAt: now, updatedAt: now };
}
export function skipRehabLog(log: RehabLog, now: number): RehabLog {
  if (!Number.isFinite(now)) throw new Error('invalidDate');
  const { completedAt: _, ...rest } = log;
  return { ...rest, status: 'SKIPPED', updatedAt: now };
}
