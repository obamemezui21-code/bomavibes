import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n/index.js'
import FlagIcon from './FlagIcon.jsx'

function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex flex-wrap gap-2">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = i18n.resolvedLanguage === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              active
                ? 'border-violet-400 bg-violet-500/15 text-violet-600'
                : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
            }`}
          >
            <FlagIcon code={lang.countryCode} className="mr-1.5 !h-3.5 !w-5 rounded-sm" />
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}

export default LanguageSwitcher
