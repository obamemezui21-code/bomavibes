import { CONTINENT_ORDER, COUNTRIES } from '../lib/geography.js'
import FlagIcon from './FlagIcon.jsx'
import SearchSelect from './SearchSelect.jsx'

const flag = (code) => <FlagIcon code={code} className="!h-3.5 !w-5 shrink-0 rounded-sm" />

// Grouped by continent in CONTINENT_ORDER. Flags are CSS backgrounds
// (flag-icons): SearchSelect's rows use content-visibility so only the
// flags scrolled into view get fetched.
const COUNTRY_OPTIONS = CONTINENT_ORDER.flatMap((continent) =>
  COUNTRIES.filter((c) => c.continent === continent).map((c) => ({
    value: c.code,
    label: c.name,
    group: continent,
    icon: flag(c.code),
  })),
)

// A field opening a searchable list of countries.
function CountryPicker({ id, value, onSelect }) {
  return (
    <SearchSelect
      id={id}
      value={value}
      options={COUNTRY_OPTIONS}
      onSelect={onSelect}
      title="Choisir un pays"
      placeholder="Choisir un pays"
      searchPlaceholder="Rechercher un pays…"
    />
  )
}

export default CountryPicker
