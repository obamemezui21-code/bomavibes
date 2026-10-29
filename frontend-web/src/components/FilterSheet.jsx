import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  AGE_RANGE,
  DISTANCE_MAX_KM,
  HEIGHT_RANGE,
  SORTS,
  activeFilterCount,
} from '../lib/discoverFilters.js'
import { DATING_GOALS, EDUCATION_LEVELS, LANGUAGES, RELATIONSHIP_STATUSES, RELIGIONS } from '../lib/onboardingOptions.js'
import { INTEREST_ICONS } from '../lib/interests.js'
import { CONTINENT_ORDER, COUNTRIES } from '../lib/geography.js'

const GENDER_OPTIONS = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'FEMME', label: 'Femmes' },
  { value: 'HOMME', label: 'Hommes' },
]
const ACTIVITY_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'online', label: 'En ligne maintenant' },
  { value: 'recent', label: 'Actifs récemment' },
]
const HEIGHTS = Array.from({ length: (HEIGHT_RANGE[1] - HEIGHT_RANGE[0]) / 5 + 1 }, (_, i) => HEIGHT_RANGE[0] + i * 5)
const INTERESTS_SHOWN = 12

const fieldClass =
  'w-full rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:bg-surface-tint'

function Section({ title, hint, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="-mt-1 text-[11px] text-ink-soft/60">{hint}</p>}
      {children}
    </section>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? 'border-violet-500 bg-violet-500 text-white' : 'border-ink/12 text-ink-soft/80 hover:bg-ink/5'
      }`}
    >
      {children}
    </button>
  )
}

// One choice among a few (gender, activity, sort).
function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition ${
            value === opt.value ? 'border-violet-400 bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Several choices: the profile matches any of them.
function MultiChips({ options, values, onChange }) {
  const toggle = (option) => onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip key={option} active={values.includes(option)} onClick={() => toggle(option)}>
          {option}
        </Chip>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-[11px] text-ink-soft/60">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-violet-600"
      />
    </label>
  )
}

// Discover's filters (lib/discoverFilters.js). Scrolls on small screens, with
// Réinitialiser / Appliquer always visible at the bottom.
function FilterSheet({ filters, onChange, onClose, onReset }) {
  const ids = useId()
  const [allInterests, setAllInterests] = useState(false)
  const set = (changes) => onChange({ ...filters, ...changes })
  const count = activeFilterCount(filters)
  const interests = Object.keys(INTEREST_ICONS)
  // Chosen interests stay visible when the list is folded.
  const shownInterests = allInterests
    ? interests
    : [...new Set([...filters.interests, ...interests.slice(0, INTERESTS_SHOWN)])]

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
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        className="glass-panel flex max-h-[92svh] w-full max-w-md flex-col rounded-t-[28px] md:max-h-[88svh] md:rounded-[28px]"
      >
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h2 id={`${ids}-title`} className="font-display text-xl font-semibold text-ink">
            Filtres{count > 0 && <span className="ml-2 text-sm font-medium text-violet-600">{count} actif{count > 1 ? 's' : ''}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 pb-6">
          <Section title="Trier par">
            <Segmented label="Trier par" options={SORTS} value={filters.sort} onChange={(sort) => set({ sort })} />
          </Section>

          <Section title={`Âge : ${filters.minAge} – ${filters.maxAge}${filters.maxAge === AGE_RANGE[1] ? '+' : ''} ans`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={AGE_RANGE[0]}
                max={AGE_RANGE[1]}
                value={filters.minAge}
                aria-label="Âge minimum"
                onChange={(e) => set({ minAge: Math.min(Number(e.target.value), filters.maxAge) })}
                className="flex-1 accent-violet-500"
              />
              <input
                type="range"
                min={AGE_RANGE[0]}
                max={AGE_RANGE[1]}
                value={filters.maxAge}
                aria-label="Âge maximum"
                onChange={(e) => set({ maxAge: Math.max(Number(e.target.value), filters.minAge) })}
                className="flex-1 accent-violet-500"
              />
            </div>
          </Section>

          <Section title="Genre">
            <Segmented label="Genre" options={GENDER_OPTIONS} value={filters.gender} onChange={(gender) => set({ gender })} />
          </Section>

          <Section
            title={filters.maxDistanceKm == null ? 'Distance : peu importe' : `Distance : jusqu’à ${filters.maxDistanceKm} km`}
            hint="Depuis ta position si tu l’as activée, sinon depuis ta ville. Les profils dont la distance est inconnue sont alors masqués."
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max={DISTANCE_MAX_KM}
                value={filters.maxDistanceKm ?? DISTANCE_MAX_KM}
                aria-label="Distance maximale en kilomètres"
                onChange={(e) => set({ maxDistanceKm: Number(e.target.value) })}
                className="flex-1 accent-violet-500"
              />
              <Chip active={filters.maxDistanceKm == null} onClick={() => set({ maxDistanceKm: null })}>
                Peu importe
              </Chip>
            </div>
          </Section>

          <Section title="Activité">
            <Segmented label="Activité" options={ACTIVITY_OPTIONS} value={filters.activity} onChange={(activity) => set({ activity })} />
          </Section>

          <Section title="Lieu">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={filters.city}
                onChange={(e) => set({ city: e.target.value })}
                placeholder="Ville"
                aria-label="Ville"
                maxLength={60}
                className={fieldClass}
              />
              <input
                type="text"
                value={filters.neighborhood}
                onChange={(e) => set({ neighborhood: e.target.value })}
                placeholder="Quartier"
                aria-label="Quartier"
                maxLength={60}
                className={fieldClass}
              />
            </div>
            <select value={filters.country} onChange={(e) => set({ country: e.target.value })} aria-label="Pays" className={fieldClass}>
              <option value="">Tous les pays</option>
              {CONTINENT_ORDER.map((continent) => (
                <optgroup key={continent} label={continent}>
                  {COUNTRIES.filter((c) => c.continent === continent).map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Section>

          <Section title="Taille" hint="Les profils sans taille indiquée sont alors masqués.">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.minHeight ?? ''}
                onChange={(e) => set({ minHeight: e.target.value ? Number(e.target.value) : null })}
                aria-label="Taille minimum"
                className={fieldClass}
              >
                <option value="">Min : indifférent</option>
                {HEIGHTS.map((h) => (
                  <option key={h} value={h} disabled={filters.maxHeight != null && h > filters.maxHeight}>
                    {h} cm
                  </option>
                ))}
              </select>
              <select
                value={filters.maxHeight ?? ''}
                onChange={(e) => set({ maxHeight: e.target.value ? Number(e.target.value) : null })}
                aria-label="Taille maximum"
                className={fieldClass}
              >
                <option value="">Max : indifférent</option>
                {HEIGHTS.map((h) => (
                  <option key={h} value={h} disabled={filters.minHeight != null && h < filters.minHeight}>
                    {h} cm
                  </option>
                ))}
              </select>
            </div>
          </Section>

          <Section title="Type de rencontre recherchée">
            <MultiChips options={DATING_GOALS} values={filters.goals} onChange={(goals) => set({ goals })} />
          </Section>

          <Section title="Situation amoureuse">
            <MultiChips
              options={RELATIONSHIP_STATUSES}
              values={filters.relationshipStatuses}
              onChange={(relationshipStatuses) => set({ relationshipStatuses })}
            />
          </Section>

          <Section title="Centres d’intérêt" hint="Au moins un en commun avec ta sélection.">
            <MultiChips options={shownInterests} values={filters.interests} onChange={(chosen) => set({ interests: chosen })} />
            {interests.length > INTERESTS_SHOWN && (
              <button
                type="button"
                onClick={() => setAllInterests((v) => !v)}
                className="text-xs font-semibold text-violet-600 underline underline-offset-2"
              >
                {allInterests ? 'Voir moins' : `Voir les ${interests.length} centres d’intérêt`}
              </button>
            )}
          </Section>

          <Section title="Langues parlées">
            <MultiChips options={LANGUAGES} values={filters.languages} onChange={(languages) => set({ languages })} />
          </Section>

          <Section title="Religion (optionnel)">
            <select value={filters.religion} onChange={(e) => set({ religion: e.target.value })} aria-label="Religion" className={fieldClass}>
              <option value="">Toutes</option>
              {RELIGIONS.map((religion) => (
                <option key={religion} value={religion}>
                  {religion}
                </option>
              ))}
            </select>
          </Section>

          <Section title="Études et profession">
            <MultiChips options={EDUCATION_LEVELS} values={filters.educations} onChange={(educations) => set({ educations })} />
            <input
              type="text"
              value={filters.job}
              onChange={(e) => set({ job: e.target.value })}
              placeholder="Profession ou employeur (ex. infirmière, Total…)"
              aria-label="Profession ou employeur"
              maxLength={60}
              className={fieldClass}
            />
          </Section>

          <Section title="Profils">
            <div className="divide-y divide-ink/6">
              <Toggle checked={filters.withPhotoOnly} onChange={(withPhotoOnly) => set({ withPhotoOnly })} label="Avec photo uniquement" />
              <Toggle checked={filters.verifiedOnly} onChange={(verifiedOnly) => set({ verifiedOnly })} label="Vérifiés uniquement" />
              <Toggle checked={filters.newOnly} onChange={(newOnly) => set({ newOnly })} label="Nouveaux membres" hint="Inscrits ces 7 derniers jours" />
              <Toggle checked={filters.travelingOnly} onChange={(travelingOnly) => set({ travelingOnly })} label="En voyage" />
            </div>
          </Section>
        </div>

        <div className="flex gap-3 border-t border-ink/8 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25"
          >
            Appliquer
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default FilterSheet
