import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './locales/es.json';

/**
 * The UI is built on translation keys from the start (NFR — Internationalization); only Spanish
 * is written for now. Adding a language means adding a locale file here, not touching components.
 */
export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  lng: 'es',
  fallbackLng: 'es',
  resources: { es: { translation: es } },
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false,
});

function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
}

syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', syncDocumentLanguage);
