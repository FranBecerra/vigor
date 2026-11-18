import type { CardioHealthRead, CardioHealthWorkout } from '@/models/cardioHealth';
import type { CardioPlanningModality } from '@/models/cardio';
import type { CardioBlock, CardioWorkout } from '@/models/cardioTraining';
import { dateInZone, validCardioBlock } from './cardioBlock';
import { cardioHealthWeekWindow, reviewCardioHealth } from './cardioHealthReview';
import { validCardioWorkout } from './cardioWorkout';
import { cardioSlotPrescription } from './cardioProgressionPolicy';

function compatible(modality: CardioPlanningModality, workout: CardioHealthWorkout) {
  return modality === 'MACHINE' ? ['ROWING', 'ELLIPTICAL', 'STAIRS'].includes(workout.kind) : workout.kind === modality;
}

export function cardioHealthCandidates(block: CardioBlock, slotId: string, data: CardioHealthRead,
  workouts: readonly CardioWorkout[], now: number) {
  const slot = block.slots.find(s => s.id === slotId);
  if (block.endedAt !== null || slot?.disposition !== 'CARDIO'
    || workouts.some(w => w.userId === block.userId && w.blockId === block.id && w.slotId === slotId && w.status !== 'DISCARDED')) return [];
  const modality = cardioSlotPrescription(block, slotId).modality;
  const used = new Set(workouts.filter(w => w.userId === block.userId && w.status !== 'DISCARDED').map(w => w.healthLinkKey));
  const { start } = cardioHealthWeekWindow(now);
  return reviewCardioHealth(data, now).rows.filter(w => w.start >= start && w.linkKey && !used.has(w.linkKey)
    && !w.manuallyEntered && !w.mixedActivities && compatible(modality, w)).sort((a, b) => Number(dateInZone(b.start, block.timeZone) === slot.date)
    - Number(dateInZone(a.start, block.timeZone) === slot.date) || b.start - a.start);
}

export function createLinkedCardioWorkout(block: CardioBlock, slotId: string, recordId: string, data: CardioHealthRead,
  workouts: readonly CardioWorkout[], now: number, id: string): CardioWorkout {
  if (!validCardioBlock(block, block.userId)) throw Error('invalidCardioBlock');
  const record = cardioHealthCandidates(block, slotId, data, workouts, now).find(w => w.id === recordId);
  if (!record) throw Error('healthCardioUnavailable');
  const prescription = cardioSlotPrescription(block, slotId);
  const startedAt = Math.round(record.start), finishedAt = Math.round(record.end);
  const elapsedMs = Math.min(finishedAt - startedAt, Math.round(record.durationSeconds * 1000));
  const workout: CardioWorkout = {
    schemaVersion: 1, id, userId: block.userId, blockId: block.id, slotId, name: block.proposal.name, prescription,
    ...(prescription.policy === 'MANUAL_PHASES_V1' ? { manualPhase: { index: 0, startedAtElapsedMs: 0 } } : {}),
    startedAt, finishedAt, elapsedMs, updatedAt: now, revision: 1, actualSeconds: Math.round(elapsedMs / 1000),
    status: 'FINISHED', feedback: null, source: 'APPLE_HEALTH_LINK_V1', healthLinkKey: record.linkKey,
  };
  if (!validCardioWorkout(workout, block.userId)) throw Error('invalidHealthCardioLink');
  return workout;
}
