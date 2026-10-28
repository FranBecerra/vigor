import type {
  CardioPlanningConstraints,
  CardioPlanningModality,
  CardioProfile,
  EasyCardioDraftPlan,
  EasyCardioPrescription,
  EasyCardioRequest,
} from '@/models/cardio';
import { scheduleCardioCandidates, validateCardioProfile } from './cardioPlanner';

const modalities: readonly CardioPlanningModality[] = ['RUNNING', 'CYCLING', 'MACHINE'];
const validMinutes = (value: unknown): value is number => typeof value === 'number'
  && Number.isFinite(value) && value >= 1 && value <= 600;

/**
 * EASY_START_V1 authors a first draft, not a progressive mesocycle.
 * An unknown current duration uses at most 20 full minutes for familiarization.
 * The requested duration never overrides a smaller declared current tolerance.
 */
export function authorEasyCardio(
  request: Pick<EasyCardioRequest, 'id' | 'modality' | 'durationMinutes'>,
  profile: CardioProfile,
  maxSessionMinutes: number,
): EasyCardioPrescription {
  if (!request || typeof request.id !== 'string' || !request.id.trim() || request.id.length > 160
    || !modalities.includes(request.modality) || !validMinutes(request.durationMinutes)
    || !validMinutes(maxSessionMinutes) || !validateCardioProfile(profile)) {
    throw Error('invalidEasyCardioRequest');
  }
  const current = profile.modalities[request.modality];
  const tolerated = current?.typicalSessionMinutes;
  const adjustments: EasyCardioPrescription['adjustments'] = [];
  if (tolerated === undefined) adjustments.push('UNKNOWN_DURATION');
  if (tolerated !== undefined && tolerated < request.durationMinutes) adjustments.push('TOLERATED_DURATION_CAP');
  if (maxSessionMinutes < request.durationMinutes) adjustments.push('AVAILABILITY_CAP');
  // Round down only to whole seconds; never inflate a small current tolerance.
  const durationSeconds = Math.floor(Math.min(request.durationMinutes, maxSessionMinutes, tolerated ?? 20) * 60);
  const edge = Math.min(300, Math.floor(durationSeconds * 0.2));
  const segment = (phase: EasyCardioPrescription['segments'][number]['phase'], duration: number, min: number, max: number) => ({
    phase, durationSeconds: duration,
    effort: { scale: 'VIGOR_CARDIO_EFFORT_0_10_V1' as const, min, max },
    talkTest: 'COMFORTABLE_CONVERSATION' as const,
  });
  return {
    schemaVersion: 1, policy: 'EASY_START_V1', id: request.id, modality: request.modality,
    stimulus: 'EASY', durationSeconds, allowWalking: request.modality === 'RUNNING',
    basis: current?.status === 'REGULAR' && tolerated !== undefined ? 'CURRENT_PRACTICE' : 'FAMILIARIZATION',
    adjustments,
    segments: [segment('WARMUP', edge, 1, 2), segment('EASY', durationSeconds - 2 * edge, 2, 4), segment('COOLDOWN', edge, 1, 2)],
  };
}

/** Composes authored drafts with the existing hard-cap/relative-day scheduler. */
export function draftEasyCardioPlan(
  constraints: Omit<CardioPlanningConstraints, 'candidates'>,
  requests: readonly EasyCardioRequest[],
): EasyCardioDraftPlan {
  // Validate the entire scheduling contract even when there are no requests.
  scheduleCardioCandidates({ ...constraints, candidates: [] });
  if (!Array.isArray(requests)) throw Error('invalidEasyCardioRequests');
  // A zero-minute ceiling is a valid scheduling limit, not a reason to invent time.
  if (constraints.maxSessionMinutes < 1) {
    const candidates = requests.map(request => ({
      ...request, stimulus: 'EASY' as const,
      durationMinutes: authorEasyCardio(request, constraints.profile, 600).durationSeconds / 60,
    }));
    return { ...scheduleCardioCandidates({ ...constraints, candidates }), prescriptions: [] };
  }
  const authored = requests.map(request => authorEasyCardio(request, constraints.profile, Math.min(600, constraints.maxSessionMinutes)));
  const plan = scheduleCardioCandidates({ ...constraints, candidates: requests.map((request, index) => ({
    ...request, stimulus: 'EASY' as const, durationMinutes: authored[index].durationSeconds / 60,
  })) });
  const byId = new Map(authored.map(item => [item.id, item]));
  return { ...plan, prescriptions: plan.scheduled.map(item => byId.get(item.id)!) };
}
