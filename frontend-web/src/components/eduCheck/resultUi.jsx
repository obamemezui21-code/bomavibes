import { motion, useReducedMotion } from 'framer-motion'
import { LEVEL_TONES } from '../../lib/eduCheckShared.js'

// The visual pieces of the EDU-CHECK report (AnalysisResult.jsx): the dark
// "console" header, the three AI engines' meters, the ring gauges.
// Colours are fixed (not theme tokens) on the console: it is dark in both
// themes, like an instrument panel.

/** A ring gauge, 0–100, its value drawn in once. */
export function Ring({ value, color = '#ad52ec', size = 64, stroke = 6, children, track = 'currentColor' }) {
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value ?? 0))
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeOpacity=".12" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - v / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - v / 100) }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}

/** Three segments lit up to the level: faible, modérée, élevée. */
export function LevelMeter({ level }) {
  const reduce = useReducedMotion()
  const t = LEVEL_TONES[level] || LEVEL_TONES.off
  return (
    <span className="flex gap-1.5" role="img" aria-label={t.label}>
      {[1, 2, 3].map((s) => {
        const on = t.step >= s
        return (
          <motion.span
            key={s}
            className="h-1.5 flex-1 rounded-full"
            initial={{ opacity: reduce ? 1 : 0.2, scaleX: reduce ? 1 : 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: reduce ? 0 : 0.25 + s * 0.12, duration: reduce ? 0 : 0.4 }}
            style={{ background: on ? t.color : 'rgba(255,255,255,.1)', boxShadow: on ? `0 0 10px ${t.glow}` : 'none', transformOrigin: 'left' }}
          />
        )
      })}
    </span>
  )
}

/** A live-looking status dot. */
export function Dot({ color, pulse = false }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: color }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
    </span>
  )
}

/** The console: dark glass with a fine grid and a slow scan line. */
export function Console({ children, className = '' }) {
  const reduce = useReducedMotion()
  return (
    <section className={`relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0614] text-white shadow-2xl shadow-violet-950/30 ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[.35]"
        style={{
          backgroundImage: 'linear-gradient(rgba(173,82,236,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(173,82,236,.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at 30% 0%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 30% 0%, black 30%, transparent 75%)',
        }}
      />
      <div className="pointer-events-none absolute -left-24 -top-32 -z-10 h-80 w-80 rounded-full bg-[#7b1fa2] opacity-40 blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 top-10 -z-10 h-64 w-64 rounded-full bg-[#d3187f] opacity-25 blur-[90px]" />
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 -z-10 h-24 bg-gradient-to-b from-transparent via-[#ad52ec]/10 to-transparent"
          initial={{ top: '-15%' }}
          animate={{ top: '110%' }}
          transition={{ duration: 2.6, ease: 'easeInOut', delay: 0.2 }}
        />
      )}
      {children}
    </section>
  )
}

/** One of the three AI engines, on the console. */
export function EngineCard({ letter, title, kicker, level, value, engine, note, children, active, onClick, index = 0 }) {
  const reduce = useReducedMotion()
  const t = LEVEL_TONES[level] || LEVEL_TONES.off
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : 0.1 + index * 0.1, duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex min-w-0 flex-col rounded-3xl border p-4 text-left backdrop-blur-md transition ${active ? 'border-white/30 bg-white/[.09]' : 'border-white/10 bg-white/[.04] hover:border-white/20 hover:bg-white/[.07]'}`}
      style={{ boxShadow: active ? `0 0 0 1px ${t.color}55, 0 12px 40px -12px ${t.glow}` : undefined }}
    >
      <span className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5 font-mono text-xs font-bold text-white/80">{letter}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">{title}</span>
          <span className="block truncate text-[11px] text-white/45">{kicker}</span>
        </span>
      </span>
      <span className="mt-4 flex items-end justify-between gap-2">
        <span className="font-display text-xl font-black leading-tight" style={{ color: t.color, textShadow: `0 0 18px ${t.glow}` }}>
          {value || t.label}
        </span>
        {children}
      </span>
      <span className="mt-3 block">
        <LevelMeter level={level} />
      </span>
      <span className="mt-3 flex items-center gap-1.5 text-[11px] text-white/50">
        <Dot color={t.color} pulse={level === 'elevee'} />
        <span className="truncate">{engine}</span>
      </span>
      {note && <span className="mt-1 block text-[11px] leading-snug text-white/40">{note}</span>}
      <span className="mt-3 text-[11px] font-semibold text-[#d9a6ff] opacity-80 group-hover:opacity-100">{active ? 'Masquer le détail' : 'Voir le détail →'}</span>
    </motion.button>
  )
}

/** A metric tile (quality, coherence…), on the page. */
export function MetricTile({ icon: Icon, title, value, ring, ringColor, sub, active, onClick, index = 0 }) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : 0.35 + index * 0.06, duration: reduce ? 0 : 0.4 }}
      className={`group flex min-w-0 items-center gap-3 rounded-3xl border p-3.5 text-left transition ${active ? 'border-violet-400 bg-violet-600/[.06] shadow-lg shadow-violet-600/10' : 'border-ink/8 bg-surface hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md'}`}
    >
      {ring != null ? (
        <Ring value={ring} color={ringColor} size={58} stroke={5} track="var(--color-ink)">
          <span className="font-display text-sm font-black text-ink">{Math.round(ring)}</span>
        </Ring>
      ) : (
        <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-violet-600/10 text-violet-600">
          <Icon size={22} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
          <Icon size={13} className="text-violet-600" /> <span className="truncate">{title}</span>
        </span>
        <span className="mt-0.5 block truncate font-display text-lg font-black text-ink">{value}</span>
        {sub && <span className="block truncate text-xs text-ink-soft">{sub}</span>}
      </span>
    </motion.button>
  )
}
