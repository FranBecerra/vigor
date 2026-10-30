import type { CardioBlock, CardioWorkout } from '@/models/cardioTraining';
import { reviseSessionFeedback, sessionEffortValue, SESSION_EFFORT_SCALE } from '@/services/training/sessionFeedback';
import { validSportIdentity } from './sportActivities';
import { validCardioBlock } from './cardioBlock';
import { cardioSlotPrescription } from './cardioProgressionPolicy';

const stamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 8.64e15;

export function validCardioWorkout(value: unknown, owner: string): value is CardioWorkout {
  if (!value || typeof value !== 'object' || !validSportIdentity(owner)) return false;
  const w = value as CardioWorkout, p = w.prescription;
  if (w.schemaVersion !== 1 || !validSportIdentity(w.id) || w.userId !== owner || !validSportIdentity(w.blockId)
    || !validSportIdentity(w.slotId) || typeof w.name !== 'string' || !w.name || w.name.length > 80
    || !['RUNNING', 'PAUSED', 'FINISHED', 'DISCARDED'].includes(w.status) || !stamp(w.startedAt) || !stamp(w.updatedAt) || w.updatedAt < w.startedAt
    || !Number.isSafeInteger(w.revision) || w.revision < 1 || !Number.isSafeInteger(w.elapsedMs) || w.elapsedMs < 0 || w.elapsedMs > w.updatedAt - w.startedAt
    || w.source !== 'TIMER_TIME_EFFORT_V1' || !p || p.schemaVersion !== 1 || !['EASY_START_V1', 'REVIEWED_EASY_DURATION_V1'].includes(p.policy) || !validSportIdentity(p.id)
    || !['RUNNING', 'CYCLING', 'MACHINE'].includes(p.modality) || p.stimulus !== 'EASY' || !['CURRENT_PRACTICE', 'FAMILIARIZATION', 'REVIEWED_HISTORY'].includes(p.basis)
    || !Number.isInteger(p.durationSeconds) || p.durationSeconds < 60 || p.durationSeconds > 36000 || typeof p.allowWalking !== 'boolean'
    || !Array.isArray(p.adjustments) || p.adjustments.some(a => !['UNKNOWN_DURATION', 'TOLERATED_DURATION_CAP', 'AVAILABILITY_CAP'].includes(a))
    || !Array.isArray(p.segments) || p.segments.length !== 3
    || p.segments.some((s, i) => !s || s.phase !== ['WARMUP', 'EASY', 'COOLDOWN'][i] || !Number.isInteger(s.durationSeconds) || s.durationSeconds < 1
      || s.effort?.scale !== 'VIGOR_CARDIO_EFFORT_0_10_V1' || s.effort.min !== (i === 1 ? 2 : 1) || s.effort.max !== (i === 1 ? 4 : 2)
      || s.talkTest !== 'COMFORTABLE_CONVERSATION') || p.segments.reduce((n, s) => n + s.durationSeconds, 0) !== p.durationSeconds) return false;
  if (w.status === 'RUNNING' || w.status === 'PAUSED' || w.status === 'DISCARDED' && w.finishedAt === null) return w.finishedAt === null && w.actualSeconds === null && w.feedback === null;
  return stamp(w.finishedAt) && w.finishedAt <= w.updatedAt && Number.isInteger(w.actualSeconds) && w.actualSeconds! >= 1 && w.actualSeconds! <= 86400
    && (w.feedback === null || w.feedback.scale === SESSION_EFFORT_SCALE && (w.feedback.effort === null || sessionEffortValue(w.feedback) !== null)
      && stamp(w.feedback.recordedAt) && w.feedback.recordedAt <= w.updatedAt && w.feedback.recordedAt >= w.finishedAt
      && ['AT_FINISH', 'HISTORY_EDIT'].includes(w.feedback.timing));
}

export function startCardioWorkout(block: CardioBlock, slotId: string, now: number, id: string): CardioWorkout {
  if (!validCardioBlock(block, block?.userId)) throw Error('invalidCardioStart');
  const slot = block.slots.find(s => s.id === slotId);
  if (block.endedAt !== null || !slot || slot.disposition !== 'CARDIO' || !stamp(now) || now < block.createdAt || !validSportIdentity(id)) throw Error('invalidCardioStart');
  return { schemaVersion: 1, id, userId: block.userId, blockId: block.id, slotId, name: block.proposal.name,
    prescription: cardioSlotPrescription(block, slot.id),
    startedAt: now, updatedAt: now, revision: 1, elapsedMs: 0, status: 'RUNNING', finishedAt: null, actualSeconds: null, feedback: null, source: 'TIMER_TIME_EFFORT_V1' };
}

/** Wall-clock intervals survive screen changes/backgrounding; pauses never contribute. */
export function cardioElapsed(w: CardioWorkout, now: number): number {
  return w.elapsedMs + (w.status === 'RUNNING' ? Math.max(0, now - w.updatedAt) : 0);
}
export function cardioPhase(w: CardioWorkout, now: number) {
  let elapsed = Math.floor(cardioElapsed(w, now) / 1000);
  for (const segment of w.prescription.segments) {
    if (elapsed < segment.durationSeconds) return { phase: segment.phase, remaining: segment.durationSeconds - elapsed, effort: segment.effort };
    elapsed -= segment.durationSeconds;
  }
  return { phase: 'READY' as const, remaining: 0, effort: null };
}

export function transitionCardioWorkout(w: CardioWorkout, action: 'PAUSE' | 'RESUME' | 'DISCARD' | 'FINISH', now: number,
  actualSeconds: number | null = null, effort: number | null = null): CardioWorkout {
  if (!validCardioWorkout(w, w.userId) || !['RUNNING', 'PAUSED'].includes(w.status) && !(action === 'DISCARD' && w.status === 'FINISHED') || !stamp(now) || now < w.updatedAt
    || w.revision === Number.MAX_SAFE_INTEGER || !['PAUSE', 'RESUME', 'DISCARD', 'FINISH'].includes(action)
    || action === 'PAUSE' && w.status !== 'RUNNING' || action === 'RESUME' && w.status !== 'PAUSED') throw Error('invalidCardioTransition');
  const next: CardioWorkout = { ...w, revision: w.revision + 1, updatedAt: now, elapsedMs: cardioElapsed(w, now),
    status: action === 'PAUSE' ? 'PAUSED' : action === 'RESUME' ? 'RUNNING' : action === 'DISCARD' ? 'DISCARDED' : 'FINISHED',
    actualSeconds: action === 'FINISH' ? actualSeconds : action === 'DISCARD' ? w.actualSeconds : null, finishedAt: action === 'FINISH' ? now : action === 'DISCARD' ? w.finishedAt : null,
    feedback: action === 'FINISH' ? reviseSessionFeedback(undefined, effort, now, 'AT_FINISH') ?? null : action === 'DISCARD' ? w.feedback : null };
  if (!validCardioWorkout(next, w.userId)) throw Error('invalidCardioTransition');
  return next;
}

export function correctCardioWorkout(w: CardioWorkout, actualSeconds: number, effort: number | null, now: number): CardioWorkout {
  if (!validCardioWorkout(w, w.userId) || w.status !== 'FINISHED' || !stamp(now) || now < w.updatedAt || w.revision === Number.MAX_SAFE_INTEGER) throw Error('invalidCardioCorrection');
  const next: CardioWorkout = { ...w, actualSeconds, updatedAt: now, revision: w.revision + 1,
    feedback: reviseSessionFeedback(w.feedback ?? undefined, effort, now, 'HISTORY_EDIT') ?? null };
  if (!validCardioWorkout(next, w.userId)) throw Error('invalidCardioCorrection');
  return next;
}
