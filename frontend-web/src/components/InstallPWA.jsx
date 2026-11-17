import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Download, Share, SquarePlus, X } from 'lucide-react'
import { isInAppBrowser, isIOS, promptInstall, resetInstall, usePwa } from '../lib/pwa.js'

// "Install BomaVibes", in two forms:
// - variant="banner": a card above the bottom bar, offered once in a while
//   (20 s into a visit, then not again for 30 days once closed or declined);
// - variant="card": a row for Settings, always there, showing what this
//   device can do (install button, iPhone steps, or "already installed").
// Android, Windows, macOS…: the browser's own install dialog. iPhone/iPad:
// Safari has none, so the steps are explained.

const DISMISSED_KEY = 'bv.installDismissedAt'
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const BANNER_DELAY_MS = 20 * 1000

function dismissedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) || 0) < SNOOZE_MS
  } catch {
    return false
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  } catch {
    // Private window: offered again next visit, still at most once per visit.
  }
}

function IosSteps({ className = '' }) {
  if (isInAppBrowser) {
    return (
      <p className={`text-sm leading-relaxed text-ink-soft ${className}`}>
        Ouvrez cette page dans <strong>Safari</strong>, puis appuyez sur Partager → <strong>Sur l’écran d’accueil</strong>.
      </p>
    )
  }
  return (
    <p className={`text-sm leading-relaxed text-ink-soft ${className}`}>
      Sur iPhone : appuyez sur Partager{' '}
      <Share size={14} className="inline -translate-y-px text-violet-600" aria-label="(icône Partager)" /> puis{' '}
      <strong>Sur l’écran d’accueil</strong>{' '}
      <SquarePlus size={14} className="inline -translate-y-px text-violet-600" aria-hidden="true" />.
    </p>
  )
}

function InstallButton({ onDone, className = '' }) {
  async function install() {
    const outcome = await promptInstall()
    onDone?.(outcome)
  }
  return (
    <button
      type="button"
      onClick={install}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 px-4 py-2.5 text-sm font-semibold text-ink-on-brand shadow-md shadow-violet-500/25 ${className}`}
    >
      <Download size={16} />
      Installer BomaVibes
    </button>
  )
}

// The install as it goes: a bar while the phone installs, then "installed" or
// what went wrong. The browser reports no percentage, so the bar is a time
// estimate that only completes when the system confirms the install.
function InstallProgress({ phase }) {
  if (phase === 'installing') {
    return (
      <div role="status">
        <p className="text-sm font-semibold text-ink">Installation en cours…</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-label="Installation de BomaVibes">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3" initial={{ width: '5%' }} animate={{ width: '90%' }} transition={{ duration: 25, ease: 'easeOut' }} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">Gardez cette page ouverte : l’icône BomaVibes arrive sur votre écran d’accueil.</p>
      </div>
    )
  }
  if (phase === 'done') {
    return (
      <div role="status">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CircleCheck size={18} className="text-mint-500" /> BomaVibes est installée !
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
          <motion.div className="h-full rounded-full bg-mint-500" initial={{ width: '90%' }} animate={{ width: '100%' }} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">Ouvrez-la depuis l’icône sur votre écran d’accueil.</p>
      </div>
    )
  }
  return (
    <div role="alert">
      <p className="flex items-center gap-2 text-sm font-semibold text-coral-600">
        <CircleAlert size={18} /> {phase === 'cancelled' ? 'Installation annulée' : 'L’installation n’a pas abouti'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        {phase === 'cancelled'
          ? 'Vous avez refusé l’installation. Vous pourrez la relancer depuis Réglages → Application.'
          : 'Vérifiez votre connexion et l’espace libre du téléphone, puis réessayez depuis le menu du navigateur : « Installer l’application » ou « Ajouter à l’écran d’accueil ».'}
      </p>
    </div>
  )
}

function InstallBanner({ hidden }) {
  const { canPrompt, installed, install } = usePwa()
  const [closed, setClosed] = useState(dismissedRecently)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), BANNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const available = canPrompt || isIOS
  const underWay = install !== 'idle'
  const open = underWay || (ready && !hidden && !closed && !installed && available)

  function close() {
    rememberDismissal()
    setClosed(true)
    resetInstall()
  }

  // "Installed" goes away by itself after a moment.
  useEffect(() => {
    if (install !== 'done') return undefined
    const timer = setTimeout(resetInstall, 8000)
    return () => clearTimeout(timer)
  }, [install])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          role="dialog"
          aria-label="Installer BomaVibes"
          className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-3xl border border-ink/10 bg-white p-4 text-ink shadow-2xl dark:bg-surface-tint desktop:bottom-5"
        >
          <div className="flex items-start gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-2xl border border-ink/10 object-cover" />
            <div className="min-w-0 flex-1">
              {underWay ? (
                <InstallProgress phase={install} />
              ) : (
                <>
              <p className="font-display text-base font-semibold">Installez BomaVibes 📱</p>
              {canPrompt ? (
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Accédez rapidement à BomaVibes depuis votre écran d’accueil, comme une vraie application.
                </p>
              ) : (
                <IosSteps className="mt-1" />
              )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
          {canPrompt && !underWay && <InstallButton className="mt-3 w-full" />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function InstallCard() {
  const { canPrompt, installed, install } = usePwa()

  if (install !== 'idle' && install !== 'done') {
    return (
      <div className="px-1 py-3">
        <InstallProgress phase={install} />
      </div>
    )
  }

  if (installed) {
    return (
      <p className="flex items-center gap-2 px-1 py-3 text-sm text-ink-soft">
        <CircleCheck size={16} className="text-mint-400" />
        BomaVibes est installée sur cet appareil.
      </p>
    )
  }
  return (
    <div className="px-1 py-3">
      <p className="text-sm font-medium text-ink">Installer l’application</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft/80">
        Une icône sur votre écran d’accueil, l’app en plein écran et les notifications, sans passer par un store.
      </p>
      {canPrompt ? (
        <InstallButton className="mt-3" />
      ) : isIOS ? (
        <IosSteps className="mt-2" />
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Dans le menu de votre navigateur, choisissez <strong>Installer l’application</strong> ou{' '}
          <strong>Ajouter à l’écran d’accueil</strong>.
        </p>
      )}
    </div>
  )
}

function InstallPWA({ variant = 'banner', hidden = false }) {
  return variant === 'card' ? <InstallCard /> : <InstallBanner hidden={hidden} />
}

export default InstallPWA
