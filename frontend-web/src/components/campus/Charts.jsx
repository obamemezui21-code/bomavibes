import { useState } from 'react'
import { percent } from '../../lib/campus.js'

// Campus charts: one measure each, one hue, values read on hover, focus or in
// the table under "Voir les chiffres".

// Round steps for the axis: 0, 5, 10… always a whole number of students.
function ticks(max) {
  if (max <= 4) return Array.from({ length: Math.max(1, max) + 1 }, (_, i) => i)
  const raw = max / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw && Number.isInteger(s)) || Math.ceil(raw)
  const out = []
  for (let v = 0; v < max + step; v += step) out.push(v)
  return out
}

function Numbers({ head, rows }) {
  return (
    <details className="mt-3 text-xs text-ink-soft">
      <summary className="cursor-pointer font-semibold">Voir les chiffres</summary>
      <div className="mt-2 max-h-56 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} className="py-1 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums text-ink">
            {rows.map((r) => (
              <tr key={r[0]} className="border-t border-ink/8">
                {r.map((c, i) => (
                  <td key={i} className="py-1 pr-3">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// data: [{ key, label, long, value, extra }] — a count over time.
export function Columns({ data, unit, head }) {
  const [hover, setHover] = useState(null)
  if (!data.length) return <p className="py-8 text-center text-sm text-ink-soft">Aucune séance validée sur cette période.</p>
  const marks = ticks(Math.max(...data.map((d) => d.value)))
  const top = marks.at(-1)
  const highest = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0)
  // Labels under the columns, thinned out when there are many.
  const every = Math.ceil(data.length / 8)
  return (
    <div>
      <div className="relative flex h-44 pl-8" role="img" aria-label={`${head[1]} : ${data.map((d) => `${d.long} ${d.value}`).join(', ')}`}>
        {marks.map((v) => (
          <div key={v} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ bottom: `${(v / top) * 100}%`, height: 0 }}>
            <span className="w-7 pr-1.5 text-right text-[11px] tabular-nums text-ink-soft">{v}</span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>
        ))}
        {data.map((d, i) => (
          <button
            key={d.key}
            type="button"
            className="relative flex h-full flex-1 items-end justify-center outline-none"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${d.long} : ${d.value} ${unit}`}
          >
            <span className={`w-[70%] max-w-6 rounded-t bg-violet-500 transition-opacity ${hover !== null && hover !== i ? 'opacity-45' : ''}`} style={{ height: `${(d.value / top) * 100}%` }} />
            {hover === null && i === highest && d.value > 0 && (
              <span className="absolute text-[11px] font-semibold tabular-nums text-ink" style={{ bottom: `calc(${(d.value / top) * 100}% + 2px)` }}>
                {d.value}
              </span>
            )}
            {hover === i && (
              <span
                className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-ink/10 bg-surface px-2.5 py-1.5 text-left text-xs text-ink shadow-lg ${i < data.length / 3 ? 'left-0' : i > (data.length * 2) / 3 ? 'right-0' : ''}`}
                style={{ bottom: `calc(${Math.min(62, (d.value / top) * 100)}% + 6px)` }}
              >
                <b className="block font-semibold">
                  {d.value} {unit}
                </b>
                <span className="block text-ink-soft">{d.long}</span>
                {d.extra && <span className="block text-ink-soft">{d.extra}</span>}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex pl-8">
        {data.map((d, i) => (
          <span key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-ink-soft">
            {i % every === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <Numbers head={head} rows={data.map((d) => [d.long, d.value, d.extra || ''])} />
    </div>
  )
}

// data: [{ key, label, rate, extra, onClick }] — a rate per entity, 0 to 100 %.
export function RateBars({ data, head, empty = 'Aucune séance validée sur cette période.' }) {
  const [hover, setHover] = useState(null)
  if (!data.length) return <p className="py-8 text-center text-sm text-ink-soft">{empty}</p>
  return (
    <div>
      <ul className="space-y-2.5">
        {data.map((d) => {
          const Row = d.onClick ? 'button' : 'div'
          return (
            <li key={d.key} className="relative" onMouseEnter={() => setHover(d.key)} onMouseLeave={() => setHover(null)}>
              <Row {...(d.onClick ? { type: 'button', onClick: d.onClick } : {})} className={`block w-full text-left ${d.onClick ? 'rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-400' : ''}`}>
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{d.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">{percent(d.rate)}</span>
                </span>
                <span className="mt-1 block h-2.5 rounded-r bg-violet-500/12">
                  <span className="block h-full rounded-r bg-violet-500" style={{ width: `${(d.rate ?? 0) * 100}%` }} />
                </span>
                {(hover === d.key || d.showExtra) && d.extra && <span className="pointer-events-none absolute right-0 top-full z-10 mt-0.5 whitespace-nowrap rounded-lg border border-ink/10 bg-surface px-2.5 py-1 text-xs text-ink-soft shadow-lg">{d.extra}</span>}
              </Row>
            </li>
          )
        })}
      </ul>
      <Numbers head={head} rows={data.map((d) => [d.label, percent(d.rate), d.extra || ''])} />
    </div>
  )
}
