import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CONTINENT_ORDER, COUNTRIES, findCountry } from '../lib/geography.js'
import { chipClass } from '../lib/formStyles.js'
import FlagIcon from './FlagIcon.jsx'

// Countries render behind a per-continent accordion instead of all ~190 at
// once — each used a real flag-icons SVG (not lazy-loadable, since FlagIcon
// renders a CSS background-image, not an <img>), so mounting the old flat
// list fired ~190 flag requests immediately. Only the open continent's
// flags load now; the continent holding the current selection opens by
// default so an existing choice stays visible without an extra click.
function CountryPicker({ value, onSelect, className = '' }) {
  const selectedContinent = value ? findCountry(value)?.continent : null
  const [openContinent, setOpenContinent] = useState(selectedContinent || CONTINENT_ORDER[0])

  return (
    <div className={className}>
      {CONTINENT_ORDER.map((continent) => {
        const isOpen = openContinent === continent
        return (
          <div key={continent} className="mb-3 last:mb-0">
            <button
              type="button"
              onClick={() => setOpenContinent(isOpen ? null : continent)}
              className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold uppercase tracking-wide text-ink-soft/50"
            >
              {continent}
              <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="mt-2 flex flex-wrap gap-2">
                {COUNTRIES.filter((c) => c.continent === continent).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onSelect(c.code)}
                    className={chipClass(value === c.code)}
                  >
                    <FlagIcon code={c.code} className="mr-1.5 !h-3.5 !w-5 rounded-sm" />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default CountryPicker
