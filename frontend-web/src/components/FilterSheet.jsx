import { motion } from 'framer-motion'

const GENDER_OPTIONS = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'FEMME', label: 'Femmes' },
  { value: 'HOMME', label: 'Hommes' },
]

function FilterSheet({ filters, onChange, onClose, onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-sm rounded-t-[28px] p-6 md:rounded-[28px]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-cream-100">Filtres</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-cream-300 hover:bg-white/5"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-cream-200">
              Âge : {filters.minAge} – {filters.maxAge} ans
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="18"
                max="60"
                value={filters.minAge}
                onChange={(e) =>
                  onChange({ ...filters, minAge: Math.min(Number(e.target.value), filters.maxAge) })
                }
                className="flex-1 accent-gold-400"
              />
              <input
                type="range"
                min="18"
                max="60"
                value={filters.maxAge}
                onChange={(e) =>
                  onChange({ ...filters, maxAge: Math.max(Number(e.target.value), filters.minAge) })
                }
                className="flex-1 accent-gold-400"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-cream-200">
              Distance maximale : {filters.maxDistance} km
            </p>
            <input
              type="range"
              min="1"
              max="50"
              value={filters.maxDistance}
              onChange={(e) => onChange({ ...filters, maxDistance: Number(e.target.value) })}
              className="w-full accent-gold-400"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-cream-200">Genre</p>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...filters, gender: opt.value })}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    filters.gender === opt.value
                      ? 'border-gold-400/60 bg-gold-400/10 text-gold-400'
                      : 'border-white/10 text-cream-300/70 hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-cream-200 transition hover:bg-white/5"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 py-2.5 text-sm font-semibold text-forest-950 shadow-lg shadow-gold-500/20"
          >
            Appliquer
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default FilterSheet
