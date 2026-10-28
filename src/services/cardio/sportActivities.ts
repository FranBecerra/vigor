import { SPORT_KINDS, type SportActivity, type SportActivityDraft, type SportTiming } from '@/models/sportActivity';
import { reviseSessionFeedback, sessionEffortValue, SESSION_EFFORT_SCALE } from '../training/sessionFeedback';

const epoch = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime());
export function validSportIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128 && !value.includes('/') && value !== '.' && value !== '..';
}
export function validSportTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 100) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; }
}
function validTiming(value: unknown): value is SportTiming {
  if (!value || typeof value !== 'object') return false;
  const timing = value as SportTiming;
  return epoch(timing.startAt) && Number.isFinite(timing.durationMinutes) && timing.durationMinutes >= 1
    && timing.durationMinutes <= 1440 && validSportTimeZone(timing.timeZone);
}

export function validSportActivity(value: unknown, owner: string): value is SportActivity {
  if (!value || typeof value !== 'object' || !validSportIdentity(owner)) return false;
  const item = value as SportActivity;
  if (item.schemaVersion !== 1 || !validSportIdentity(item.id) || item.userId !== owner
    || !SPORT_KINDS.includes(item.sport) || !['CLASS', 'MATCH', 'FREE'].includes(item.context)
    || typeof item.name !== 'string' || item.name.length > 80 || item.name !== item.name.trim()
    || item.sport === 'OTHER' && !item.name || typeof item.notes !== 'string' || item.notes.length > 2000
    || !epoch(item.createdAt) || !epoch(item.updatedAt) || item.updatedAt < item.createdAt
    || !Number.isSafeInteger(item.revision) || item.revision < 1
    || item.discardedAt !== null && (!epoch(item.discardedAt) || item.discardedAt < item.createdAt || item.discardedAt > item.updatedAt)
    || item.planned !== null && !validTiming(item.planned)
    || !item.planned && !item.record) return false;
  if (item.record === null) return true;
  if (!validTiming(item.record) || item.record.source !== 'MANUAL'
    || item.record.startAt + item.record.durationMinutes * 60000 > item.updatedAt) return false;
  const feedback = item.record.feedback;
  return feedback === null || !!feedback && feedback.scale === SESSION_EFFORT_SCALE
    && (feedback.effort === null || sessionEffortValue(feedback) !== null)
    && epoch(feedback.recordedAt) && ['AT_FINISH', 'HISTORY_EDIT', 'MANUAL_ENTRY'].includes(feedback.timing);
}

/** A reservation never becomes performed exposure merely because its date passed. */
export function saveSportDraft(id: string, owner: string, draft: SportActivityDraft, now: number, previous?: SportActivity): SportActivity {
  if (!validSportIdentity(id) || !validSportIdentity(owner) || !epoch(now) || !draft
    || !['PLAN', 'RECORD'].includes(draft.mode) || !validTiming(draft)
    || previous && (!validSportActivity(previous, owner) || previous.id !== id || previous.discardedAt !== null
      || now < previous.updatedAt || previous.record && draft.mode === 'PLAN')) throw Error('invalidSportActivity');
  const timing = { startAt: draft.startAt, durationMinutes: draft.durationMinutes, timeZone: draft.timeZone };
  const record = draft.mode === 'RECORD' ? { ...timing, source: 'MANUAL' as const,
    feedback: reviseSessionFeedback(previous?.record?.feedback ?? undefined, draft.effort, now,
      previous?.record ? 'HISTORY_EDIT' : 'MANUAL_ENTRY') ?? null } : previous?.record ?? null;
  const next: SportActivity = { schemaVersion: 1, id, userId: owner, sport: draft.sport, context: draft.context,
    name: typeof draft.name === 'string' ? draft.name.trim() : draft.name,
    notes: typeof draft.notes === 'string' ? draft.notes.trim() : draft.notes,
    planned: draft.mode === 'PLAN' ? timing : previous?.planned ?? null, record,
    createdAt: previous?.createdAt ?? now, updatedAt: now, revision: (previous?.revision ?? 0) + 1, discardedAt: null };
  if (!validSportActivity(next, owner)) throw Error('invalidSportActivity');
  return next;
}

export function discardSportActivity(item: SportActivity, owner: string, now: number): SportActivity {
  if (!validSportActivity(item, owner) || !epoch(now) || now < item.updatedAt || item.discardedAt !== null
    || item.revision === Number.MAX_SAFE_INTEGER) throw Error('invalidSportActivity');
  return { ...item, discardedAt: now, updatedAt: now, revision: item.revision + 1 };
}

export function sportDraft(item: SportActivity | null, mode: SportActivityDraft['mode'], now: number, timeZone: string): SportActivityDraft {
  const timing = mode === 'RECORD' ? item?.record ?? item?.planned : item?.planned;
  return { sport: item?.sport ?? 'PADEL', context: item?.context ?? 'FREE', name: item?.name ?? '', notes: item?.notes ?? '', mode,
    startAt: timing?.startAt ?? (mode === 'RECORD' ? now - 3600000 : now + 86400000), durationMinutes: timing?.durationMinutes ?? 60,
    timeZone: timing?.timeZone ?? timeZone, effort: sessionEffortValue(item?.record?.feedback) };
}

export function sportActivityStart(item: SportActivity): number { return (item.record ?? item.planned)!.startAt; }
export function sportActivityMinutes(item: SportActivity): number { return (item.record ?? item.planned)!.durationMinutes; }
