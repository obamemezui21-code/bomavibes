import { useEffect, useState } from 'react'
import { Sparkles, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { fetchActiveAiPartners, recordAiPartnerClick } from '../firebase/aiPartners.js'
import { useToast } from '../context/ToastContext.jsx'

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€' }

function formatPrice(prix, devise) {
  if (!prix) return null
  const symbol = CURRENCY_SYMBOLS[devise]
  return symbol ? `À partir de ${prix} ${symbol}/mois` : `À partir de ${prix} ${devise}/mois`
}

function formatVerifiedDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function PartnerCard({ partner }) {
  const price = formatPrice(partner.prixAPartirDe, partner.devise)
  const verifiedDate = formatVerifiedDate(partner.prixVerifieLe)

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm dark:bg-surface-tint">
      <div className="flex items-center gap-3 p-4 pb-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5">
          {partner.logoUrl ? (
            <img src={partner.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <ImageIcon size={18} className="text-ink-soft/30" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{partner.nom}</p>
          {partner.planGratuit && (
            <span className="mt-0.5 inline-flex items-center rounded-full bg-mint-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mint-600">
              Plan gratuit disponible
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {partner.description && <p className="text-sm leading-relaxed text-ink-soft/80">{partner.description}</p>}
        {partner.idealPour && (
          <p className="mt-2 text-xs text-ink-soft/60">
            <span className="font-semibold text-ink-soft/80">Idéal pour :</span> {partner.idealPour}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-ink/6 pt-3">
          <p className="text-sm font-bold text-ink">{price || 'Voir le prix'}</p>
          {verifiedDate && <p className="text-[10px] text-ink-soft/50">Prix vérifié le {verifiedDate}</p>}
        </div>

        <a
          href={partner.lienAffilie}
          target="_blank"
          rel="noopener sponsored"
          onClick={() => recordAiPartnerClick(partner.id)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition"
        >
          Voir l'offre
          <ExternalLink size={13} strokeWidth={2.25} />
        </a>
      </div>
    </div>
  )
}

function StudioIA() {
  const { showToast } = useToast()
  const [partners, setPartners] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchActiveAiPartners()
      .then(setPartners)
      .catch(() => showToast('Impossible de charger le Studio IA.', 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
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
            <PartnerCard key={partner.id} partner={partner} />
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
