import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import PricingTiers from '../components/PricingTiers.jsx'

function Pricing() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-10 sm:pt-40">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">Nos tarifs</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">
            Passez au niveau supérieur
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#6b5d4f]">
            BomaVibes reste gratuit pour matcher et discuter. Choisissez le niveau Premium qui vous
            correspond, sans engagement caché.
          </p>
        </div>

        <div className="mt-16">
          <PricingTiers />
        </div>

        <div className="mt-20 text-center">
          <p className="text-sm text-[#6b5d4f]">
            Pas encore prêt·e à passer Premium ? Profitez gratuitement de toutes les fonctionnalités essentielles.
          </p>
          <Link
            to="/signup"
            className="mt-4 inline-block rounded-xl bg-[#1F3D2B] px-7 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#2a5138]"
          >
            S'inscrire gratuitement
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Pricing
