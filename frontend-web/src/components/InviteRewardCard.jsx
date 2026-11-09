import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Send } from 'lucide-react'
import { getMyReferral } from '../firebase/referrals.js'
import { REFERRAL_MONTHLY_CAP, REFERRAL_REWARD } from '../lib/ngori.js'
import poster from '../assets/poster-invite.webp'
import InviteFriendsModal from './InviteFriendsModal.jsx'
import NgoriCoin from './NgoriCoin.jsx'

const PERKS = ['Likes illimités', 'Boost du profil', 'Voir qui vous aime', 'Appels vidéo']

// "Invite tes amis, gagne des privilèges": over the poster on a phone, beside
// it on a computer (only one of the two is ever shown).
function Title() {
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-200">Parrainage</p>
      <h2 className="mt-1 font-display text-[clamp(1.5rem,7vw,2.25rem)] font-black leading-[1.05] tracking-tight [text-shadow:0_4px_18px_rgba(0,0,0,0.65)] desktop:text-4xl">
        Invite tes amis,
        <br />
        <span className="text-gold">gagne des privilèges</span>
      </h2>
    </>
  )
}

// Découvrir: the "invite your friends" poster. Friends count once their
// identity is verified (backend referralService.js), and the Ngori they earn
// buy the app's privileges. Phone: the poster on top, fading into the panel
// under it. Computer: a banner, the poster on the left and the panel beside it,
// so the card stays a reasonable size on a wide page.
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
    <section
      aria-label="Parrainage"
      className="relative mx-auto w-full overflow-hidden rounded-[24px] bg-[#170a2b] text-white shadow-xl shadow-violet-900/30 desktop:grid desktop:max-w-4xl desktop:grid-cols-[280px_minmax(0,1fr)] desktop:items-center"
    >
      <div className="relative aspect-[5/4] w-full desktop:aspect-[4/5] desktop:self-stretch">
        <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[center_45%]" />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#170a2b]/90 via-[#170a2b]/40 to-transparent desktop:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#170a2b] to-transparent desktop:hidden" />
        <div className="absolute inset-y-0 right-0 hidden w-1/5 bg-gradient-to-l from-[#170a2b] to-transparent desktop:block" />
        <div className="absolute inset-x-0 top-0 px-5 pt-4 text-center desktop:hidden">
          <Title />
        </div>
      </div>

      <div className="relative px-4 pb-4 text-center desktop:px-10 desktop:py-8 desktop:text-left">
        <div className="mb-4 hidden desktop:block">
          <Title />
        </div>

        <p className="flex items-center justify-center gap-1.5 font-display text-xl font-black text-gold desktop:justify-start desktop:text-2xl">
          +{reward} <NgoriCoin size={22} />
          <span className="text-sm font-bold text-white desktop:text-base">par ami vérifié</span>
        </p>
        <p className="mt-1 text-sm text-white/80">Ton ami rejoint BomaVibes et fait vérifier son profil : tu es récompensé.</p>

        <ul className="mt-3 flex flex-wrap justify-center gap-1.5 desktop:justify-start">
          {PERKS.map((perk) => (
            <li key={perk} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
              {perk}
            </li>
          ))}
        </ul>

        {(mine?.verified > 0 || mine?.pending > 0) && (
          <p className="mt-3 text-xs font-semibold text-amber-200">
            {mine.verified > 0 && `${mine.verified} ami${mine.verified > 1 ? 's' : ''} vérifié${mine.verified > 1 ? 's' : ''} · ${mine.earned} Ngori gagnés`}
            {mine.verified > 0 && mine.pending > 0 && ' · '}
            {mine.pending > 0 && `${mine.pending} en attente`}
          </p>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowInvite(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 py-3 font-display text-base font-black tracking-wide text-white shadow-lg shadow-black/40 desktop:w-auto desktop:px-8"
        >
          <Send size={17} strokeWidth={2.5} />
          INVITER MES AMIS
        </motion.button>
        <p className="mt-2 text-[11px] text-white/60">À dépenser dans ton espace Ngori · jusqu’à {cap} amis récompensés par mois</p>
      </div>

      {showInvite && <InviteFriendsModal onClose={() => setShowInvite(false)} />}
    </section>
  )
}

export default InviteRewardCard
