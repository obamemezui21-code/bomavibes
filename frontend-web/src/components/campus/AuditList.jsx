import { dateTime, describeAudit } from '../../lib/campus.js'
import { Empty } from './campusUi.jsx'

// Lines of the log: what, old value → new value, who, when, why.
function AuditList({ entries, empty = 'Aucun événement.' }) {
  if (!entries.length) return <Empty>{empty}</Empty>
  return (
    <ol className="divide-y divide-ink/8">
      {entries.map((e) => {
        const { title, lines } = describeAudit(e)
        return (
          <li key={e.id} className="py-3 text-sm">
            <p className="font-semibold text-ink">{title}</p>
            {lines.map((l, i) => (
              <p key={i} className="text-ink">
                {l}
              </p>
            ))}
            {e.reason && <p className="text-ink-soft">Motif : {e.reason}</p>}
            <p className="mt-0.5 text-xs text-ink-soft">
              {e.by?.name} · {dateTime(e.at)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

export default AuditList
