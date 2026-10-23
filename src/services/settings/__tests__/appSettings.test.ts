import { AppSettingsRepository, DEFAULT_APP_SETTINGS, normalizeDisplayName, validateAppSettings } from '../appSettings';
function setup(initial: string | null = null) {
  let text = initial; const storage = { read: jest.fn(async () => text), write: jest.fn(async (value: string) => { text = value; }) };
  return { storage, repo: new AppSettingsRepository(storage) };
}
it('normalizes visible names without reserving a handle and rejects invalid input', () => {
  expect(normalizeDisplayName('  Franci  Becerra  ')).toBe('Franci Becerra');
  expect(normalizeDisplayName('e\u0301')).toBe('é'); expect(normalizeDisplayName('🏋️')).toBe('🏋️');
  for (const name of ['', '   ', 'x\ny', 'x\ty', '\u0000', 'x'.repeat(41), null]) expect(() => normalizeDisplayName(name as any)).toThrow();
  expect(normalizeDisplayName('x'.repeat(40))).toHaveLength(40);
});
it('validates implemented settings only', () => {
  for (const value of [null, {}, { appearance: 'blue', language: 'system' }, { appearance: 'system', language: 'de' }]) expect(() => validateAppSettings(value)).toThrow();
  expect(validateAppSettings({ appearance: 'dark', language: 'ja' })).toEqual({ appearance: 'dark', language: 'ja' });
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
