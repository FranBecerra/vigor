import { ExperienceLevel } from '@/models/athlete';
import { cardioIntakeDefaults, shouldOfferFirstAccountIntake, strengthIntakeDefaults, validateAthleteIntake } from '../athleteIntake';
import { AppSettingsRepository, validateAppSettings } from '../appSettings';

const base = { version: 1 as const, status: 'COMPLETED' as const, updatedAt: 1000 };
const full = { ...base, goal: 'STRENGTH' as const, strengthExperience: ExperienceLevel.INTERMEDIATE,
  strengthSessionsPerWeek: 4, strengthMinutesPerSession: 75, cardio: { schemaVersion: 1 as const,
    modalities: { RUNNING: { status: 'NEW' as const, qualityExposure: 'UNKNOWN' as const, typicalSessionMinutes: 40, sessionsPerWeek: 2, consistentWeeks: 3, recentLongestRunKm: 5 },
      CYCLING: { status: 'REGULAR' as const, qualityExposure: 'CURRENTLY_TOLERATED' as const }, MACHINE: { status: 'UNSURE' as const, qualityExposure: 'UNKNOWN' as const } } } };

it('whitelists and detaches all declared defaults, preserving unknown versus zero frequency', () => {
  const snapshot = validateAthleteIntake({ ...full, privateNote: 'discard', cardio: { ...full.cardio, modalities: {
    ...full.cardio.modalities, RUNNING: { ...full.cardio.modalities.RUNNING, irrelevant: 'discard', sessionsPerWeek: 0 } } } });
  expect(snapshot).toEqual({ ...full, cardio: { ...full.cardio, modalities: { ...full.cardio.modalities, RUNNING: { ...full.cardio.modalities.RUNNING, sessionsPerWeek: 0 } } } });
  snapshot.cardio!.modalities.RUNNING!.typicalSessionMinutes = 1;
  expect(full.cardio.modalities.RUNNING.typicalSessionMinutes).toBe(40);
  expect(validateAthleteIntake(base)).toEqual(base);
  expect(validateAthleteIntake({ ...full, status: 'DEFERRED' })).toEqual({ ...base, status: 'DEFERRED' });
});
it.each([null, undefined, {}, [], { ...base, version: 2 }, { ...base, status: 'unknown' },
  ...[0, -1, NaN, Infinity, 1.5, 8640000000000001].map(updatedAt => ({ ...base, updatedAt })),
  { ...base, goal: 'weight-loss' }, { ...base, strengthExperience: 'EXPERT' },
  ...[0, 8, 1.5, '4'].map(strengthSessionsPerWeek => ({ ...base, strengthSessionsPerWeek })),
  ...[29, 121, 31, 30.5, NaN].map(strengthMinutesPerSession => ({ ...base, strengthMinutesPerSession })),
  { ...base, cardio: {} }, { ...base, cardio: { schemaVersion: 1, modalities: { RUNNING: null } } },
])('rejects invalid restored intake %j without normalizing it into a fitness level', value => {
  expect(() => validateAthleteIntake(value)).toThrow('Invalid athlete intake');
});
it('offers welcome only for a genuinely recent account, never merely because an existing profile is missing', () => {
  const now = Date.UTC(2026, 9, 30, 12), created = new Date(now - 600_000).toISOString();
  expect(shouldOfferFirstAccountIntake(created, now)).toBe(true);
  expect(shouldOfferFirstAccountIntake(created, now + 1)).toBe(false);
  expect(shouldOfferFirstAccountIntake(new Date(now + 1).toISOString(), now)).toBe(false);
  expect(shouldOfferFirstAccountIntake(undefined, now)).toBe(false);
  expect(shouldOfferFirstAccountIntake('not-a-date', now)).toBe(false);
  expect(shouldOfferFirstAccountIntake(created, now, base)).toBe(false);
  expect(shouldOfferFirstAccountIntake(created, now, { ...base, status: 'DEFERRED' })).toBe(false);
});
it('keeps weekly strength defaults separate from unknown cardio capacity and hybrid priorities', () => {
  expect(strengthIntakeDefaults()).toEqual({});
  expect(strengthIntakeDefaults({ ...base, status: 'DEFERRED' })).toEqual({});
  expect(strengthIntakeDefaults(base)).toEqual({});
  expect(strengthIntakeDefaults(full)).toEqual({ goal: 'STRENGTH', level: 'INTERMEDIATE', sessions: 4, minutes: 75 });
  expect(strengthIntakeDefaults({ ...base, goal: 'HYPERTROPHY' })).toEqual({ goal: 'HYPERTROPHY' });
  expect(strengthIntakeDefaults({ ...base, goal: 'HYBRID' })).toEqual({});
  expect(strengthIntakeDefaults({ ...base, goal: 'CARDIO' })).toEqual({});
  expect(cardioIntakeDefaults()).toEqual({ modalities: [], profile: { schemaVersion: 1, modalities: {} } });
  expect(cardioIntakeDefaults(base).modalities).toEqual([]);
  expect(cardioIntakeDefaults(full)).toEqual({ modalities: ['RUNNING', 'CYCLING', 'MACHINE'], profile: full.cardio });
  const defaults = cardioIntakeDefaults(full); defaults.profile.modalities.RUNNING!.typicalSessionMinutes = 20;
  expect(full.cardio.modalities.RUNNING.typicalSessionMinutes).toBe(40);
});
it('persists by owner through the existing serialized local settings store without touching other preferences', async () => {
  let stored: string | null = null;
  const repo = new AppSettingsRepository({ read: async () => stored, write: async text => { stored = text; } });
  await repo.update('a', { athleteIntake: full });
  await Promise.all([repo.update('a', { accent: 'sky' }), repo.update('b', { athleteIntake: { ...base, status: 'DEFERRED' } })]);
  expect(await repo.get('a')).toMatchObject({ accent: 'sky', athleteIntake: full });
  expect((await repo.get('b')).athleteIntake?.status).toBe('DEFERRED');
  expect((await repo.get('new')).athleteIntake).toBeUndefined();
  expect(validateAppSettings({ appearance: 'system', language: 'system' }).athleteIntake).toBeUndefined();
  expect(() => validateAppSettings({ appearance: 'system', language: 'system', athleteIntake: null })).toThrow();
  const broken = new AppSettingsRepository({ read: async () => stored, write: async () => { throw Error('disk'); } });
  await expect(broken.update('a', { athleteIntake: base })).rejects.toThrow('disk');
  expect((await repo.get('a')).athleteIntake).toEqual(full);
});
