import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Cookie, X } from 'lucide-react'
import { onOpenCookieSettings, saveConsent, useCookieConsent } from '../lib/cookieConsent.js'

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-violet-500' : 'bg-ink/20'} disabled:opacity-60`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

// Cookie banner: shown until the visitor decides, and again whenever a
// "Gérer les cookies" link is used. Refusing is as easy as accepting.
function CookieBanner() {
  const { decided, maps } = useCookieConsent()
  const [reopened, setReopened] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [mapsChoice, setMapsChoice] = useState(maps)

  useEffect(
    () =>
      onOpenCookieSettings(() => {
        setMapsChoice(maps)
        setCustomizing(true)
        setReopened(true)
      }),
    [maps],
  )

  const open = !decided || reopened

  function decide(allowMaps) {
    saveConsent({ maps: allowMaps })
    setReopened(false)
    setCustomizing(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          role="dialog"
          aria-label="Cookies et vie privée"
          className="fixed inset-x-3 bottom-3 z-[95] mx-auto max-w-lg rounded-3xl border border-ink/10 bg-white p-5 text-ink shadow-2xl dark:bg-surface-tint sm:bottom-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600">
              <Cookie size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold">Votre vie privée</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                BomaVibes utilise uniquement ce qui est nécessaire pour fonctionner : votre connexion, la protection
                anti-robots et vos réglages. Avec votre accord, nous affichons aussi des <strong>cartes OpenStreetMap</strong>,
                qui reçoivent votre adresse IP. Aucune publicité, aucun pistage.{' '}
                <Link to="/cookies" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
                  En savoir plus
                </Link>
              </p>
            </div>
            {decided && (
              <button
                type="button"
                onClick={() => {
                  setReopened(false)
                  setCustomizing(false)
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {customizing && (
            <div className="mt-4 space-y-3 rounded-2xl bg-ink/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Essentiels</p>
                  <p className="text-xs text-ink-soft/80">Session, sécurité (reCAPTCHA, Cloudflare Turnstile), vos réglages. Toujours actifs.</p>
                </div>
                <Toggle checked disabled label="Essentiels, toujours actifs" />
              </div>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Cartes</p>
                  <p className="text-xs text-ink-soft/80">Cartes des Coins Chics, des profils proches et des positions partagées (OpenStreetMap).</p>
                </div>
                <Toggle checked={mapsChoice} onChange={setMapsChoice} label="Cartes OpenStreetMap" />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {customizing ? (
              <button
                type="button"
                onClick={() => decide(mapsChoice)}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-white"
              >
                Enregistrer mes choix
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => decide(false)}
                  className="flex-1 rounded-xl border border-ink/15 py-2.5 text-sm font-semibold hover:bg-ink/5"
                >
                  Refuser
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizing(true)}
                  className="flex-1 rounded-xl border border-ink/15 py-2.5 text-sm font-semibold hover:bg-ink/5"
                >
                  Personnaliser
                </button>
                <button
                  type="button"
                  onClick={() => decide(true)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-white"
                >
                  Tout accepter
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default CookieBanner
