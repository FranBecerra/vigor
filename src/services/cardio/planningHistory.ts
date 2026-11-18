import type { CardioHealthRead } from '@/models/cardioHealth';
import type { CardioWorkout } from '@/models/cardioTraining';
import { sessionEffortValue } from '@/services/training/sessionFeedback';
import { validCardioWorkout } from './cardioWorkout';
import { cardioHealthWindow } from './cardioHealthReview';
import { freshReviewedCardioStart, type ReviewedCardioStart } from './reviewedCardioStart';
import type { CardioPreviewInput } from './cardioPreview';
import type { CardioStartContext } from './cardioStartingPoint';
import { validSportIdentity } from './sportActivities';
import type { HybridAvailability } from './hybridAvailability';

/** Untouched starter defaults are not athlete limits. Use available slots for review. */
export function historyReviewInput(input: CardioPreviewInput, shared?: HybridAvailability, respectDose = false): CardioPreviewInput {
  if (respectDose) return input;
  const maxActiveDays = shared?.trainingDays ?? input.availableDays.length;
  const doubles = shared?.allowDoubles ?? input.allowDoubles;
  const sessions = Math.min(14, Math.max(0, maxActiveDays - (doubles ? 0 : input.strength.length)));
  const sessionMinutes = shared?.minutesPerSession ?? 600;
  return { ...input, maxActiveDays, sessions, sessionMinutes, cardioMinutes: Math.min(1440, sessions * sessionMinutes) };
}

/** In-memory adapter only. Vigor timer records are never labelled Health measurements. */
export function vigorPlanningHistory(entries: readonly CardioWorkout[], owner: string, now: number): CardioHealthRead {
  if (!Array.isArray(entries) || !validSportIdentity(owner)) throw Error('invalidPlanningHistory');
  const window = cardioHealthWindow(now);
  const workouts: CardioHealthRead['workouts'] = [];
  for (const value of entries) {
    if (value?.userId !== owner) continue;
    if (!validCardioWorkout(value, owner)) throw Error('invalidPlanningHistory');
    // Linked records can inform planning through the existing consented Health history path.
    if (value.source !== 'TIMER_TIME_EFFORT_V1' || value.status !== 'FINISHED' || value.startedAt < window.start || value.finishedAt! > now) continue;
    // A corrected duration may be longer than the recorded interval. Do not invent dates.
    if (value.finishedAt! < value.startedAt || value.actualSeconds! * 1000 > value.finishedAt! - value.startedAt + 1000) throw Error('inconsistentPlanningHistory');
    if (value.prescription.modality === 'MACHINE') continue;
    const effort = sessionEffortValue(value.feedback);
    workouts.push({ ...(effort !== null ? { sessionEffort: effort } : {}), id: `vigor:${value.id}`, kind: value.prescription.modality, start: value.startedAt, end: value.finishedAt!,
      durationSeconds: value.actualSeconds!, sourceId: 'vigor-timer', sourceName: 'Vigor', manuallyEntered: false, ownExport: false, mixedActivities: false });
  }
  return { version: 1, truncated: workouts.length > 1000, workouts: workouts.slice(0, 1000) };
}

/** Reuse the generator's capacity; never ask the athlete for it a second time. */
export function planningHistoryContext(input: CardioPreviewInput, modality: 'RUNNING' | 'CYCLING'): CardioStartContext {
  return { modality, response: 'UNKNOWN', inferFromHistory: true, assessMonthlyCapacity: true,
    cycleDays: input.cycleDays, maxSessions: input.sessions, maxSessionMinutes: input.sessionMinutes, totalMinutes: input.cardioMinutes };
}

/** Explicitly confirmed Vigor practice seeds a draft, without Health provenance/consent. */
export function applyVigorStartingPoint(input: CardioPreviewInput, baseline: ReviewedCardioStart, now: number): CardioPreviewInput {
  if (!freshReviewedCardioStart(baseline, now) || input.modalities.length !== 1 || input.modalities[0] !== baseline.modality
    || baseline.cycleDays !== input.cycleDays || baseline.maxSessions !== input.sessions
    || baseline.maxSessionMinutes !== input.sessionMinutes || baseline.availableMinutes !== input.cardioMinutes) throw Error('stalePlanningContext');
  return { ...input, healthBaseline: undefined, sessions: baseline.sessions, sessionMinutes: baseline.sessionMinutes, cardioMinutes: baseline.totalMinutes,
    profile: { ...input.profile, modalities: { ...input.profile.modalities, [baseline.modality]: {
      ...input.profile.modalities[baseline.modality], status: input.profile.modalities[baseline.modality]?.status ?? 'UNSURE',
      qualityExposure: 'UNKNOWN', typicalSessionMinutes: baseline.sessionMinutes, sessionsPerWeek: Math.min(14, baseline.weeklySessions),
    } } } };
}
