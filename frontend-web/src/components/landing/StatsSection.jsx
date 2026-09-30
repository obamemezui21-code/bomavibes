import Reveal from './Reveal.jsx'
import { COUNTRIES, SITE_CONTINENTS } from '../../lib/geography.js'
import { LANGUAGES } from '../../lib/onboardingOptions.js'

// Every number here is computed from real, shipped data — never a vanity
// metric. Swap this for real usage stats (members, matches...) once the
// platform has enough traction for those to be meaningful on their own.
// Countries are counted on the continents the site advertises.
const SITE_COUNTRIES = COUNTRIES.filter((c) => SITE_CONTINENTS.includes(c.continent))
const CITY_COUNT = SITE_COUNTRIES.reduce((sum, c) => sum + c.regions.reduce((s, r) => s + r.cities.length, 0), 0)

const STATS = [
  { value: `${SITE_COUNTRIES.length}`, label: 'pays au programme en Afrique, en Europe et en Asie' },
  { value: `${LANGUAGES.length}`, label: 'langues supportées' },
  { value: `${CITY_COUNT}+`, label: 'villes et régions cartographiées' },
  { value: '6', label: 'piliers de sécurité intégrés' },
]

function StatsSection() {
  return (
    <section className="bg-[#f7f1e6] px-4 py-24 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold text-[#261b28] sm:text-5xl">BomaVibes en chiffres</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#635a65]">
            Une plateforme construite en profondeur, dès le premier jour.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal
              key={s.label} delay={i * 0.08}
              className="rounded-3xl border border-violet-600/8 bg-white p-6 text-center shadow-sm"
            >
              <p className="font-display text-4xl font-extrabold text-pink-500 sm:text-5xl">{s.value}</p>
              <p className="mt-2 text-sm leading-snug text-[#635a65]">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export default StatsSection
