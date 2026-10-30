import type { CardioProfile, CardioPlanningModality } from '@/models/cardio';
import type { RoutineView } from '@/services/training/routineView';
import { estimateSessionMinutes } from '@/services/training/sessionSummary';
import { routineDays, routineRestDays } from '@/services/training/routineRestDays';
import { validateCardioProfile } from './cardioPlanner';
import { draftEasyCardioPlan } from './easyCardio';
import { validReviewedCardioStart, type ReviewedCardioStart } from './reviewedCardioStart';

export const CARDIO_MODALITIES: readonly CardioPlanningModality[] = ['RUNNING', 'CYCLING', 'MACHINE'];
export interface CardioStrengthPlacement {
  id: string;
  name: string;
  dayIndex?: number;
  estimatedMinutes: number;
  lowerBodyDemand: 'LOW' | 'HIGH';
}
export interface CardioPreviewInput {
  healthBaseline?: ReviewedCardioStart;
  placementPolicy?: 'BALANCED_V2';
  modalities: CardioPlanningModality[];
  profile: CardioProfile;
  cycleDays: number;
  availableDays: number[];
  sessions: number;
  cardioMinutes: number;
  sessionMinutes: number;
  maxActiveDays: number;
  allowDoubles: boolean;
  strength: CardioStrengthPlacement[];
}
export type CardioPreviewIssue = 'MODALITIES' | 'PROFILE' | 'LIMITS' | 'AVAILABILITY' | 'STRENGTH_DAY' | 'STRENGTH_COLLISION' | 'ACTIVE_DAYS' | 'HEALTH_BASELINE';
const integer = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

export function cardioPreviewIssue(input: CardioPreviewInput): CardioPreviewIssue | null {
  if (!input || !Array.isArray(input.modalities) || !input.modalities.length || input.modalities.length > 3
    || new Set(input.modalities).size !== input.modalities.length || input.modalities.some(m => !CARDIO_MODALITIES.includes(m))) return 'MODALITIES';
  if (!validateCardioProfile(input.profile)) return 'PROFILE';
  if (input.healthBaseline !== undefined && (!validReviewedCardioStart(input.healthBaseline)
    || input.placementPolicy !== 'BALANCED_V2' || input.modalities.length !== 1 || input.modalities[0] !== input.healthBaseline.modality
    || input.cycleDays !== input.healthBaseline.cycleDays || input.sessions > input.healthBaseline.sessions)) return 'HEALTH_BASELINE';
  if (input.placementPolicy !== undefined && input.placementPolicy !== 'BALANCED_V2'
    || !integer(input.cycleDays, 7, 31) || !integer(input.sessions, input.modalities.length, 14)
    || !integer(input.cardioMinutes, 1, 1440) || !integer(input.sessionMinutes, 1, 600)
    || !integer(input.maxActiveDays, 1, input.cycleDays) || typeof input.allowDoubles !== 'boolean') return 'LIMITS';
  if (!Array.isArray(input.availableDays) || new Set(input.availableDays).size !== input.availableDays.length
    || input.availableDays.some(day => !integer(day, 0, input.cycleDays - 1))) return 'AVAILABILITY';
  if (!Array.isArray(input.strength) || input.strength.some(s => !s || typeof s.id !== 'string' || !s.id.trim()
    || typeof s.name !== 'string' || !s.name.trim() || !integer(s.dayIndex, 0, input.cycleDays - 1)
    || !Number.isFinite(s.estimatedMinutes) || s.estimatedMinutes < 0 || s.estimatedMinutes > 600
    || !['LOW', 'HIGH'].includes(s.lowerBodyDemand))
    || new Set(input.strength.map(s => s.id)).size !== input.strength.length) return 'STRENGTH_DAY';
  if (new Set(input.strength.map(s => s.dayIndex)).size !== input.strength.length) return 'STRENGTH_COLLISION';
  if (input.strength.length > input.maxActiveDays) return 'ACTIVE_DAYS';
  return null;
}

/** Relative draft only. The caller must review every strength placement. */
export function buildCardioPreview(input: CardioPreviewInput) {
  const issue = cardioPreviewIssue(input);
  if (issue) throw Error(issue);
  const plan = draftEasyCardioPlan({
    ...(input.placementPolicy ? { placementPolicy: input.placementPolicy } : {}),
    cycleDays: input.cycleDays, availableDays: [...input.availableDays], maxSessions: input.sessions,
    totalMinutes: input.cardioMinutes, maxSessionMinutes: input.sessionMinutes, maxActiveDays: input.maxActiveDays,
    allowDoubles: input.allowDoubles, goal: 'GENERAL_FITNESS', profile: input.profile,
    fixedStrength: input.strength.map(s => ({ id: s.id, dayIndex: s.dayIndex!, lowerBodyDemand: s.lowerBodyDemand,
      ...(input.placementPolicy ? { estimatedMinutes: s.estimatedMinutes } : {}) })),
  }, Array.from({ length: input.sessions }, (_, i) => {
    const modality = input.modalities[i % input.modalities.length];
    return { id: `easy-${String(i).padStart(2, '0')}-${modality.toLowerCase()}`, modality,
      durationMinutes: Math.min(input.sessionMinutes, input.healthBaseline?.sessionMinutes ?? input.sessionMinutes),
      candidateDays: [...input.availableDays], lowerBodyDemand: modality === 'CYCLING' ? 'LOW' as const : 'HIGH' as const };
  }));
  if (input.healthBaseline) plan.prescriptions = plan.prescriptions.map(p => ({ ...p, basis: 'REVIEWED_HISTORY' as const }));
  const demanding = [
    ...input.strength.filter(s => s.lowerBodyDemand === 'HIGH').map(s => ({ id: `strength:${s.id}`, day: s.dayIndex! })),
    ...plan.scheduled.filter(s => s.lowerBodyDemand === 'HIGH').map(s => ({ id: s.id, day: s.dayIndex })),
  ];
  const closeDemandingSessions = plan.scheduled.filter(s => s.lowerBodyDemand === 'HIGH').some(s => demanding.some(other => {
    const distance = Math.abs(s.dayIndex - other.day);
    return s.id !== other.id && Math.min(distance, input.cycleDays - distance) <= 1;
  }));
  return { ...plan, closeDemandingSessions, days: Array.from({ length: input.cycleDays }, (_, dayIndex) => ({
    dayIndex, strength: input.strength.filter(s => s.dayIndex === dayIndex).map(s => ({ ...s })),
    cardio: plan.scheduled.filter(s => s.dayIndex === dayIndex).map(s => ({ ...s })),
  })) };
}
export type CardioPreview = ReturnType<typeof buildCardioPreview>;

/** Reuses explicit relative rhythm only; absent scheduling metadata stays unplaced. */
export function strengthPlacements(routine: RoutineView, primaryOnly = false): { cycleDays?: number; sessions: CardioStrengthPlacement[] } {
  const sessions = routine.microcycles[routine.currentMicrocycleIndex]?.sessions ?? [];
  const source = routine.mesocycleSnapshot;
  let slots: ReturnType<typeof routineDays> | undefined;
  if (source && (source.restDays !== undefined || source.scheduleTemplate !== undefined)) {
    try { slots = routineDays(sessions.map(s => ({ index: s.plannedSessionIndex })), routineRestDays(source)); } catch { /* Invalid rhythm requires explicit placement. */ }
  }
  const lower = new Set(['QUADS', 'HAMSTRINGS', 'GLUTES', 'ADDUCTORS', 'CALVES', 'ERECTORS', 'UNCLASSIFIED']);
  return { ...(slots?.length ? { cycleDays: slots.length } : {}), sessions: sessions.map(s => {
    const day = slots?.findIndex(slot => slot.kind === 'workout' && slot.sessionIndex === s.plannedSessionIndex);
    return { id: `${routine.id}:${s.plannedSessionIndex}`, name: s.name,
      ...(day !== undefined && day >= 0 ? { dayIndex: day } : {}),
      estimatedMinutes: estimateSessionMinutes(s.exercises),
      lowerBodyDemand: !s.exercises.length || s.exercises.some(e => [e.primaryMuscle, ...(e.primaryMuscles ?? []), ...(primaryOnly ? [] : e.secondaryMuscles)].some(m => lower.has(m))) ? 'HIGH' as const : 'LOW' as const };
  }) };
}

/** Reviewable starting suggestion, not inferred fitness or a universal optimal dose. */
export function suggestCardioCapacity(input: CardioPreviewInput) {
  if (!input || !Array.isArray(input.modalities) || !input.modalities.length || input.modalities.length > 3
    || new Set(input.modalities).size !== input.modalities.length || input.modalities.some(m => !CARDIO_MODALITIES.includes(m))
    || !validateCardioProfile(input.profile) || !integer(input.cycleDays, 7, 31) || !Array.isArray(input.strength)
    || input.strength.length > input.cycleDays) throw Error('invalidCardioSuggestion');
  const regular = input.modalities.every(modality => input.profile.modalities[modality]?.status === 'REGULAR');
  if (input.healthBaseline) {
    if (!validReviewedCardioStart(input.healthBaseline) || input.cycleDays !== input.healthBaseline.cycleDays
      || input.modalities.length !== 1 || input.modalities[0] !== input.healthBaseline.modality) throw Error('invalidCardioSuggestion');
    return { sessions: input.healthBaseline.sessions, sessionMinutes: input.healthBaseline.maxSessionMinutes,
      cardioMinutes: input.healthBaseline.availableMinutes, maxActiveDays: Math.min(input.cycleDays, input.strength.length + input.healthBaseline.sessions) };
  }
  const frequency = input.modalities.map(modality => input.profile.modalities[modality]?.sessionsPerWeek);
  const knownWeekly = frequency.every(n => n !== undefined) ? frequency.reduce<number>((sum, n) => sum + n!, 0) : undefined;
  const weekly = regular && knownWeekly !== undefined && knownWeekly > 0 ? Math.min(3, knownWeekly) : 2;
  const sessions = Math.min(14, Math.max(input.modalities.length, Math.round(weekly * input.cycleDays / 7)));
  // Integer controls must not round a reported tolerance upward.
  const duration = (modality: CardioPlanningModality) => Math.floor(Math.min(regular ? 40 : 25, input.profile.modalities[modality]?.typicalSessionMinutes ?? 20));
  return { sessions, sessionMinutes: Math.max(...input.modalities.map(duration)),
    cardioMinutes: Array.from({ length: sessions }, (_, index) => duration(input.modalities[index % input.modalities.length])).reduce((a, b) => a + b, 0),
    maxActiveDays: Math.min(input.cycleDays, input.strength.length + sessions) };
}

