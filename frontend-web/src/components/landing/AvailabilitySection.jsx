import { motion } from 'framer-motion'
import { COUNTRIES } from '../../lib/geography.js'

// Only Gabon is live today — everything else is roadmap. Update this set as
// new markets actually launch; never mark a country "Disponible" ahead of
// the real launch.
const LIVE_COUNTRY_CODES = new Set(['GA'])

function AvailabilitySection() {
  return (
    <section id="disponibilite" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Disponibilité en Afrique</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#6b5d4f]">
          BomaVibes démarre au Gabon, avec l'ambition claire de s'étendre à toute l'Afrique francophone, puis
          panafricaine.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {COUNTRIES.map((c, i) => {
          const isLive = LIVE_COUNTRY_CODES.has(c.code)
          return (
            <motion.div
              key={c.code}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.35, delay: i * 0.03, ease: 'easeOut' }}
              className={`flex items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-3 ${
                isLive ? 'border-pink-500' : 'border-violet-600/8'
              }`}
            >
              <span className="text-xl">{c.flag}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2B1D14]">{c.name}</p>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLive ? 'text-pink-500' : 'text-ink-soft/60'}`}>
                  {isLive ? 'Disponible' : 'Bientôt'}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

export default AvailabilitySection
