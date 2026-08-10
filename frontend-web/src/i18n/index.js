import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import fr from './locales/fr.json'
import en from './locales/en.json'
import es from './locales/es.json'
import sw from './locales/sw.json'
import zh from './locales/zh.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français', countryCode: 'FR' },
  { code: 'en', label: 'English', countryCode: 'GB' },
  { code: 'es', label: 'Español', countryCode: 'ES' },
  { code: 'sw', label: 'Kiswahili', countryCode: 'TZ' },
  { code: 'zh', label: '中文', countryCode: 'CN' },
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      es: { translation: es },
      sw: { translation: sw },
      zh: { translation: zh },
    },
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'bomavibes_lang',
    },
  })

export default i18n
