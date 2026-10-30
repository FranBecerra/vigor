import { AppSettingsRepository, DEFAULT_APP_SETTINGS, normalizeDisplayName, validateAppSettings } from '../appSettings';
import { ACCENT_KEYS } from '@/theme/accent';
function setup(initial: string | null = null) {
  let text = initial; const storage = { read: jest.fn(async () => text), write: jest.fn(async (value: string) => { text = value; }) };
  return { storage, repo: new AppSettingsRepository(storage) };
}
it('persists a known accent per account with a backward-compatible lime fallback', async () => {
  const { repo, storage } = setup();
  expect((await repo.get('old')).accent).toBeUndefined();
  for (const accent of ACCENT_KEYS) {
    await repo.update('a', { accent }); expect((await new AppSettingsRepository(storage).get('a')).accent).toBe(accent);
  }
  expect((await repo.get('b')).accent).toBeUndefined();
  for (const accent of [null, '', 'constructor', '__proto__', '#123456', 4]) await expect(repo.update('a', { accent: accent as any })).rejects.toThrow('Invalid accent');
  expect((await repo.get('a')).accent).toBe('taupe');
});
it('normalizes visible names without reserving a handle and rejects invalid input', () => {
  expect(normalizeDisplayName('  Franci  Becerra  ')).toBe('Franci Becerra');
  expect(normalizeDisplayName('e\u0301')).toBe('é'); expect(normalizeDisplayName('🏋️')).toBe('🏋️');
  for (const name of ['', '   ', 'x\ny', 'x\ty', '\u0000', 'x'.repeat(41), null]) expect(() => normalizeDisplayName(name as any)).toThrow();
  expect(normalizeDisplayName('x'.repeat(40))).toHaveLength(40);
});
it('validates implemented settings only', () => {
  for (const value of [null, {}, { appearance: 'blue', language: 'system' }, { appearance: 'system', language: 'de' }]) expect(() => validateAppSettings(value)).toThrow();
  expect(validateAppSettings({ appearance: 'dark', language: 'ja' })).toEqual({ appearance: 'dark', language: 'ja' });
  expect(validateAppSettings({ ...DEFAULT_APP_SETTINGS, bioHealthEnabled: true }).bioHealthEnabled).toBe(true);
  expect(() => validateAppSettings({ ...DEFAULT_APP_SETTINGS, bioHealthEnabled: 1 })).toThrow('Invalid Bio connection');
  expect(validateAppSettings({ ...DEFAULT_APP_SETTINGS, bioNightEnabled: true }).bioNightEnabled).toBe(true);
  expect(() => validateAppSettings({ ...DEFAULT_APP_SETTINGS, bioNightEnabled: 1 })).toThrow('Invalid overnight connection');
});
it('persists overnight opt-in separately without silently enabling it for legacy Bio users', async () => {
  const { repo } = setup(); await repo.update('a', { bioHealthEnabled: true });
  expect((await repo.get('a')).bioNightEnabled).toBeUndefined();
  await repo.update('a', { bioNightEnabled: true });
  expect(await repo.get('a')).toMatchObject({ bioHealthEnabled: true, bioNightEnabled: true });
  expect((await repo.get('b')).bioNightEnabled).toBeUndefined();
  await repo.update('a', { bioNightEnabled: false }); expect((await repo.get('a')).bioNightEnabled).toBe(false);
});
it('persists an explicit sleep target by owner without inventing one for existing users', async () => {
  const { repo, storage } = setup();
  expect((await repo.get('a')).bioSleepGoalMinutes).toBeUndefined();
  for (const value of [null, '480', NaN, Infinity, 239, 721, 480.5]) {
    await expect(repo.update('a', { bioSleepGoalMinutes: value as any })).rejects.toThrow('Invalid sleep goal');
  }
  expect(storage.write).not.toHaveBeenCalled();
  await repo.update('a', { bioSleepGoalMinutes: 480 });
  expect((await new AppSettingsRepository(storage).get('a')).bioSleepGoalMinutes).toBe(480);
  expect((await repo.get('b')).bioSleepGoalMinutes).toBeUndefined();
  await repo.update('a', { bioSleepGoalMinutes: undefined }); expect((await repo.get('a')).bioSleepGoalMinutes).toBeUndefined();
});
it('isolates unit and wheel-step preferences by owner, retaining legacy metric defaults', async () => {
  const { repo, storage } = setup();
  await repo.update('a', { measurementSystem: 'imperial', weightIncrement: 0.5 });
  expect(await repo.get('a')).toMatchObject({ measurementSystem: 'imperial', weightIncrement: 0.5 });
  expect(await repo.get('b')).toEqual(DEFAULT_APP_SETTINGS);
  expect(await new AppSettingsRepository(storage).get('a')).toMatchObject({ measurementSystem: 'imperial', weightIncrement: 0.5 });
});
it('defaults to the system, persists per owner and merges rapid field edits without mutation', async () => {
  const { repo } = setup(); const initial = await repo.get('a'); expect(initial).toEqual(DEFAULT_APP_SETTINGS); initial.appearance = 'light';
  expect(await repo.get('a')).toEqual(DEFAULT_APP_SETTINGS);
  await Promise.all([repo.update('a', { appearance: 'dark' }), repo.update('a', { language: 'es' }), repo.update('b', { language: 'fr' })]);
  expect(await repo.get('a')).toEqual({ appearance: 'dark', language: 'es' });
  expect(await repo.get('b')).toEqual({ appearance: 'system', language: 'fr' });
  await repo.update('__proto__', { language: 'ja' }); expect((await repo.get('__proto__')).language).toBe('ja');
});
it('does not overwrite corrupt storage, and a rejection does not poison subsequent retries', async () => {
  for (const initial of ['{bad', 'null', '{}', '{"version":1,"owners":[]}', '{"version":1,"owners":{"":{}}}', '{"version":1,"owners":{"a":{"appearance":"bad","language":"en"}}}']) {
    const h = setup(initial); await expect(h.repo.get('a')).rejects.toThrow(); await expect(h.repo.update('a', {})).rejects.toThrow(); expect(h.storage.write).not.toHaveBeenCalled();
  }
  const h = setup(); await expect(h.repo.get('')).rejects.toThrow(); await expect(h.repo.update('', {})).rejects.toThrow();
  h.storage.write.mockRejectedValueOnce(Error('disk')); await expect(h.repo.update('a', { appearance: 'light' })).rejects.toThrow('disk');
  expect(await h.repo.get('a')).toEqual(DEFAULT_APP_SETTINGS); await h.repo.update('a', { appearance: 'light' }); expect((await h.repo.get('a')).appearance).toBe('light');
});
