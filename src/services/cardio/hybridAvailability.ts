import type { ExperienceLevel } from '@/models';
import type { CardioPreviewInput } from './cardioPreview';
import type { HybridPriority, HybridSettings } from './hybridAuthoring';

/** New-draft availability, never a reinterpretation of a saved legacy cycle budget. */
export interface HybridAvailability {
  cycleDays: number;
  trainingDays: number;
  minutesPerSession: number;
  allowDoubles: boolean;
}
const integer = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
export function validHybridAvailability(value: unknown): value is HybridAvailability {
  if (!value || typeof value !== 'object') return false;
  const a = value as HybridAvailability;
  return integer(a.cycleDays, 7, 31) && integer(a.trainingDays, a.allowDoubles ? 2 : 3, a.cycleDays)
    && integer(a.minutesPerSession, 30, 180) && typeof a.allowDoubles === 'boolean';
}
export function availabilityHybridSettings(a: HybridAvailability, priority: HybridPriority): HybridSettings {
  if (!validHybridAvailability(a)) throw Error('invalidHybridAvailability');
  // Keep the legacy storage ceiling. The current bounded roster cannot consume 10,000 minutes.
  return { priority, maxSessionMinutes: a.minutesPerSession,
    totalMinutesPerCycle: Math.min(10000, a.trainingDays * a.minutesPerSession * (a.allowDoubles ? 2 : 1)) };
}

/** Editable starter frequencies per cycle. Priority resolves competition for days. */
export function strengthHybridTarget(level?: ExperienceLevel) {
  return level === 'BEGINNER' ? 2 : level === 'ADVANCED' ? 4 : 3;
}

export function suggestHybridFrequency(a: HybridAvailability, priority: HybridPriority, strengthPerWeek = 4) {
  if (!validHybridAvailability(a)) throw Error('invalidHybridAvailability');
  const strengthTarget = Math.min(7, Math.floor(strengthPerWeek * a.cycleDays / 7), a.trainingDays);
  const cardioTarget = Math.min(14, Math.round(2 * a.cycleDays / 7), a.trainingDays);
  let best = { strength: 2, cardio: 1 };
  let bestRank = -Infinity;
  for (let strength = 2; strength <= strengthTarget; strength++) {
    const cardio = Math.min(cardioTarget, a.allowDoubles ? a.trainingDays : a.trainingDays - strength);
    if (cardio < 1) continue;
    const s = strength / strengthTarget, c = cardio / cardioTarget;
    // Balanced protects the less-covered discipline first; then maximize total coverage.
    const rank = priority === 'BALANCED' ? Math.min(s, c) : priority === 'STRENGTH' ? s : c;
    const bestS = best.strength / strengthTarget, bestC = best.cardio / cardioTarget;
    if (rank > bestRank || (rank === bestRank && s + c > bestS + bestC)) {
      bestRank = rank;
      best = { strength, cardio };
    }
  }
  return best;
}

/** Apply the one shared ceiling without changing requested cardio frequency or strength dose. */
export function withHybridAvailability(input: CardioPreviewInput, a: HybridAvailability): CardioPreviewInput {
  if (!validHybridAvailability(a)) throw Error('invalidHybridAvailability');
  const sessionMinutes = Math.min(input.sessionMinutes, a.minutesPerSession);
  return { ...input, doublePolicy: 'STRENGTH_CARDIO_ONLY_V1', cycleDays: a.cycleDays, maxActiveDays: a.trainingDays, allowDoubles: a.allowDoubles,
    availableDays: Array.from({ length: a.cycleDays }, (_, day) => day), sessionMinutes,
    // Existing cardio storage supports at most 1,440 minutes/cycle; any omission stays visible.
    cardioMinutes: Math.min(1440, input.sessions * sessionMinutes),
    strength: input.strength.map(s => s.dayIndex !== undefined && s.dayIndex >= a.cycleDays ? { ...s, dayIndex: undefined } : s) };
}
