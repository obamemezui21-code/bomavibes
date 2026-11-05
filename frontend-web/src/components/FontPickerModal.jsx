import { useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import { fontsByCategory, loadAllFonts } from '../lib/fonts.js'
import Modal from './ui/Modal.jsx'

// Paramètres → Écriture. Each row is shown in its own style (see lib/fonts.js)
// and a tap applies it straight away, to the page behind as well. onChoose
// keeps the choice on the member's account.
function FontPickerModal({ onChoose, onClose }) {
  const { font, setFont } = useTheme()

  useEffect(() => {
    loadAllFonts()
  }, [])

  return (
    <Modal onClose={onClose} className="flex max-h-[85svh] flex-col">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">Écriture</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Choisis le style de texte de toute l’app.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="-mr-2 -mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-ink/5">
          <X size={18} />
        </button>
      </div>

      <div className="-mx-2 mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-1">
        {fontsByCategory().map(({ category, fonts }) => (
          <section key={category}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">{category}</p>
            <ul className="space-y-1.5">
              {fonts.map((option) => {
                const active = option.id === font
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      data-font={option.id}
                      aria-pressed={active}
                      onClick={() => {
                        setFont(option.id)
                        onChoose?.(option.id)
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-violet-500/12 ring-1 ring-violet-500/40' : 'bg-ink/[0.04] hover:bg-ink/[0.07]'}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-lg font-bold leading-snug text-ink">
                          {option.name}
                          {option.note && <span className="ml-2 font-sans text-xs font-normal text-ink-soft">{option.note}</span>}
                        </span>
                        <span className="block truncate font-sans text-sm text-ink-soft">Belle soirée à Libreville</span>
                      </span>
                      {active && <Check size={18} strokeWidth={3} className="shrink-0 text-violet-600 dark:text-violet-300" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}

export default FontPickerModal
