import { motion } from 'framer-motion'
import { COUNTRIES } from '../../lib/geography.js'
import { LANGUAGES } from '../../lib/onboardingOptions.js'

// Every number here is computed from real, shipped data — never a vanity
// metric. Swap this for real usage stats (members, matches...) once the
// platform has enough traction for those to be meaningful on their own.
const CITY_COUNT = COUNTRIES.reduce((sum, c) => sum + c.regions.reduce((s, r) => s + r.cities.length, 0), 0)

const STATS = [
  { value: `${COUNTRIES.length}`, label: 'pays africains au programme' },
  { value: `${LANGUAGES.length}`, label: 'langues supportées' },
  { value: `${CITY_COUNT}+`, label: 'villes et régions cartographiées' },
  { value: '6', label: 'piliers de sécurité intégrés' },
]

function StatsSection() {
  return (
    <section className="bg-[#FAF6EF] px-4 py-24 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">BomaVibes en chiffres</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#6b5d4f]">
            Une plateforme construite en profondeur, dès le premier jour.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: 'easeOut' }}
              className="rounded-3xl border border-violet-600/8 bg-white p-6 text-center shadow-sm"
            >
              <p className="font-display text-4xl font-extrabold text-pink-500 sm:text-5xl">{s.value}</p>
              <p className="mt-2 text-sm leading-snug text-[#6b5d4f]">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default StatsSection
