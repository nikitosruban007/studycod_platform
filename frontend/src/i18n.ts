import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ukTranslations from './locales/uk';
import enTranslations from './locales/en';

const STORAGE_KEY = 'studycod_language';

const savedLanguage = (() => {
  if (typeof window === 'undefined') return 'uk';
  const saved = localStorage.getItem(STORAGE_KEY);
  return (saved === 'en' || saved === 'uk') ? saved : 'uk';
})();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      uk: { translation: ukTranslations },
      en: { translation: enTranslations },
    },
    lng: savedLanguage,
    // Important: do NOT fall back from EN -> UK, otherwise UI becomes mixed-language.
    // If a key is missing in EN, it should stay missing (or show key), so we can detect it and translate properly.
    fallbackLng: {
      en: ['en'],
      uk: ['uk'],
      default: ['uk'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lng);
  }
});

/**
 * Simple helper for places where we still have inline UA/EN strings.
 * Prefer `t()` keys for full i18n coverage, but this is useful for incremental migration.
 */
export function tr(uk: string, en: string): string {
  const lng = (i18n.language || 'uk').toLowerCase();
  return lng.startsWith('en') ? en : uk;
}

export default i18n;

