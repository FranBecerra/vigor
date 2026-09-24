/**
 * Configuración de internacionalización (PRD §8.6).
 *
 * Lee el idioma del SISTEMA con expo-localization y resuelve las traducciones
 * con i18next. Idiomas soportados: es, en, fr, ja (ampliable).
 *
 * Regla de código: NUNCA textos literales en las pantallas; siempre claves.
 *   const { t } = useTranslation();
 *   t('train.addSet')
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import { resolveLanguage, FALLBACK_LANGUAGE } from './resolveLanguage';

export {
  SUPPORTED_LANGUAGES,
  FALLBACK_LANGUAGE,
  resolveLanguage,
  type SupportedLanguage,
} from './resolveLanguage';

/** Idioma del sistema resuelto a uno de los soportados. */
export function getSystemLanguage() {
  return resolveLanguage(getLocales().map((l) => l.languageCode));
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    fr: { translation: fr },
    ja: { translation: ja },
  },
  lng: getSystemLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
});

export default i18n;
