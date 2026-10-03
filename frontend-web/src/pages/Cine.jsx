import { useEffect, useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { fetchActiveAiPartners } from '../firebase/aiPartners.js'
import AffiliatePartnerCard from '../components/AffiliatePartnerCard.jsx'
import { useToast } from '../context/ToastContext.jsx'

// "Ciné & Séries": film and series platforms, through affiliate links set
// by an admin (Admin → Affiliation, category "Ciné & Séries"). BomaVibes
// shows no video itself — members subscribe on the official platforms.
function Cine() {
  const { showToast } = useToast()
  const [partners, setPartners] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchActiveAiPartners('streaming')
      .then(setPartners)
      .catch(() => showToast('Impossible de charger les plateformes.', 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-md shadow-rose-500/25">
          <Clapperboard size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Ciné & Séries</h1>
          <p className="mt-0.5 text-sm text-ink-soft/70">Les meilleurs films et séries, pour vos soirées en duo 🍿</p>
        </div>
      </div>

      {isLoading && <p className="mt-10 py-10 text-center text-sm text-ink-soft/50">Chargement…</p>}

      {!isLoading && partners.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 py-10 text-center">
          <Clapperboard size={32} strokeWidth={1.5} className="text-ink-soft/30" />
          <p className="text-sm font-medium text-ink-soft/60">Les plateformes arrivent bientôt.</p>
        </div>
      )}

      {!isLoading && partners.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {partners.map((partner) => (
            <AffiliatePartnerCard
              key={partner.id}
              partner={partner}
              ctaLabel={`Regarder sur ${partner.nom}`}
              freeLabel="Essai gratuit"
            />
          ))}
        </div>
      )}

      {!isLoading && partners.length > 0 && (
        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-soft/50">
          Certains liens sont des liens affiliés : BomaVibes peut recevoir une commission si vous vous abonnez, sans
          surcoût pour vous. Les prix sont indicatifs, le prix final est celui affiché sur le site de la plateforme.
        </p>
      )}
    </div>
  )
}

export default Cine
