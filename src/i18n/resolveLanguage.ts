/**
 * Resolución del idioma de la app (PRD §8.6).
 * Módulo SIN efectos secundarios para poder testearlo aislado de i18next.
 */

export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Idioma de respaldo cuando el del sistema no está soportado. */
export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

/**
 * Devuelve el primer idioma soportado según el orden de preferencia del
 * usuario, o el fallback si ninguno coincide.
 */
export function resolveLanguage(
  languageCodes: readonly (string | null | undefined)[],
): SupportedLanguage {
  for (const code of languageCodes) {
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as SupportedLanguage;
    }
  }
  return FALLBACK_LANGUAGE;
}
