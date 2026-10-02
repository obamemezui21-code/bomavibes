import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthContext.jsx'
import { subscribeToMyVerification } from '../firebase/verification.js'
import { identityStatus } from '../lib/identityStatus.js'

const IdentityContext = createContext(null)

export function IdentityProvider({ children }) {
  const { user, publicProfile } = useAuth()
  const navigate = useNavigate()
  const [request, setRequest] = useState(undefined)
  const [gateOpen, setGateOpen] = useState(false)

  useEffect(() => {
    if (!user?.id) return undefined
    return subscribeToMyVerification(user.id, setRequest)
  }, [user?.id])

  const status = user?.id ? identityStatus(publicProfile, request) : 'loading'

  // Call before liking, writing, calling or publishing: true when allowed,
  // otherwise explains why (and how to unlock it) and returns false.
  function requireIdentity() {
    if (status === 'ok') return true
    setGateOpen(true)
    return false
  }

  const value = { status, request, canInteract: status === 'ok', requireIdentity }

  return (
    <IdentityContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {gateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[105] flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setGateOpen(false)}
          >
            <motion.div
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-ink shadow-2xl dark:bg-surface-tint"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/12 text-sky-500">
                {status === 'pending' ? <Clock size={26} /> : <ShieldCheck size={26} />}
              </span>
              <p className="mt-4 font-display text-lg font-semibold">
                {status === 'pending' ? 'Vérification en cours' : 'Vérifiez votre identité'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {status === 'pending'
                  ? 'Notre équipe examine votre pièce d’identité et votre selfie, généralement en quelques heures. Vous pourrez liker, écrire, appeler et publier dès que ce sera validé.'
                  : 'Pour la sécurité de tous nos membres, chaque nouveau profil est vérifié avec une pièce d’identité et un selfie.'}
              </p>
              {status === 'pending' ? (
                <button
                  type="button"
                  onClick={() => setGateOpen(false)}
                  className="mt-5 w-full rounded-full bg-violet-950 py-3 text-sm font-semibold text-white dark:bg-pink-500"
                >
                  D’accord
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setGateOpen(false)
                    navigate('/verification')
                  }}
                  className="mt-5 w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 py-3 text-sm font-semibold text-white"
                >
                  Vérifier mon identité
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </IdentityContext.Provider>
  )
}

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider')
  return ctx
}
