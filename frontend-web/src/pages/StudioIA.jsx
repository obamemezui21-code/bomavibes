import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { fetchActiveAiPartners } from '../firebase/aiPartners.js'
import AffiliatePartnerCard from '../components/AffiliatePartnerCard.jsx'
import { useToast } from '../context/ToastContext.jsx'

function StudioIA() {
  const { showToast } = useToast()
  const [partners, setPartners] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchActiveAiPartners('ia')
      .then(setPartners)
      .catch(() => showToast('Impossible de charger le Studio IA.', 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-1 via-brand-2 to-brand-3 text-white shadow-md shadow-violet-500/25">
          <Sparkles size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Crée des vidéos avec l'IA</h1>
          <p className="mt-0.5 text-sm text-ink-soft/70">Anime tes photos, crée des vidéos pour tes réseaux ✨</p>
        </div>
      </div>

      {isLoading && <p className="mt-10 py-10 text-center text-sm text-ink-soft/50">Chargement…</p>}

      {!isLoading && partners.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 py-10 text-center">
          <Sparkles size={32} strokeWidth={1.5} className="text-ink-soft/30" />
          <p className="text-sm font-medium text-ink-soft/60">Aucune plateforme disponible pour le moment.</p>
        </div>
      )}

      {!isLoading && partners.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {partners.map((partner) => (
            <AffiliatePartnerCard key={partner.id} partner={partner} />
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

export default StudioIA
