import type { CardioConstraintPlan, CardioPlanningModality, ManualCardioPrescription } from '@/models/cardio';
import type { CardioPreviewInput } from './cardioPreview';

export const MANUAL_PHASES = ['WARMUP', 'MAIN', 'COOLDOWN'] as const;
export type ManualPhase = typeof MANUAL_PHASES[number];

export interface ManualCardioTargets {
  durationSeconds?: number;
  distanceMetres?: number;
  paceSecondsPerKm?: { fast: number; slow: number };
  heartRateZone?: number;
}

export interface ManualCardioSession {
  modality: CardioPlanningModality;
  dayIndex: number;
  phases: Partial<Record<ManualPhase, ManualCardioTargets>>;
  estimatedMinutes?: number;
}

const whole = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const only = (value: unknown, keys: readonly string[]): boolean =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));

export function validManualTargets(value: unknown, modality: CardioPlanningModality): value is ManualCardioTargets {
  if (!only(value, ['durationSeconds', 'distanceMetres', 'paceSecondsPerKm', 'heartRateZone'])) return false;
  const { durationSeconds, distanceMetres, paceSecondsPerKm, heartRateZone } = value as ManualCardioTargets;
  return (durationSeconds !== undefined || distanceMetres !== undefined || paceSecondsPerKm !== undefined || heartRateZone !== undefined)
    && (durationSeconds === undefined || whole(durationSeconds, 1, 36000))
    && (distanceMetres === undefined || modality !== 'MACHINE' && whole(distanceMetres, 1, 1000000))
    && (paceSecondsPerKm === undefined || modality === 'RUNNING' && only(paceSecondsPerKm, ['fast', 'slow'])
      && whole(paceSecondsPerKm.fast, 1, 3599) && whole(paceSecondsPerKm.slow, paceSecondsPerKm.fast, 3599))
    && (heartRateZone === undefined || whole(heartRateZone, 1, 5));
}

function targetSeconds(target: ManualCardioTargets) {
  if (target.durationSeconds !== undefined) return target.durationSeconds;
  if (target.distanceMetres !== undefined && target.paceSecondsPerKm !== undefined) {
    return Math.ceil(target.distanceMetres / 1000 * target.paceSecondsPerKm.slow);
  }
  return null;
}

export function manualScheduledMinutes(session: ManualCardioSession): number | null {
  const seconds = MANUAL_PHASES.flatMap(phase => session.phases[phase] ? [targetSeconds(session.phases[phase]!)] : []);
  const known = Math.ceil(seconds.reduce<number>((sum, value) => sum + (value ?? 0), 0) / 60);
  return session.estimatedMinutes !== undefined ? Math.max(known, session.estimatedMinutes)
    : seconds.includes(null) ? null : known;
}

export function validManualSession(value: unknown, cycleDays: number): value is ManualCardioSession {
  if (!only(value, ['modality', 'dayIndex', 'phases', 'estimatedMinutes'])) return false;
  const s = value as ManualCardioSession;
  return ['RUNNING', 'CYCLING', 'MACHINE'].includes(s.modality) && whole(s.dayIndex, 0, cycleDays - 1)
    && (s.estimatedMinutes === undefined || whole(s.estimatedMinutes, 1, 600))
    && only(s.phases, MANUAL_PHASES) && validManualTargets(s.phases.MAIN, s.modality)
    && Object.values(s.phases).every(target => validManualTargets(target, s.modality))
    && manualScheduledMinutes({ ...s, estimatedMinutes: s.estimatedMinutes ?? 1 })! <= 600;
}

export function copyManualTargets(target: ManualCardioTargets): ManualCardioTargets {
  return { ...target, ...(target.paceSecondsPerKm ? { paceSecondsPerKm: { ...target.paceSecondsPerKm } } : {}) };
}

export function manualPrescription(session: ManualCardioSession, id: string): ManualCardioPrescription {
  return { schemaVersion: 1, policy: 'MANUAL_PHASES_V1', id, modality: session.modality,
    durationSeconds: (manualScheduledMinutes(session) ?? 0) * 60,
    segments: MANUAL_PHASES.flatMap(phase => session.phases[phase] ? [{ phase, targets: copyManualTargets(session.phases[phase]!) }] : []) };
}

export function validManualPrescription(value: ManualCardioPrescription): boolean {
  if (!only(value, ['schemaVersion', 'policy', 'id', 'modality', 'durationSeconds', 'segments'])
    || value.schemaVersion !== 1 || !['RUNNING', 'CYCLING', 'MACHINE'].includes(value.modality)
    || !whole(value.durationSeconds, 0, 36000) || !Array.isArray(value.segments) || !value.segments.length || value.segments.length > 3) return false;
  return Array.from(value.segments).every((segment, index) => only(segment, ['phase', 'targets'])
    && MANUAL_PHASES.includes(segment.phase)
    && (index === 0 || MANUAL_PHASES.indexOf(segment.phase) > MANUAL_PHASES.indexOf(value.segments[index - 1].phase))
    && validManualTargets(segment.targets, value.modality))
    && value.segments.some(segment => segment.phase === 'MAIN');
}

export function manualCardioFits(input: CardioPreviewInput): boolean {
  const sessions = input.manualSessions;
  if (!Array.isArray(sessions) || sessions.length !== input.sessions || !Array.from(sessions).every(s => validManualSession(s, input.cycleDays))
    || input.placementPolicy !== 'BALANCED_V2' || input.healthBaseline !== undefined || input.spacingPolicy !== undefined
    || input.modalities.some(m => !sessions.some(s => s.modality === m)) || sessions.some(s => !input.modalities.includes(s.modality))
    || new Set(sessions.map(s => s.dayIndex)).size !== sessions.length) return false;
  const strengthDays = input.strength.map(s => s.dayIndex!);
  const days = [...strengthDays, ...sessions.map(s => s.dayIndex)];
  if (days.some(d => !input.availableDays.includes(d)) || new Set(days).size > input.maxActiveDays
    || !input.allowDoubles && new Set(days).size !== days.length) return false;
  const minutes = sessions.map(manualScheduledMinutes);
  return minutes.every(m => m === null ? strengthDays.length === 0 : m <= input.sessionMinutes)
    && minutes.reduce<number>((sum, m) => sum + (m ?? 0), 0) <= input.cardioMinutes;
}

export function buildManualCardioPlan(input: CardioPreviewInput) {
  const sessions = [...input.manualSessions!].sort((a, b) => a.dayIndex - b.dayIndex);
  const scheduled: Array<Omit<CardioConstraintPlan['scheduled'][number], 'stimulus'> & { stimulus: 'MANUAL' }> = sessions.map((s, index) => {
    const id = `manual-${index}`;
    const adjacent = input.strength.some(p => p.lowerBodyDemand === 'HIGH'
      && Math.min(Math.abs(p.dayIndex! - s.dayIndex), input.cycleDays - Math.abs(p.dayIndex! - s.dayIndex)) === 1);
    const sameDay = input.strength.some(p => p.lowerBodyDemand === 'HIGH' && p.dayIndex === s.dayIndex);
    return { id, modality: s.modality, stimulus: 'MANUAL', durationMinutes: manualScheduledMinutes(s) ?? 0, candidateDays: [s.dayIndex],
      dayIndex: s.dayIndex, lowerBodyDemand: 'HIGH', overlap: sameDay ? 'SAME_DAY' : adjacent ? 'ADJACENT_DAY' : 'NONE' };
  });
  return { scheduled, omitted: [] as CardioConstraintPlan['omitted'],
    usedMinutes: scheduled.reduce((sum, s) => sum + s.durationMinutes, 0),
    activeDays: [...new Set([...input.strength.map(s => s.dayIndex!), ...scheduled.map(s => s.dayIndex)])].sort((a, b) => a - b),
    prescriptions: sessions.map((s, i) => manualPrescription(s, scheduled[i].id)) };
}
