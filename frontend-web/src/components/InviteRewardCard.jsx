import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Gift, Send } from 'lucide-react'
import { getMyReferral } from '../firebase/referrals.js'
import { REFERRAL_MONTHLY_CAP, REFERRAL_REWARD } from '../lib/ngori.js'
import InviteFriendsModal from './InviteFriendsModal.jsx'
import NgoriCoin from './NgoriCoin.jsx'

const PERKS = ['❤️ Likes illimités', '🚀 Boost du profil', '👀 Voir qui vous aime', '📞 Appels vidéo']

// Découvrir: invite friends and earn Ngori, which buy the app's privileges.
// A friend counts once their identity is verified (backend referralService.js).
function InviteRewardCard() {
  const [showInvite, setShowInvite] = useState(false)
  const [mine, setMine] = useState(null)

  useEffect(() => {
    let live = true
    getMyReferral()
      .then((data) => live && setMine(data))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const reward = mine?.reward ?? REFERRAL_REWARD
  const cap = mine?.monthlyCap ?? REFERRAL_MONTHLY_CAP

  return (
    <section aria-labelledby="invite-reward-title" className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-violet-700 via-fuchsia-700 to-pink-600 p-5 text-white shadow-lg shadow-violet-900/20">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-300/25 blur-2xl" />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-amber-200">
          <Gift size={14} strokeWidth={2.5} />
          Parrainage
        </p>
        <h2 id="invite-reward-title" className="mt-1 font-display text-xl font-bold leading-tight">
          Invite tes amis, gagne des privilèges
        </h2>
        <p className="mt-1.5 text-sm text-white/90">
          <span className="inline-flex items-center gap-1 align-middle font-bold text-amber-200">
            +{reward} <NgoriCoin size={15} />
          </span>{' '}
          pour chaque ami qui rejoint BomaVibes et fait vérifier son profil.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {PERKS.map((perk) => (
            <li key={perk} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
              {perk}
            </li>
          ))}
        </ul>

        {(mine?.verified > 0 || mine?.pending > 0) && (
          <p className="mt-3 text-xs font-medium text-white/85">
            {mine.verified > 0 && `${mine.verified} ami${mine.verified > 1 ? 's' : ''} vérifié${mine.verified > 1 ? 's' : ''} · ${mine.earned} Ngori gagnés`}
            {mine.verified > 0 && mine.pending > 0 && ' · '}
            {mine.pending > 0 && `${mine.pending} en attente de vérification`}
          </p>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowInvite(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-display text-sm font-bold text-violet-800 shadow-md"
        >
          <Send size={16} strokeWidth={2.25} />
          Inviter mes amis
        </motion.button>
        <p className="mt-2 text-center text-[11px] text-white/70">
          Les Ngori se dépensent dans ton espace Ngori · jusqu’à {cap} amis récompensés par mois
        </p>
      </div>

      {showInvite && <InviteFriendsModal onClose={() => setShowInvite(false)} />}
    </section>
  )
}

export default InviteRewardCard
