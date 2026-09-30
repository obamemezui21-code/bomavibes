import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, Clock, Download, RefreshCw, Search, Wallet, XCircle } from 'lucide-react'
import { fetchAdminPayments } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'

const PERIODS = [
  { id: '7', label: '7 j' },
  { id: '30', label: '30 j' },
  { id: '90', label: '90 j' },
  { id: '365', label: '12 mois' },
  { id: 'all', label: 'Tout' },
]

const STATUS = {
  paid: { label: 'Réussi', icon: CheckCircle2, className: 'bg-mint-500/15 text-mint-600' },
  failed: { label: 'Échoué', icon: XCircle, className: 'bg-coral-500/15 text-coral-600' },
  pending: { label: 'En attente', icon: Clock, className: 'bg-amber-500/15 text-amber-600' },
  expired: { label: 'Expiré', icon: Ban, className: 'bg-ink/8 text-ink-soft/70' },
}

const STATUS_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'paid', label: 'Réussies' },
  { id: 'failed', label: 'Échouées' },
  { id: 'pending', label: 'En attente' },
  { id: 'expired', label: 'Expirées' },
]

const PLAN_LABELS = { vip: 'VIP', diamant: 'Diamant Rouge', jade: 'Jadéite Impériale' }
const OPERATOR_LABELS = { airtel: 'Airtel Money', moov: 'Moov Money' }

const fcfa = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`

function formatDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function bucketLabel(date, granularity, long = false) {
  const d = new Date(`${granularity === 'month' ? `${date}-01` : date}T12:00:00Z`)
  if (granularity === 'month') return d.toLocaleDateString('fr-FR', { month: long ? 'long' : 'short', year: 'numeric' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}) })
}

function StatusChip({ status }) {
  const s = STATUS[status] || STATUS.pending
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.className}`}>
      <s.icon size={11} strokeWidth={2.5} />
      {s.label}
    </span>
  )
}

function Tile({ label, value, hint, loading }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="text-xs text-ink-soft/60">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">
        {loading ? <span className="inline-block h-5 w-20 animate-pulse rounded bg-ink/10" /> : value}
      </p>
      {hint && !loading && <p className="mt-0.5 text-[11px] text-ink-soft/50">{hint}</p>}
    </div>
  )
}

// Single-series revenue bars (one hue — magnitude only), recessive grid,
// per-bar hover/focus tooltip.
function RevenueChart({ series }) {
  const [active, setActive] = useState(null)
  const points = series.points
  const max = Math.max(...points.map((p) => p.revenue), 0)
  // Round the scale up to a readable step.
  const step = max <= 0 ? 1000 : 10 ** Math.floor(Math.log10(max))
  const top = Math.max(1000, Math.ceil(max / step) * step)
  const ticks = [top, top / 2, 0]
  const hovered = active !== null ? points[active] : null
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div>
      <div className="relative flex h-44 gap-2">
        <div className="flex w-14 shrink-0 flex-col justify-between text-right text-[10px] text-ink-soft/50">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t.toLocaleString('fr-FR')}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-ink/8" style={{ top: `${(1 - t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
            {points.map((p, i) => (
              <button
                key={p.date}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${bucketLabel(p.date, series.granularity, true)} : ${fcfa(p.revenue)}, ${p.paid} paiement(s)`}
                className="group flex h-full min-w-0 flex-1 items-end outline-none"
              >
                <span
                  className={`block w-full rounded-t-[4px] transition-colors ${
                    active === i ? 'bg-pink-600' : 'bg-pink-500 group-focus-visible:bg-pink-600'
                  }`}
                  style={{ height: p.revenue > 0 ? `max(${(p.revenue / top) * 100}%, 3px)` : 0 }}
                />
              </button>
            ))}
          </div>
          {hovered && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs text-surface shadow-lg"
              style={{ left: `${((active + 0.5) / points.length) * 100}%` }}
            >
              <p className="font-semibold">{bucketLabel(hovered.date, series.granularity, true)}</p>
              <p>
                {fcfa(hovered.revenue)} · {hovered.paid} paiement{hovered.paid > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="ml-16 mt-1 flex gap-[2px] text-[10px] text-ink-soft/50">
        {points.map((p, i) => (
          <span key={p.date} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {i % labelEvery === 0 ? bucketLabel(p.date, series.granularity) : ''}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs text-ink-soft/70">
        <summary className="cursor-pointer font-semibold">Voir les chiffres en tableau</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-ink-soft/50">
              <th className="py-1 font-medium">{series.granularity === 'month' ? 'Mois' : 'Jour'}</th>
              <th className="py-1 text-right font-medium">Paiements</th>
              <th className="py-1 text-right font-medium">Revenus</th>
            </tr>
          </thead>
          <tbody>
            {points
              .filter((p) => p.paid > 0)
              .map((p) => (
                <tr key={p.date} className="border-t border-ink/6 text-ink">
                  <td className="py-1">{bucketLabel(p.date, series.granularity, true)}</td>
                  <td className="py-1 text-right">{p.paid}</td>
                  <td className="py-1 text-right">{fcfa(p.revenue)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!points.some((p) => p.paid > 0) && <p className="mt-2">Aucun paiement réussi sur la période.</p>}
      </details>
    </div>
  )
}

// Label · revenue · thin magnitude bar (same hue for every row).
function Breakdown({ title, rows }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1)
  return (
    <div className="glass-panel rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-ink">{r.label}</span>
              <span className="font-semibold text-ink">{fcfa(r.revenue)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-ink/6">
              <div className="h-full rounded-full bg-pink-500" style={{ width: `${(r.revenue / max) * 100}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink-soft/50">
              {r.paid} réussi{r.paid > 1 ? 's' : ''} · {r.failed} échoué{r.failed > 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Byte-order mark so Excel opens the accented French text as UTF-8.
const BOM = String.fromCharCode(0xfeff)

function exportCsv(payments) {
  const header = ['Référence', 'Date', 'Statut', 'Forfait', 'Montant (FCFA)', 'Opérateur', 'Numéro', 'Prénom', 'E-mail', 'Raison échec', 'Statut SingPay']
  const rows = payments.map((p) => [
    p.reference,
    p.createdAt ? new Date(p.createdAt).toISOString() : '',
    STATUS[p.status]?.label || p.status,
    PLAN_LABELS[p.plan] || p.plan,
    p.amount,
    OPERATOR_LABELS[p.operator] || p.operator,
    p.msisdn,
    p.firstName || '',
    p.email || '',
    p.failureReason || '',
    p.singpayStatus || '',
  ])
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `bomavibes-paiements-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function PaymentRow({ p }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{p.firstName || p.email || p.uid}</p>
          {p.firstName && p.email && <p className="truncate text-xs text-ink-soft/50">{p.email}</p>}
        </div>
        <StatusChip status={p.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-ink">
          {PLAN_LABELS[p.plan] || p.plan} · {fcfa(p.amount)}
        </span>
        <span className="text-ink-soft/60">
          {OPERATOR_LABELS[p.operator] || p.operator} · {p.msisdn}
        </span>
      </div>
      {p.failureReason && <p className="mt-1 text-xs text-coral-600">{p.failureReason}</p>}
      <p className="mt-1 text-[11px] text-ink-soft/50">
        {formatDate(p.createdAt)} · <span className="font-mono">{p.reference}</span>
        {p.singpayStatus && <> · SingPay : {p.singpayStatus}</>}
      </p>
    </div>
  )
}

function AdminPayments() {
  const { showToast } = useToast()
  const [period, setPeriod] = useState('30')
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')

  const load = useCallback(() => {
    setIsLoading(true)
    fetchAdminPayments(period)
      .then(setData)
      .catch(() => showToast('Impossible de charger les paiements.', 'error'))
      .finally(() => setIsLoading(false))
  }, [period, showToast])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.payments || []).filter(
      (p) =>
        (statusFilter === 'all' || p.status === statusFilter) &&
        (!q || [p.firstName, p.email, p.msisdn, p.reference].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [data, statusFilter, query])

  const s = data?.summary
  const loading = isLoading && !data

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
          <Wallet size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold text-ink">Paiements</h1>
          <p className="text-xs text-ink-soft/60">Revenus et transactions Mobile Money (SingPay)</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/6 text-ink-soft/70 transition hover:bg-ink/10 disabled:opacity-50"
          aria-label="Actualiser"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              period === p.id ? 'bg-ink text-surface' : 'bg-ink/6 text-ink-soft/70 hover:bg-ink/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="glass-panel mb-3 rounded-2xl p-5">
        <p className="text-xs text-ink-soft/60">Revenus sur la période</p>
        <p className="mt-1 font-display text-3xl font-bold text-ink">
          {loading ? <span className="inline-block h-8 w-40 animate-pulse rounded bg-ink/10" /> : fcfa(s?.revenue)}
        </p>
        {!loading && s && (
          <p className="mt-1 text-xs text-ink-soft/60">
            {s.paid} paiement{s.paid > 1 ? 's' : ''} réussi{s.paid > 1 ? 's' : ''} · panier moyen {fcfa(s.averageBasket)} · {s.payingUsers}{' '}
            client{s.payingUsers > 1 ? 's' : ''} payant{s.payingUsers > 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 desktop:grid-cols-3">
        <Tile loading={loading} label="Aujourd'hui" value={fcfa(s?.revenueToday)} />
        <Tile loading={loading} label="Ce mois-ci" value={fcfa(s?.revenueThisMonth)} />
        <Tile
          loading={loading}
          label="Revenu mensuel estimé"
          value={fcfa(s?.monthlyRecurring)}
          hint="Abonnés actifs × prix du forfait"
        />
        <Tile
          loading={loading}
          label="Abonnés actifs"
          value={s?.activeSubscribers ?? '—'}
          hint={s && `VIP ${s.activeByPlan.vip} · Diamant ${s.activeByPlan.diamant} · Jade ${s.activeByPlan.jade}`}
        />
        <Tile
          loading={loading}
          label="Taux de réussite"
          value={s?.successRate == null ? '—' : `${Math.round(s.successRate * 100)} %`}
          hint={s && `${s.paid} réussis · ${s.failed + s.expired} échoués`}
        />
        <Tile loading={loading} label="En attente" value={s?.pending ?? '—'} hint="Validation sur le téléphone" />
      </div>

      {data && (
        <>
          <div className="glass-panel mb-3 rounded-2xl p-4">
            <h3 className="mb-4 text-sm font-semibold text-ink">
              Revenus par {data.series.granularity === 'month' ? 'mois' : 'jour'}
            </h3>
            <RevenueChart series={data.series} />
          </div>

          <div className="mb-3 grid gap-3 desktop:grid-cols-2">
            <Breakdown title="Par forfait" rows={data.byPlan} />
            <Breakdown title="Par opérateur" rows={data.byOperator.map((o) => ({ ...o, label: OPERATOR_LABELS[o.id] || o.id }))} />
          </div>

          {data.failureReasons.length > 0 && (
            <div className="glass-panel mb-6 rounded-2xl p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">Raisons des échecs</h3>
              <ul className="space-y-1.5 text-xs">
                {data.failureReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-2">
                    <span className="text-ink-soft/80">{r.reason}</span>
                    <span className="font-semibold text-ink">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">Transactions</h2>
            <button
              type="button"
              onClick={() => exportCsv(visible)}
              disabled={visible.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-ink/6 px-3 py-1.5 text-xs font-semibold text-ink-soft/80 transition hover:bg-ink/10 disabled:opacity-50"
            >
              <Download size={13} />
              Exporter (CSV)
            </button>
          </div>

          <div className="mb-2 flex items-center gap-2 rounded-xl bg-ink/6 px-3">
            <Search size={14} className="text-ink-soft/50" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, e-mail, numéro ou référence"
              className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/40"
            />
          </div>
          <div className="mb-3 flex gap-1 overflow-x-auto">
            {STATUS_FILTERS.map((f) => {
              const count = f.id === 'all' ? data.payments.length : data.payments.filter((p) => p.status === f.id).length
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === f.id ? 'bg-ink text-surface' : 'bg-ink/6 text-ink-soft/70 hover:bg-ink/10'
                  }`}
                >
                  {f.label} ({count})
                </button>
              )
            })}
          </div>

          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft/50">Aucune transaction.</p>
          ) : (
            <div className="space-y-2">
              {visible.map((p) => (
                <PaymentRow key={p.reference} p={p} />
              ))}
            </div>
          )}
          {data.payments.length < s.total && (
            <p className="mt-3 text-center text-[11px] text-ink-soft/50">
              Seules les {data.payments.length} dernières transactions de la période sont listées ({s.total} au total).
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default AdminPayments
