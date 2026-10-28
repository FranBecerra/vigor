import type { SessionFeedback, SessionEffortObservation } from '@/models/sessionFeedback';

export const SESSION_EFFORT_SCALE = 'VIGOR_SESSION_EFFORT_1_10_V1' as const;
const validEffort = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
const validObservation = (value: unknown): value is SessionEffortObservation => {
  if (!value || typeof value !== 'object') return false;
  const item = value as SessionEffortObservation;
  return (item.effort === null || validEffort(item.effort)) && Number.isFinite(item.recordedAt) && item.recordedAt > 0
    && ['AT_FINISH', 'HISTORY_EDIT', 'MANUAL_ENTRY'].includes(item.timing);
};

/** Unknown scales/malformed history are missing, never zero or a converted RIR. */
export function sessionEffortValue(feedback: unknown): number | null {
  return validObservation(feedback) && (feedback as SessionFeedback).scale === SESSION_EFFORT_SCALE ? feedback.effort : null;
}

export function reviseSessionFeedback(previous: SessionFeedback | undefined, effort: number | null, now: number,
  timing: SessionEffortObservation['timing']): SessionFeedback | undefined {
  if (effort !== null && !validEffort(effort) || !Number.isFinite(now) || now <= 0
    || !['AT_FINISH', 'HISTORY_EDIT', 'MANUAL_ENTRY'].includes(timing)) throw Error('invalidSessionFeedback');
  const known = validObservation(previous) && previous.scale === SESSION_EFFORT_SCALE ? previous : undefined;
  if (!known && effort === null) return undefined;
  if (known && known.effort === effort) return known;
  const revisions = known ? [...(Array.isArray(known.revisions) ? known.revisions.filter(validObservation) : []),
    { effort: known.effort, recordedAt: known.recordedAt, timing: known.timing }].slice(-20) : [];
  return { scale: SESSION_EFFORT_SCALE, effort, recordedAt: now, timing, ...(revisions.length ? { revisions } : {}) };
}
