import type { CardioProfile } from '@/models/cardio';
import type { CardioPreviewInput } from './cardioPreview';
import { proposeCardioStartingPoint, type CardioStartContext } from './cardioStartingPoint';

/** Minimal numeric provenance. No workout IDs, sources, traces or symptom responses. */
export interface ReviewedCardioStart {
  version: 1;
  policy: 'OBSERVED_EASY_START_POC_V1';
  modality: 'RUNNING' | 'CYCLING';
  observedAt: number;
  acceptedAt: number;
  cycleDays: number;
  sessions: number;
  sessionMinutes: number;
  totalMinutes: number;
  comfortableMinutes: number;
  maxSessions: number;
  maxSessionMinutes: number;
  availableMinutes: number;
  observedSessions: number;
  representedWeeks: number;
  typicalMinutes: number;
  weeklySessions: number;
  weeklyMinutes: number;
}
const keys = ['version', 'policy', 'modality', 'observedAt', 'acceptedAt', 'cycleDays', 'sessions', 'sessionMinutes', 'totalMinutes',
  'comfortableMinutes', 'maxSessions', 'maxSessionMinutes', 'availableMinutes', 'observedSessions', 'representedWeeks', 'typicalMinutes', 'weeklySessions', 'weeklyMinutes'] as const;
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const positive = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;
const DAY = 86400000;

/** Stable validation for immutable saved plans; never expire an already saved plan. */
export function validReviewedCardioStart(value: unknown): value is ReviewedCardioStart {
  const v = value as ReviewedCardioStart;
  if (!v || Object.keys(v).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(v, key))
    || v.version !== 1 || v.policy !== 'OBSERVED_EASY_START_POC_V1' || !['RUNNING', 'CYCLING'].includes(v.modality)
    || !integer(v.observedAt, 42 * DAY + 1, 8.64e15) || !integer(v.acceptedAt, v.observedAt, Math.min(8.64e15, v.observedAt + DAY))
    || !integer(v.cycleDays, 7, 31) || !integer(v.sessions, 1, 14) || !integer(v.sessionMinutes, 1, 600)
    || !integer(v.totalMinutes, 1, 1440) || !integer(v.comfortableMinutes, 1, 600)
    || !integer(v.maxSessions, 1, 14) || !integer(v.maxSessionMinutes, 1, 600) || !integer(v.availableMinutes, 1, 1440)
    || !integer(v.observedSessions, 4, 1000) || !integer(v.representedWeeks, 3, 4)
    || !positive(v.typicalMinutes, 7 * 1440) || !positive(v.weeklyMinutes, 7 * 1440)
    || !positive(v.weeklySessions, 1000) || !Number.isInteger(v.weeklySessions * 2)) return false;
  const sessions = Math.min(v.maxSessions, Math.floor(v.weeklySessions * v.cycleDays / 7));
  const minutes = Math.floor(Math.min(v.typicalMinutes, v.comfortableMinutes, v.maxSessionMinutes,
    v.availableMinutes / sessions, v.weeklyMinutes * v.cycleDays / 7 / sessions));
  return v.sessions === sessions && v.sessionMinutes === minutes && v.totalMinutes === sessions * minutes;
}

export function freshReviewedCardioStart(value: unknown, now: number): value is ReviewedCardioStart {
  return validReviewedCardioStart(value) && Number.isFinite(now) && now >= value.acceptedAt && now - value.observedAt <= DAY;
}

export function copyReviewedCardioStart(value: ReviewedCardioStart): ReviewedCardioStart {
  if (!validReviewedCardioStart(value)) throw Error('invalidReviewedCardioStart');
  return { ...value };
}

/** Recalculate at explicit application time; a stale displayed result cannot be handed off. */
export function acceptReviewedCardioStart(raw: unknown, observedAt: number, now: number, context: CardioStartContext,
  sourceId?: string, excludedIds: readonly string[] = []): ReviewedCardioStart {
  const result = proposeCardioStartingPoint(raw, observedAt, now, context, sourceId, excludedIds);
  if (result.state !== 'READY') throw Error('unavailableReviewedCardioStart');
  const value: ReviewedCardioStart = { version: 1, policy: result.policy, modality: result.modality, observedAt, acceptedAt: now,
    cycleDays: result.cycleDays, sessions: result.sessions, sessionMinutes: result.sessionMinutes, totalMinutes: result.totalMinutes,
    comfortableMinutes: context.comfortableMinutes!, maxSessions: context.maxSessions, maxSessionMinutes: context.maxSessionMinutes,
    availableMinutes: context.totalMinutes, observedSessions: result.observedSessions, representedWeeks: result.representedWeeks,
    typicalMinutes: result.typicalMinutes, weeklySessions: result.weeklySessions, weeklyMinutes: result.weeklyMinutes };
  return copyReviewedCardioStart(value);
}

/** Only seed a new draft. Retain declared experience; repeated recordings do not assign a level. */
export function reviewedCardioDefaults(value: ReviewedCardioStart, profile: CardioProfile): Pick<CardioPreviewInput,
  'healthBaseline' | 'modalities' | 'profile' | 'cycleDays' | 'availableDays' | 'sessions' | 'sessionMinutes' | 'cardioMinutes'> {
  const v = copyReviewedCardioStart(value), declared = profile.modalities[v.modality];
  return { healthBaseline: v, modalities: [v.modality], cycleDays: v.cycleDays,
    availableDays: Array.from({ length: v.cycleDays }, (_, day) => day), sessions: v.sessions,
    sessionMinutes: v.maxSessionMinutes, cardioMinutes: v.availableMinutes,
    profile: { schemaVersion: 1, modalities: { [v.modality]: { status: declared?.status ?? 'UNSURE', qualityExposure: 'UNKNOWN',
      typicalSessionMinutes: v.comfortableMinutes } } } };
}
