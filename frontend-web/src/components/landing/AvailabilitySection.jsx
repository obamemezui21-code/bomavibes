import Reveal from './Reveal.jsx'
import { COUNTRIES, SITE_CONTINENTS } from '../../lib/geography.js'
import FlagIcon from '../FlagIcon.jsx'

// Gabon, France and Germany are live — everything else is roadmap. Update
// this set as new markets actually launch; never mark a country
// "Disponible" ahead of the real launch.
const LIVE_COUNTRY_CODES = new Set(['GA', 'FR', 'DE'])

// Five showcase countries per continent (live ones first); the rest of
// geography.js is summed up as "+ N autres pays".
const FEATURED = {
  Afrique: ['GA', 'CM', 'CI', 'SN', 'CG'],
  Europe: ['FR', 'DE', 'BE', 'CH', 'GB'],
  Asie: ['CN', 'IN', 'JP', 'KR', 'SG'],
}

const GROUPS = SITE_CONTINENTS.map((continent) => {
  const all = COUNTRIES.filter((c) => c.continent === continent)
  const featured = (FEATURED[continent] || []).map((code) => all.find((c) => c.code === code)).filter(Boolean)
  return { continent, featured, others: all.length - featured.length }
})

function AvailabilitySection() {
  return (
    <section id="disponibilite" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#261b28] sm:text-5xl">Disponibilité dans le monde</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#635a65]">
          BomaVibes est disponible au Gabon, en France et en Allemagne, avec l'ambition claire de s'étendre à toute l'Afrique francophone,
          puis panafricaine — et, à terme, dans le monde entier.
        </p>
        <div className="mt-6 inline-flex items-center gap-4 rounded-full bg-white px-5 py-2 text-xs font-semibold shadow-sm">
          <span className="inline-flex items-center gap-1.5 text-pink-600">
            <span className="h-2 w-2 rounded-full bg-pink-500" />
            Disponible
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#635a65]">
            <span className="h-2 w-2 rounded-full bg-[#635a65]/30" />
            Bientôt
          </span>
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
        {GROUPS.map((group, gi) => (
          <Reveal
            key={group.continent} delay={(gi % 4) * 0.06}
            className="flex flex-col rounded-3xl border border-violet-600/8 bg-white p-5 shadow-sm"
          >
            <h3 className="font-display text-base font-bold text-[#261b28]">{group.continent}</h3>
            <ul className="mt-3 flex-1 space-y-2">
              {group.featured.map((c) => {
                const isLive = LIVE_COUNTRY_CODES.has(c.code)
                return (
                  <li key={c.code} className="flex items-center gap-2.5">
                    <FlagIcon code={c.code} className="!h-4 !w-6 shrink-0 rounded-sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#261b28]">{c.name}</span>
                    {isLive ? (
                      <span className="shrink-0 rounded-full bg-pink-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-600">
                        Disponible
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#635a65]/60">Bientôt</span>
                    )}
                  </li>
                )
              })}
            </ul>
            {group.others > 0 && (
              <p className="mt-3 border-t border-violet-600/8 pt-3 text-xs text-[#635a65]">
                + {group.others} autre{group.others > 1 ? 's' : ''} pays au programme
              </p>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export default AvailabilitySection
