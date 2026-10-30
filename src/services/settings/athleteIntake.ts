import { ExperienceLevel } from '@/models/athlete';
import type { CardioProfile } from '@/models/cardio';
import { validateCardioProfile } from '@/services/cardio/cardioPlanner';

export const INTAKE_GOALS = ['HYPERTROPHY', 'STRENGTH', 'CARDIO', 'HYBRID'] as const;
export type IntakeGoal = typeof INTAKE_GOALS[number];
/** Declared planning defaults, not a fitness assessment or automatic prescription. */
export interface AthleteIntake {
  version: 1;
  status: 'COMPLETED' | 'DEFERRED';
  updatedAt: number;
  goal?: IntakeGoal;
  strengthExperience?: ExperienceLevel;
  strengthSessionsPerWeek?: number;
  strengthMinutesPerSession?: number;
  cardio?: CardioProfile;
}
const integer = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
/** Whitelist and detach every field. Unknown responses remain absent. */
export function validateAthleteIntake(value: unknown): AthleteIntake {
  const v = value as AthleteIntake;
  if (!v || v.version !== 1 || !['COMPLETED', 'DEFERRED'].includes(v.status) || !integer(v.updatedAt, 1, 8640000000000000)
    || v.goal !== undefined && !INTAKE_GOALS.includes(v.goal)
    || v.strengthExperience !== undefined && !Object.values(ExperienceLevel).includes(v.strengthExperience)
    || v.strengthSessionsPerWeek !== undefined && !integer(v.strengthSessionsPerWeek, 1, 7)
    || v.strengthMinutesPerSession !== undefined && (!integer(v.strengthMinutesPerSession, 30, 120) || v.strengthMinutesPerSession % 5 !== 0)
    || v.cardio !== undefined && !validateCardioProfile(v.cardio)) throw Error('Invalid athlete intake');
  if (v.status === 'DEFERRED') return { version: 1, status: 'DEFERRED', updatedAt: v.updatedAt };
  const cardio: CardioProfile = { schemaVersion: 1, modalities: {} };
  for (const modality of ['RUNNING', 'CYCLING', 'MACHINE'] as const) {
    const entry = v.cardio?.modalities[modality];
    if (entry) cardio.modalities[modality] = { status: entry.status, qualityExposure: entry.qualityExposure,
      ...(entry.consistentWeeks === undefined ? {} : { consistentWeeks: entry.consistentWeeks }),
      ...(entry.sessionsPerWeek === undefined ? {} : { sessionsPerWeek: entry.sessionsPerWeek }),
      ...(entry.typicalSessionMinutes === undefined ? {} : { typicalSessionMinutes: entry.typicalSessionMinutes }),
      ...(entry.recentLongestRunKm === undefined ? {} : { recentLongestRunKm: entry.recentLongestRunKm }) };
  }
  return { version: 1, status: v.status, updatedAt: v.updatedAt,
    ...(v.goal === undefined ? {} : { goal: v.goal }),
    ...(v.strengthExperience === undefined ? {} : { strengthExperience: v.strengthExperience }),
    ...(v.strengthSessionsPerWeek === undefined ? {} : { strengthSessionsPerWeek: v.strengthSessionsPerWeek }),
    ...(v.strengthMinutesPerSession === undefined ? {} : { strengthMinutesPerSession: v.strengthMinutesPerSession }),
    ...(v.cardio === undefined ? {} : { cardio }) };
}

/** Returning accounts are never interrupted by a migration prompt or a restored route. */
export function shouldOfferFirstAccountIntake(createdAt: string | undefined, now: number, intake?: AthleteIntake): boolean {
  const created = Date.parse(createdAt ?? '');
  return !intake && Number.isFinite(created) && created <= now && now - created <= 10 * 60_000;
}

export function strengthIntakeDefaults(intake?: AthleteIntake) {
  if (!intake || intake.status !== 'COMPLETED') return {};
  return { ...(intake.goal === 'STRENGTH' || intake.goal === 'HYPERTROPHY' ? { goal: intake.goal } : {}),
    ...(intake.strengthExperience === undefined ? {} : { level: intake.strengthExperience }),
    ...(intake.strengthSessionsPerWeek === undefined ? {} : { sessions: intake.strengthSessionsPerWeek }),
    ...(intake.strengthMinutesPerSession === undefined ? {} : { minutes: intake.strengthMinutesPerSession }) };
}

export function cardioIntakeDefaults(intake?: AthleteIntake): { modalities: Array<'RUNNING' | 'CYCLING' | 'MACHINE'>; profile: CardioProfile } {
  const safe = intake?.status === 'COMPLETED' ? validateAthleteIntake(intake).cardio : undefined;
  return { modalities: (['RUNNING', 'CYCLING', 'MACHINE'] as const).filter(m => safe?.modalities[m] !== undefined),
    profile: safe ?? { schemaVersion: 1, modalities: {} } };
}
