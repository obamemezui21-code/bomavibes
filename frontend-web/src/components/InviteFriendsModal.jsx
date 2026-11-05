import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, MessageSquare, Share2, X as Close } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getMyReferral } from '../firebase/referrals.js'
import { INVITES, inviteLinks, inviteMessage, withReferral } from '../lib/invite.js'
import Modal from './ui/Modal.jsx'

// Only on a phone: that's where the share sheet lists Instagram, Snapchat and
// TikTok. A computer's has none of them.
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && !!window.matchMedia?.('(pointer: coarse)').matches

// The networks' own marks (lucide no longer ships brand logos).
const LOGOS = {
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  facebook:
    'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  telegram:
    'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
}

const COLORS = {
  whatsapp: 'bg-[#25D366] text-white',
  facebook: 'bg-[#1877F2] text-white',
  telegram: 'bg-[#229ED9] text-white',
  x: 'bg-black text-white ring-1 ring-white/20',
  sms: 'bg-emerald-600 text-white',
  email: 'bg-violet-600 text-white',
}

function NetworkIcon({ id }) {
  if (id === 'sms') return <MessageSquare size={21} strokeWidth={2.25} />
  if (id === 'email') return <Mail size={21} strokeWidth={2.25} />
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d={LOGOS[id]} />
    </svg>
  )
}

// Share BomaVibes with friends. `invite`: a key of INVITES (lib/invite.js).
function InviteFriendsModal({ invite = 'app', onClose }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const [referral, setReferral] = useState(null)
  const copiedTimer = useRef(null)
  // A member shares their personal link; if it can't be had, the plain one.
  const content = withReferral(INVITES[invite], referral?.code)

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

  useEffect(() => {
    if (!user?.id) return undefined
    let live = true
    getMyReferral()
      .then((data) => live && setReferral(data))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [user?.id])

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteMessage(content))
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Impossible de copier le lien.', 'error')
    }
  }

  async function shareElsewhere() {
    try {
      await navigator.share({ title: 'BomaVibes', text: content.text, url: content.url })
    } catch {
      // The share sheet was closed: nothing to do.
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">{content.title}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{content.subtitle}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="-mr-2 -mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-ink/5">
          <Close size={18} />
        </button>
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-x-2 gap-y-4">
        {inviteLinks(content).map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              {...(link.app ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-xs font-medium text-ink/80 transition hover:bg-ink/5"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm ${COLORS[link.id]}`}>
                <NetworkIcon id={link.id} />
              </span>
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      {canShare && (
        <button
          type="button"
          onClick={shareElsewhere}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500/12 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-500/20 dark:text-violet-300"
        >
          <Share2 size={16} strokeWidth={2.25} />
          Instagram, Snapchat, TikTok…
        </button>
      )}

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-ink/[0.04] p-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{content.url.replace('https://', '')}</span>
        <button
          type="button"
          onClick={copy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${copied ? 'bg-emerald-600 text-white' : 'bg-white text-ink shadow-sm dark:bg-surface-tint'}`}
        >
          {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.25} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      {!canShare && <p className="mt-2 text-center text-[11px] text-ink-soft">Pour Instagram, Snapchat ou TikTok, copie le lien et colle-le dans ton message.</p>}
    </Modal>
  )
}

export default InviteFriendsModal
