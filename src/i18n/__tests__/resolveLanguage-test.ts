import { resolveLanguage, FALLBACK_LANGUAGE } from '@/i18n/resolveLanguage';

describe('resolveLanguage', () => {
  test('idioma soportado directo', () => {
    expect(resolveLanguage(['es'])).toBe('es');
    expect(resolveLanguage(['ja'])).toBe('ja');
  });

  test('respeta el orden de preferencia del usuario', () => {
    expect(resolveLanguage(['fr', 'es'])).toBe('fr');
    expect(resolveLanguage(['de', 'es'])).toBe('es');
  });

  test('idioma no soportado → fallback', () => {
    expect(resolveLanguage(['de'])).toBe(FALLBACK_LANGUAGE);
  });

  test('lista vacía → fallback', () => {
    expect(resolveLanguage([])).toBe(FALLBACK_LANGUAGE);
  });

  test('ignora null y undefined', () => {
    expect(resolveLanguage([null, undefined, 'fr'])).toBe('fr');
    expect(resolveLanguage([null, undefined])).toBe(FALLBACK_LANGUAGE);
  });
});
