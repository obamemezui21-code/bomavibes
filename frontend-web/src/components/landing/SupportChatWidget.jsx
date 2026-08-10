import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Send, Sparkles, X } from 'lucide-react'

const SUPPORT_EMAIL = 'Bomavibes241@gmail.com'
const WHATSAPP_URL = 'https://wa.me/33744233809'

const BUG_KEYWORDS = [
  'bug', 'erreur', 'plante', 'plantage', 'crash', 'bloque', 'probleme',
  'marche pas', 'fonctionne pas', 'freeze', 'ecran blanc', 'ne charge pas',
  'ne s\'affiche pas', 'ne repond pas', 'lent', 'coince',
]

// Simple, self-contained knowledge base: no API, no cost, no backend call —
// keyword match against the same answers already on this page's FAQ.
const KB = [
  {
    question: 'Est-ce que BomaVibes est gratuit ?',
    keywords: ['gratuit', 'prix', 'payant', 'abonnement', 'tarif', 'combien coute', 'coute'],
    answer: "L'inscription et l'essentiel — créer un profil, matcher, discuter — sont 100% gratuits. Des options premium existent en plus.",
    actions: [{ label: 'Voir les tarifs', to: '/tarifs' }],
  },
  {
    question: 'Comment mes données sont-elles protégées ?',
    keywords: ['donnee', 'confidentialite', 'vie privee', 'proteg', 'rgpd', 'vendu'],
    answer: 'Vos données ne sont jamais vendues et restent sous votre contrôle : vous pouvez les consulter, les modifier ou tout supprimer à tout moment.',
    actions: [{ label: 'Politique de confidentialité', to: '/confidentialite' }],
  },
  {
    question: 'Comment supprimer mon compte ?',
    keywords: ['supprimer compte', 'suppression', 'desinscrire', 'effacer mon compte'],
    answer: 'Directement depuis Paramètres → Supprimer mon compte, une fois connecté·e. Toutes vos données sont effacées définitivement, sans délai.',
  },
  {
    question: 'Que faire si un profil me met mal à l\'aise ?',
    keywords: ['signaler', 'bloquer', 'harcel', 'mal a l aise', 'faux profil', 'arnaque'],
    answer: 'Vous pouvez signaler ou bloquer n\'importe quel profil en un clic depuis la conversation ou le profil concerné, une fois connecté·e.',
    actions: [{ label: 'Page Sécurité', to: '/securite' }],
  },
  {
    question: 'Le blocage empêche-t-il vraiment de me recontacter ?',
    keywords: ['blocage marche', 'recontacter', 'bloque vraiment'],
    answer: "Oui. Une fois bloqué·e, la personne disparaît des deux côtés (Découvrir, Matchs, Messages) et ne peut plus techniquement vous envoyer de message.",
  },
  {
    question: 'BomaVibes est fait pour qui ?',
    keywords: ['pour qui', 'cible', 'afrodescendant', 'africain', 'age minimum', '18 ans'],
    answer: 'Pour les célibataires africains et afrodescendants de 18 ans et plus, qui cherchent des connexions authentiques et durables.',
  },
  {
    question: 'Dans quels pays BomaVibes est disponible ?',
    keywords: ['pays', 'disponible', 'gabon', 'france', 'afrique'],
    answer: "BomaVibes est disponible dès aujourd'hui au Gabon et en France, avec une extension progressive vers le reste de l'Afrique puis le monde entier.",
  },
  {
    question: 'Comment fonctionne le matching ?',
    keywords: ['matcher', 'match', 'decouvrir', 'swipe', 'like'],
    answer: "Dans l'onglet Découvrir, vous parcourez des profils et likez ceux qui vous plaisent. Si la personne vous like aussi, c'est un match et une conversation s'ouvre.",
  },
  {
    question: 'Comment discuter avec quelqu\'un ?',
    keywords: ['discuter', 'message', 'chatter', 'ecrire a quelqu un'],
    answer: 'Une fois un match confirmé, une conversation apparaît dans l\'onglet Messages — vous pouvez y écrire, envoyer des photos et des messages vocaux.',
  },
  {
    question: 'Je ne reçois pas de notifications',
    keywords: ['notification', 'notifications', 'ne recois pas de notif'],
    answer: "Vérifiez d'abord Paramètres → Notifications dans l'app, puis les autorisations de notifications de votre téléphone/navigateur pour BomaVibes. Si tout est activé et que ça persiste, c'est peut-être un bug — décrivez-le-moi.",
  },
  {
    question: 'Comment soutenir BomaVibes ?',
    keywords: ['soutenir', 'don', 'donation', 'aider le projet'],
    answer: 'Merci ! Vous pouvez contribuer librement au développement de BomaVibes depuis la page Soutenir.',
    actions: [{ label: 'Soutenir BomaVibes', to: '/soutenir' }],
  },
]

const SUGGESTED_QUESTIONS = [KB[0], KB[3], KB[7], KB[5]]

const DIACRITICS_RE = /[\u0300-\u036f]/g

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
}

function findBestMatch(normalizedQuery) {
  let best = null
  let bestScore = 0
  for (const entry of KB) {
    const score = entry.keywords.reduce((acc, kw) => (normalizedQuery.includes(kw) ? acc + 1 : acc), 0)
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }
  return best
}

function buildBugReplyMailto(description) {
  const subject = encodeURIComponent('Signalement de bug — BomaVibes')
  const body = encodeURIComponent(
    `Bonjour,\n\nJe rencontre le problème suivant sur BomaVibes :\n"${description}"\n\nÉtapes pour reproduire :\n1. \n2. \n\nAppareil / navigateur : \n\nMerci !`,
  )
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
}

let nextId = 1

function greetingMessage() {
  return {
    id: nextId++,
    from: 'bot',
    text: "Bonjour 👋 Je suis l'assistant BomaVibes. Posez-moi une question sur l'appli, ou dites-moi si vous rencontrez un bug.",
  }
}

function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => [greetingMessage()])
  const bottomRef = useRef(null)

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isOpen])

  function respondTo(rawQuery) {
    const query = normalize(rawQuery)
    const isBug = BUG_KEYWORDS.some((kw) => query.includes(normalize(kw)))

    if (isBug) {
      return {
        id: nextId++,
        from: 'bot',
        text: "Désolé pour ce désagrément ! Quelques pistes :\n1. Rafraîchissez la page ou relancez l'appli.\n2. Vérifiez votre connexion internet.\n3. Si ça persiste, envoyez-moi les détails et je transmets directement à l'équipe.",
        actions: [
          { label: 'Décrire le bug par email', href: buildBugReplyMailto(rawQuery) },
          { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
        ],
      }
    }

    const match = findBestMatch(query)
    if (match) {
      return {
        id: nextId++,
        from: 'bot',
        text: match.answer,
        actions: match.actions,
      }
    }

    return {
      id: nextId++,
      from: 'bot',
      text: "Je n'ai pas de réponse précise à ça. Écrivez-nous directement, on vous répond avec plaisir !",
      actions: [
        { label: 'Nous écrire par email', href: `mailto:${SUPPORT_EMAIL}` },
        { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
      ],
    }
  }

  function pushExchange(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages((prev) => [...prev, { id: nextId++, from: 'user', text: trimmed }, respondTo(trimmed)])
  }

  function handleSubmit(e) {
    e.preventDefault()
    pushExchange(input)
    setInput('')
  }

  return (
    <>
      <div className="fixed bottom-5 right-4 z-50 h-14 w-14 sm:right-6">
        {!isOpen && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 blur-xl"
            animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.3, 1] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          animate={isOpen ? { y: 0, rotate: 0 } : { y: [0, -10, 0], rotate: [0, -3, 3, 0] }}
          transition={isOpen ? { duration: 0.2 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          whileTap={{ scale: 0.92 }}
          aria-label={isOpen ? "Fermer l'assistant" : "Ouvrir l'assistant BomaVibes"}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-xl shadow-violet-500/30 transition hover:brightness-105"
        >
          {isOpen ? <X size={22} strokeWidth={2.25} /> : <Bot size={24} strokeWidth={2.25} />}
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-x-4 bottom-24 z-50 flex max-h-[70vh] w-auto max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:inset-x-auto sm:right-6 sm:w-96"
          >
            <div className="flex shrink-0 items-center gap-2 bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-3.5 text-white">
              <Sparkles size={18} strokeWidth={2.25} />
              <p className="min-w-0 truncate text-sm font-semibold">Assistant BomaVibes</p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`min-w-0 max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                      m.from === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-surface-soft text-ink dark:bg-surface-tint'
                    }`}
                  >
                    {m.text}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.actions.map((a) =>
                          a.to ? (
                            <Link
                              key={a.label}
                              to={a.to}
                              className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm transition hover:bg-white"
                            >
                              {a.label}
                            </Link>
                          ) : (
                            <a
                              key={a.label}
                              href={a.href}
                              target={a.external ? '_blank' : undefined}
                              rel={a.external ? 'noopener noreferrer' : undefined}
                              className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm transition hover:bg-white"
                            >
                              {a.label}
                            </a>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {messages.length <= 1 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q.question}
                      type="button"
                      onClick={() => pushExchange(q.question)}
                      className="rounded-full border border-violet-600/15 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-600/5"
                    >
                      {q.question}
                    </button>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-ink/8 px-3 py-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écrivez votre question…"
                className="min-w-0 flex-1 rounded-full border border-ink/10 bg-surface-soft px-4 py-2 text-sm text-ink outline-none focus:border-violet-400"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Envoyer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white disabled:opacity-40"
              >
                <Send size={16} strokeWidth={2.25} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default SupportChatWidget
