import { ExternalLink, Image as ImageIcon } from 'lucide-react'
import { recordAiPartnerClick } from '../firebase/aiPartners.js'

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

// One affiliate partner (Studio IA tools, Ciné & Séries platforms): the
// click is logged for the admin stats, then the partner's site opens.
function AffiliatePartnerCard({ partner, ctaLabel = 'Voir l’offre', freeLabel = 'Plan gratuit disponible' }) {
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
              {freeLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {partner.description && <p className="text-sm leading-relaxed text-ink-soft/80">{partner.description}</p>}
        {partner.idealPour && (
          <p className="mt-2 text-xs text-ink-soft/60">
            <span className="font-semibold text-ink-soft/80">Idéal pour :</span> {partner.idealPour}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-ink/6 pt-3">
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
          {ctaLabel}
          <ExternalLink size={13} strokeWidth={2.25} />
        </a>
      </div>
    </div>
  )
}

export default AffiliatePartnerCard
