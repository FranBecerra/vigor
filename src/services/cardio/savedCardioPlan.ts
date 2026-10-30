import type { RoutineView } from '@/services/training/routineView';
import { validSportIdentity } from './sportActivities';
import { buildCardioPreview, cardioPreviewIssue, strengthPlacements, type CardioPreview, type CardioPreviewInput } from './cardioPreview';
import { copyReviewedCardioStart, freshReviewedCardioStart } from './reviewedCardioStart';

/** Immutable proposal snapshot. Saving is not activation or performed training. */
export interface SavedCardioPlan {
  schemaVersion: 1;
  policy: 'CARDIO_PREVIEW_V1' | 'CARDIO_PREVIEW_V2' | 'CARDIO_PREVIEW_V3';
  healthPlanningConsent?: { policy: 'HEALTH_DERIVED_PRIVATE_PLAN_V1'; acceptedAt: number };
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  archivedAt: number | null;
  input: CardioPreviewInput;
  preview: CardioPreview;
  strengthSource: { routineId: string; fingerprint: string; microcycleIndex?: number } | null;
}
const epoch = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && Number.isFinite(new Date(n).getTime());
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
};

/** Only declared planning fields may leave the draft; never persist arbitrary context. */
function planningInput(input: CardioPreviewInput): CardioPreviewInput {
  return { ...(input.healthBaseline ? { healthBaseline: copyReviewedCardioStart(input.healthBaseline) } : {}),
    ...(input.placementPolicy ? { placementPolicy: input.placementPolicy } : {}), modalities: [...input.modalities], cycleDays: input.cycleDays, availableDays: [...input.availableDays],
    sessions: input.sessions, cardioMinutes: input.cardioMinutes, sessionMinutes: input.sessionMinutes,
    maxActiveDays: input.maxActiveDays, allowDoubles: input.allowDoubles,
    strength: input.strength.map(s => ({ id: s.id, name: s.name, dayIndex: s.dayIndex, estimatedMinutes: s.estimatedMinutes, lowerBodyDemand: s.lowerBodyDemand })),
    profile: { schemaVersion: 1, modalities: Object.fromEntries(Object.entries(input.profile.modalities).map(([key, p]) => [key, {
      status: p.status, qualityExposure: p.qualityExposure, consistentWeeks: p.consistentWeeks, sessionsPerWeek: p.sessionsPerWeek,
      typicalSessionMinutes: p.typicalSessionMinutes, recentLongestRunKm: p.recentLongestRunKm,
    }])) },
  };
}

export function cardioPlanPolicy(input: CardioPreviewInput): SavedCardioPlan['policy'] {
  return input.healthBaseline ? 'CARDIO_PREVIEW_V3' : input.placementPolicy ? 'CARDIO_PREVIEW_V2' : 'CARDIO_PREVIEW_V1';
}
export function cardioStrengthSource(routine?: RoutineView, policy: SavedCardioPlan['policy'] = 'CARDIO_PREVIEW_V1'): SavedCardioPlan['strengthSource'] {
  return routine ? { routineId: routine.id, fingerprint: canonical(strengthPlacements(routine, policy !== 'CARDIO_PREVIEW_V1')),
    ...(policy !== 'CARDIO_PREVIEW_V1' ? { microcycleIndex: routine.currentMicrocycleIndex } : {}) } : null;
}

/** Never silently refresh a saved prescription after the source routine changes. */
export function cardioStrengthChanged(plan: SavedCardioPlan, routine?: RoutineView): boolean {
  return plan.strengthSource !== null && canonical(plan.strengthSource) !== canonical(cardioStrengthSource(routine, plan.policy));
}

export function validSavedCardioPlan(value: unknown, owner: string): value is SavedCardioPlan {
  try {
    if (!value || typeof value !== 'object' || !validSportIdentity(owner)) return false;
    const p = value as SavedCardioPlan;
    if (p.schemaVersion !== 1 || !['CARDIO_PREVIEW_V1', 'CARDIO_PREVIEW_V2', 'CARDIO_PREVIEW_V3'].includes(p.policy)
      || !p.input || p.policy !== cardioPlanPolicy(p.input)
      || (p.policy !== 'CARDIO_PREVIEW_V1') !== (p.input.placementPolicy === 'BALANCED_V2') || !validSportIdentity(p.id) || p.userId !== owner
      || typeof p.name !== 'string' || !p.name.trim() || p.name !== p.name.trim() || p.name.length > 80
      || !epoch(p.createdAt) || p.archivedAt !== null && (!epoch(p.archivedAt) || p.archivedAt < p.createdAt)
      || cardioPreviewIssue(p.input) || p.input.strength.length > 31
      || p.input.strength.some(s => s.id.length > 256 || s.name.length > 160)
      || canonical(planningInput(p.input)) !== canonical(p.input)) return false;
    if (p.policy === 'CARDIO_PREVIEW_V3') {
      const consent = p.healthPlanningConsent;
      if (!consent || Object.keys(consent).length !== 2 || consent.policy !== 'HEALTH_DERIVED_PRIVATE_PLAN_V1'
        || consent.acceptedAt !== p.createdAt || !freshReviewedCardioStart(p.input.healthBaseline, p.createdAt)) return false;
    } else if (p.healthPlanningConsent !== undefined) return false;
    if (p.input.strength.length && p.strengthSource === null) return false;
    if (p.strengthSource !== null && (!p.strengthSource || !validSportIdentity(p.strengthSource.routineId)
      || typeof p.strengthSource.fingerprint !== 'string' || !p.strengthSource.fingerprint || p.strengthSource.fingerprint.length > 30000
      || p.policy !== 'CARDIO_PREVIEW_V1' && (!Number.isSafeInteger(p.strengthSource.microcycleIndex) || p.strengthSource.microcycleIndex! < 0)
      || p.policy === 'CARDIO_PREVIEW_V1' && p.strengthSource.microcycleIndex !== undefined
      || !p.input.strength.length)) return false;
    const expected = buildCardioPreview(p.input);
    // Policy v1 is frozen: future algorithm changes must introduce a new policy reader.
    return expected.scheduled.length > 0 && canonical(expected) === canonical(p.preview);
  } catch { return false; }
}

export function saveCardioProposal(id: string, owner: string, name: string, input: CardioPreviewInput,
  source: SavedCardioPlan['strengthSource'], now: number, healthSaveAccepted = false): SavedCardioPlan {
  if (cardioPreviewIssue(input) || input.healthBaseline && (healthSaveAccepted !== true || !freshReviewedCardioStart(input.healthBaseline, now))) throw Error('invalidCardioPlan');
  const plan: SavedCardioPlan = { schemaVersion: 1, policy: cardioPlanPolicy(input), id, userId: owner,
    ...(input.healthBaseline ? { healthPlanningConsent: { policy: 'HEALTH_DERIVED_PRIVATE_PLAN_V1' as const, acceptedAt: now } } : {}),
    name: typeof name === 'string' ? name.trim() : name, createdAt: now, archivedAt: null,
    input: planningInput(input), preview: buildCardioPreview(planningInput(input)), strengthSource: input.strength.length ? source : null };
  if (!validSavedCardioPlan(plan, owner)) throw Error('invalidCardioPlan');
  // Detach every nested input/profile/candidate array from the editing draft.
  return JSON.parse(JSON.stringify(plan)) as SavedCardioPlan;
}

export function archiveCardioProposal(plan: SavedCardioPlan, owner: string, now: number): SavedCardioPlan {
  if (!validSavedCardioPlan(plan, owner) || plan.archivedAt !== null || !epoch(now) || now < plan.createdAt) throw Error('invalidCardioPlan');
  return { ...plan, archivedAt: now };
}
