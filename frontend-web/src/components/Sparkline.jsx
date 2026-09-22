import { useId, useState } from 'react'

const DAY_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

function formatDay(iso) {
  return DAY_FORMATTER.format(new Date(`${iso}T00:00:00`))
}

// A single-metric trend sparkline: one hue (sequential, not categorical), so
// no legend is needed — the card's own label already names the series. The
// most recent day carries the full accent color, older days are the same
// hue de-emphasized. There are no axis labels, so each bar is its own hit
// target with a hover/focus tooltip carrying the exact day and value.
function Sparkline({ data, accentClass, dimClass, unit = '' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const tooltipId = useId()
  const max = Math.max(1, ...data.map((d) => d.value))
  const lastIndex = data.length - 1

  return (
    <div
      className="mt-3 flex h-10 items-end gap-[2px]"
      role="img"
      aria-label={`Tendance sur ${data.length} jours : ${data.map((d) => `${formatDay(d.date)} ${d.value}`).join(', ')}`}
    >
      {data.map((point, i) => {
        const heightPct = point.value > 0 ? Math.max((point.value / max) * 100, 6) : 0
        const isHovered = hoveredIndex === i
        return (
          <div key={point.date} className="relative h-full min-w-0 flex-1">
            {isHovered && (
              <div
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-surface shadow-lg"
              >
                {point.value}
                {unit} · {formatDay(point.date)}
              </div>
            )}
            <button
              type="button"
              aria-describedby={isHovered ? tooltipId : undefined}
              aria-label={`${formatDay(point.date)} : ${point.value}${unit}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(i)}
              onBlur={() => setHoveredIndex(null)}
              className="flex h-full w-full flex-col items-center justify-end"
            >
              <span
                className={`w-full max-w-[24px] rounded-t-[4px] transition-colors ${i === lastIndex ? accentClass : dimClass}`}
                style={{ height: `${heightPct}%` }}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default Sparkline
