import { SetType, type RehabLog, type RehabPrescription } from '@/models';
import type { SessionSetState } from './sessionMapper';
import { recordingOf } from './customExercises';
import { updateRehabSet } from './rehabilitation';
import { IDLE_REST_TIMER } from './restTimer';
import { updateWorkoutSet } from './workoutExecution';
import { linkSuperset, unlinkSuperset } from './workoutStructure';

export function rehabRows(log: RehabLog, item: RehabPrescription): SessionSetState[] {
  return log.sets.filter((set) => set.itemId === item.id).map((set) => ({ id: `${item.id}:${set.index}`,
    setType: set.setType ?? SetType.NORMAL, targetWeight: item.load ?? 0, targetReps: item.max, targetRIR: 2,
    targetDurationSeconds: item.max, targetLoadLevel: item.load ?? 0, recording: set.recording,
    ...(set.recording.measure === 'SECONDS' ? { actualDurationSeconds: set.actual } : { actualReps: set.actual }),
    ...(set.recording.load === 'LEVEL' ? { actualLoadLevel: set.load } : { actualWeight: set.load }),
    actualRIR: set.rir ?? null, actualPartialReps: set.partialReps, extensions: set.extensions,
    isCompleted: set.completed, completionWasRecorded: set.completionWasRecorded, isAutoFilled: false }));
}
export function patchRehabRow(log: RehabLog, item: RehabPrescription, setId: string, patch: Partial<SessionSetState>, now: number): RehabLog {
  const source = rehabRows(log, item).find((row) => row.id === setId); if (!source) throw Error('missingRehabSet');
  const index = log.sets.find((set) => `${set.itemId}:${set.index}` === setId)!.index;
  const mode = recordingOf(item.exerciseSnapshot);
  const row = updateWorkoutSet(source, patch);
  return updateRehabSet(log, item.id, index, {
    actual: mode.measure === 'SECONDS' ? row.actualDurationSeconds : row.actualReps,
    ...(mode.load === 'NONE' ? {} : { load: mode.load === 'LEVEL' ? row.actualLoadLevel : row.actualWeight }),
    completed: row.isCompleted, ...(row.completionWasRecorded === undefined ? {} : { completionWasRecorded: row.completionWasRecorded }), setType: row.setType, rir: row.setType === SetType.FAILURE ? 0 : row.actualRIR,
    partialReps: row.actualPartialReps,
    ...(row.extensions === undefined ? {} : { extensions: row.extensions }),
  }, now);
}
/** Keep each item's completed actuals attached to its occurrence through reordering. */
export function reshapeRehab(log: RehabLog, items: RehabPrescription[], now: number): RehabLog {
  const sets = items.flatMap((item) => Array.from({ length: item.sets }, (_, index) =>
    log.sets.find((set) => set.itemId === item.id && set.index === index) ?? { itemId: item.id, index, recording: recordingOf(item.exerciseSnapshot), completed: false }));
  const timer = log.restTimer;
  const { completedAt: _, ...open } = log;
  return { ...open, status: 'IN_PROGRESS', blockSnapshot: { ...log.blockSnapshot, items }, sets, updatedAt: now,
    activeItemId: items.some((item) => item.id === log.activeItemId) ? log.activeItemId : items[0]?.id,
    ...(timer ? { restTimer: sets.some((set) => `${set.itemId}:${set.index}` === timer.anchorSetId) ? timer : IDLE_REST_TIMER } : {}) };
}

/** Reuse workout groups while storing clinical circuits as contiguous links. */
export function rehabSupersets(items: readonly RehabPrescription[]): Record<string, string> {
  const groups: Record<string, string> = {}; let group = '';
  items.forEach((item, index) => {
    if (!item.circuitWithPrevious) group = item.id;
    if (item.circuitWithPrevious || items[index + 1]?.circuitWithPrevious) groups[item.id] = group;
  });
  return groups;
}
export function linkRehabSuperset(items: readonly RehabPrescription[], id: string, partner?: string): RehabPrescription[] {
  const order = items.map((item) => item.id); const groups = rehabSupersets(items);
  const next = partner ? linkSuperset(order, groups, id, partner) : unlinkSuperset(order, groups, id);
  const arranged: RehabPrescription[] = []; const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    const members = next[item.id] ? items.filter((other) => next[other.id] === next[item.id]) : [item];
    members.forEach((member, index) => { seen.add(member.id); arranged.push({ ...member, circuitWithPrevious: index > 0 }); });
  }
  return arranged;
}
