import type {
  CardioConstraintPlan,
  CardioModalityProfile,
  CardioPlanCandidate,
  CardioPlanOmission,
  CardioPlanningConstraints,
  CardioPlanningModality,
  CardioStrengthAnchor,
} from '@/models/cardio';

const modalities: CardioPlanningModality[] = ['RUNNING', 'CYCLING', 'MACHINE'];
const statuses = ['NEW', 'RETURNING', 'REGULAR', 'UNSURE'];
const qualityExposure = ['CURRENTLY_TOLERATED', 'NOT_TOLERATED', 'UNKNOWN'];

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function optionalNumber(value: unknown, min: number, max: number): boolean {
  return value === undefined || typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** Reject malformed draft data; this profile is deliberately not persisted by this slice. */
export function validateCardioProfile(value: unknown): value is {
  schemaVersion: 1;
  modalities: Partial<Record<CardioPlanningModality, CardioModalityProfile>>;
} {
  if (!value || typeof value !== 'object') return false;
  const profile = value as { schemaVersion?: unknown; modalities?: unknown };
  if (profile.schemaVersion !== 1 || !profile.modalities || typeof profile.modalities !== 'object' || Array.isArray(profile.modalities)) return false;
  const entries = Object.entries(profile.modalities as Record<string, unknown>);
  return entries.every(([modality, raw]) => {
    if (!modalities.includes(modality as CardioPlanningModality) || !raw || typeof raw !== 'object') return false;
    const item = raw as Record<string, unknown>;
    if (!statuses.includes(String(item.status)) || !qualityExposure.includes(String(item.qualityExposure))) return false;
    if (!optionalNumber(item.consistentWeeks, 0, 520)
      || !optionalNumber(item.sessionsPerWeek, 0, 14)
      || !optionalNumber(item.typicalSessionMinutes, 1, 600)
      || !optionalNumber(item.recentLongestRunKm, 0.01, 300)) return false;
    return modality === 'RUNNING' || item.recentLongestRunKm === undefined;
  });
}

function validateConstraints(input: CardioPlanningConstraints): void {
  if (!isIntegerInRange(input.cycleDays, 1, 31)
    || !isIntegerInRange(input.maxSessions, 0, 31)
    || !isIntegerInRange(input.maxActiveDays, 0, input.cycleDays)
    || !Number.isFinite(input.totalMinutes) || input.totalMinutes < 0
    || !Number.isFinite(input.maxSessionMinutes) || input.maxSessionMinutes < 0
    || !['GENERAL_FITNESS', 'AEROBIC_BASE', 'VO2_FITNESS'].includes(input.goal)
    || !Array.isArray(input.availableDays) || !Array.isArray(input.candidates) || !Array.isArray(input.fixedStrength)
    || typeof input.allowDoubles !== 'boolean' || !validateCardioProfile(input.profile)) {
    throw new Error('invalidCardioPlanningConstraints');
  }
  const validDay = (day: unknown) => isIntegerInRange(day, 0, input.cycleDays - 1);
  if (input.availableDays.some(day => !validDay(day)) || new Set(input.availableDays).size !== input.availableDays.length) {
    throw new Error('invalidCardioAvailabilityDays');
  }
  if (input.candidates.some(candidate => !validCandidate(candidate, input.cycleDays))
    || new Set(input.candidates.map(candidate => candidate.id)).size !== input.candidates.length) {
    throw new Error('invalidCardioCandidates');
  }
  if (input.fixedStrength.some(anchor => !validStrengthAnchor(anchor, input.cycleDays))) {
    throw new Error('invalidCardioStrengthAnchors');
  }
}

function validCandidate(candidate: CardioPlanCandidate, cycleDays: number): boolean {
  return !!candidate && typeof candidate.id === 'string' && candidate.id.trim().length > 0
    && modalities.includes(candidate.modality)
    && ['EASY', 'QUALITY'].includes(candidate.stimulus)
    && Number.isFinite(candidate.durationMinutes) && candidate.durationMinutes > 0
    && Array.isArray(candidate.candidateDays) && candidate.candidateDays.every(day => isIntegerInRange(day, 0, cycleDays - 1))
    && new Set(candidate.candidateDays).size === candidate.candidateDays.length
    && ['LOW', 'HIGH'].includes(candidate.lowerBodyDemand);
}

function validStrengthAnchor(anchor: CardioStrengthAnchor, cycleDays: number): boolean {
  return !!anchor && typeof anchor.id === 'string' && anchor.id.trim().length > 0
    && isIntegerInRange(anchor.dayIndex, 0, cycleDays - 1)
    && ['LOW', 'HIGH'].includes(anchor.lowerBodyDemand);
}

function candidateOrder(a: CardioPlanCandidate, b: CardioPlanCandidate, goal: CardioPlanningConstraints['goal']): number {
  const preferred = goal === 'VO2_FITNESS' ? 'QUALITY' : 'EASY';
  const priorityA = a.stimulus === preferred ? 0 : 1;
  const priorityB = b.stimulus === preferred ? 0 : 1;
  return priorityA - priorityB || a.id.localeCompare(b.id);
}

function qualityOmission(candidate: CardioPlanCandidate, input: CardioPlanningConstraints): CardioPlanOmission['reason'] | undefined {
  if (candidate.stimulus !== 'QUALITY') return undefined;
  const exposure = input.profile.modalities[candidate.modality]?.qualityExposure;
  if (exposure === 'CURRENTLY_TOLERATED') return undefined;
  return exposure === 'NOT_TOLERATED' ? 'QUALITY_NOT_TOLERATED' : 'QUALITY_EXPOSURE_UNKNOWN';
}

function circularDistance(a: number, b: number, cycleDays: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, cycleDays - direct);
}

function dayOverlap(candidate: CardioPlanCandidate, day: number, anchors: CardioStrengthAnchor[], cycleDays: number): 'NONE' | 'SAME_DAY' | 'ADJACENT_DAY' {
  if (candidate.lowerBodyDemand !== 'HIGH') return 'NONE';
  if (anchors.some(anchor => anchor.dayIndex === day && anchor.lowerBodyDemand === 'HIGH')) return 'SAME_DAY';
  if (anchors.some(anchor => anchor.lowerBodyDemand === 'HIGH' && circularDistance(anchor.dayIndex, day, cycleDays) === 1)) return 'ADJACENT_DAY';
  return 'NONE';
}

function dayCost(candidate: CardioPlanCandidate, day: number, input: CardioPlanningConstraints,
  assigned: Array<{ candidate: CardioPlanCandidate; dayIndex: number }>): number {
  let cost = 0;
  const fixedSame = input.fixedStrength.some(anchor => anchor.dayIndex === day);
  const cardioSame = assigned.some(item => item.dayIndex === day);
  if (!input.allowDoubles && (fixedSame || cardioSame)) return Number.POSITIVE_INFINITY;
  if (candidate.lowerBodyDemand === 'HIGH') {
    if (dayOverlap(candidate, day, input.fixedStrength, input.cycleDays) === 'SAME_DAY') cost += 100;
    else if (dayOverlap(candidate, day, input.fixedStrength, input.cycleDays) === 'ADJACENT_DAY') cost += 40;
    for (const item of assigned) {
      if (item.candidate.lowerBodyDemand !== 'HIGH') continue;
      const distance = circularDistance(item.dayIndex, day, input.cycleDays);
      if (distance === 0) cost += 100;
      else if (distance === 1) cost += 40;
    }
  }
  if (fixedSame || cardioSame) cost += 10;
  return cost;
}

/**
 * Assigns already-authored session proposals to relative days under declared caps.
 * It does not create workout prescriptions, infer tolerance, or claim time-of-day separation.
 */
export function scheduleCardioCandidates(input: CardioPlanningConstraints): CardioConstraintPlan {
  validateConstraints(input);
  const assigned: Array<{ candidate: CardioPlanCandidate; dayIndex: number }> = [];
  const omitted: CardioPlanOmission[] = [];
  let usedMinutes = 0;
  const existingStrengthDays = new Set(input.fixedStrength.map(anchor => anchor.dayIndex));

  for (const candidate of [...input.candidates].sort((a, b) => candidateOrder(a, b, input.goal))) {
    const qualityReason = qualityOmission(candidate, input);
    if (qualityReason) {
      omitted.push({ candidateId: candidate.id, reason: qualityReason });
      continue;
    }
    if (assigned.length >= input.maxSessions) {
      omitted.push({ candidateId: candidate.id, reason: 'SESSION_CAP' });
      continue;
    }
    if (candidate.durationMinutes > input.maxSessionMinutes || usedMinutes + candidate.durationMinutes > input.totalMinutes) {
      omitted.push({ candidateId: candidate.id, reason: 'TIME_CAP' });
      continue;
    }

    const allowedDays = candidate.candidateDays.filter(day => input.availableDays.includes(day));
    const choices = allowedDays.map(day => {
      const addsActiveDay = !existingStrengthDays.has(day) && !assigned.some(item => item.dayIndex === day);
      const currentActiveDays = new Set([...existingStrengthDays, ...assigned.map(item => item.dayIndex)]).size;
      if (addsActiveDay && currentActiveDays >= input.maxActiveDays) return { day, cost: Number.POSITIVE_INFINITY };
      return { day, cost: dayCost(candidate, day, input, assigned) };
    }).filter(choice => Number.isFinite(choice.cost)).sort((a, b) => a.cost - b.cost || a.day - b.day);

    if (!choices.length) {
      omitted.push({ candidateId: candidate.id, reason: 'NO_AVAILABLE_DAY' });
      continue;
    }
    assigned.push({ candidate, dayIndex: choices[0].day });
    usedMinutes += candidate.durationMinutes;
  }

  const scheduled = assigned.map(({ candidate, dayIndex }) => ({
    ...candidate,
    candidateDays: [...candidate.candidateDays],
    dayIndex,
    overlap: dayOverlap(candidate, dayIndex, input.fixedStrength, input.cycleDays),
  })).sort((a, b) => a.dayIndex - b.dayIndex || a.id.localeCompare(b.id));
  const activeDays = [...new Set([...existingStrengthDays, ...assigned.map(item => item.dayIndex)])].sort((a, b) => a - b);
  return { scheduled, omitted, usedMinutes, activeDays };
}
