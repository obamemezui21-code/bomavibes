import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Globe2 } from 'lucide-react'
import { createGlobeScene } from './globeScene.js'
import { coordsForProfile } from '../../lib/nearby.js'
import { fallbackToFullPhoto, photoVariant } from '../../lib/photoVariants.js'
import { fallbackAvatar } from '../../lib/fallbackAvatar.js'
import { ageSuffix } from '../../lib/profileDisplay.js'

const SHOWN = 12
const RECENT_MS = 30 * 24 * 60 * 60 * 1000
const ONLINE_MS = 150 * 1000 // same threshold as the chat's "En ligne"
const CLUSTER_DEG = 6

function avatarFor(profile) {
  return photoVariant(profile.photos?.[0], 'thumb') || fallbackAvatar(profile.firstName || profile.id)
}

function activityLabel(lastActiveAt, now) {
  const diff = now - lastActiveAt
  if (diff < ONLINE_MS) return 'En ligne'
  const min = Math.round(diff / 60000)
  if (min < 60) return `Actif·ve il y a ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `Actif·ve il y a ${hours} h`
  return `Actif·ve il y a ${Math.round(hours / 24)} j`
}

// The most recently active members, grouped per city (a city's centre only,
// as on the "Autour de moi" map: never anyone's real position). Members who
// hide their distance aren't placed on the globe.
function activeGroups(profiles, now) {
  const active = profiles
    .filter((p) => p.lastActiveAt && now - p.lastActiveAt < RECENT_MS && !p.hideDistance && coordsForProfile(p))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .slice(0, SHOWN)
  const cities = new Map()
  for (const p of active) {
    const [lat, lng] = coordsForProfile(p)
    const key = `${lat},${lng}`
    if (!cities.has(key)) cities.set(key, { key, city: p.city, lat, lng, profiles: [] })
    cities.get(key).profiles.push(p)
  }
  // On the globe a pin covers about 10° of latitude: cities closer than
  // CLUSTER_DEG share one pin (on the most active of them), or their pins would
  // pile up and hide each other. Each city keeps its own pulse on the globe.
  const groups = []
  for (const c of cities.values()) {
    const near = groups.find((g) => Math.hypot(g.lat - c.lat, (g.lng - c.lng) * Math.cos((g.lat * Math.PI) / 180)) < CLUSTER_DEG)
    if (near) {
      near.cities.push(c.city)
      near.profiles.push(...c.profiles)
    } else {
      groups.push({ key: c.key, city: c.city, cities: [c.city], lat: c.lat, lng: c.lng, profiles: [...c.profiles] })
    }
  }
  for (const g of groups) {
    if (g.cities.length > 1) g.label = `${g.city} et ${g.cities.length - 1} autre${g.cities.length > 2 ? 's' : ''} ville${g.cities.length > 2 ? 's' : ''}`
    else g.label = g.city
  }
  return { active, cities: [...cities.values()], groups }
}

// "Les plus actifs": a slowly turning globe of glowing dots, the most active
// members pinned on their city, light running along arcs from your city to
// theirs. Drag it to turn it; tap a city to bring it in front. Under it (on a
// computer, beside it) the same members in a list, each opening their profile.
// No WebGL: the list alone. No active member with a known city: nothing.
function ActiveGlobe({ profiles, me, onOpenProfile }) {
  const reducedMotion = useReducedMotion()
  const [now] = useState(() => Date.now())
  const { active, cities, groups } = useMemo(() => activeGroups(profiles, now), [profiles, now])
  const home = useMemo(() => coordsForProfile(me), [me])
  const [selectedKey, setSelectedKey] = useState(null)
  const [failed, setFailed] = useState(false)
  const stage = useRef(null)
  const pins = useRef(new Map())
  const scene = useRef(null)

  const groupsKey = cities.map((c) => `${c.key}:${c.profiles.length}`).join('|')

  useEffect(() => {
    if (!stage.current || !groups.length) return undefined
    let handle
    try {
      handle = createGlobeScene(stage.current, {
        cities,
        groups,
        home,
        pins: pins.current,
        reducedMotion: !!reducedMotion,
      })
    } catch {
      setFailed(true)
      return undefined
    }
    scene.current = handle
    return () => {
      handle.dispose()
      scene.current = null
    }
    // groupsKey stands for groups: the scene is only rebuilt when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey, home?.[0], home?.[1], reducedMotion])

  if (!groups.length) return null

  const online = active.filter((p) => now - p.lastActiveAt < ONLINE_MS).length
  const selected = groups.find((g) => g.key === selectedKey)
  const listed = selected ? selected.profiles : active

  function select(group) {
    setSelectedKey((key) => (key === group.key ? null : group.key))
    scene.current?.focus(group.lat, group.lng)
  }

  return (
    <section aria-labelledby="active-globe-title" className="mb-6 w-full">
      <div className="px-1">
        <h2 id="active-globe-title" className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
          <Globe2 size={17} strokeWidth={2.25} className="text-violet-600" />
          Les plus actifs en ce moment
        </h2>
        <p className="text-xs text-ink-soft/60">
          {online > 0 && <span className="font-semibold text-mint-600">{online} en ligne · </span>}
          {active.length} membre{active.length > 1 ? 's' : ''} dans {cities.length} ville{cities.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-[24px] bg-[#0d0420] text-white shadow-xl shadow-violet-900/25 desktop:grid desktop:h-[460px] desktop:grid-cols-[minmax(0,1fr)_300px]">
        <p className="pointer-events-none absolute bottom-2 left-4 z-20 hidden text-[10px] text-white/40 desktop:block">Position par ville uniquement</p>
        {/* Night sky behind the globe */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(124,58,237,0.35),transparent_60%),radial-gradient(ellipse_at_80%_90%,rgba(233,70,125,0.25),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(1px_1px_at_12%_18%,#fff,transparent),radial-gradient(1px_1px_at_72%_12%,#fff,transparent),radial-gradient(1.5px_1.5px_at_88%_42%,#fde68a,transparent),radial-gradient(1px_1px_at_22%_78%,#fff,transparent),radial-gradient(1px_1px_at_55%_88%,#fff,transparent),radial-gradient(1.5px_1.5px_at_8%_55%,#f9a8d4,transparent),radial-gradient(1px_1px_at_40%_8%,#fff,transparent),radial-gradient(1px_1px_at_95%_75%,#fff,transparent)]" />

        {!failed && (
          <div ref={stage} className="relative h-[340px] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing desktop:h-full">
            {groups.map((g) => {
              const hasOnline = g.profiles.some((p) => now - p.lastActiveAt < ONLINE_MS)
              const isSelected = g.key === selectedKey
              return (
                <button
                  key={g.key}
                  type="button"
                  ref={(el) => (el ? pins.current.set(g.key, el) : pins.current.delete(g.key))}
                  onClick={() => select(g)}
                  aria-label={`${g.label} : ${g.profiles.length} membre${g.profiles.length > 1 ? 's' : ''} actif${g.profiles.length > 1 ? 's' : ''}`}
                  aria-pressed={isSelected}
                  style={{ opacity: 0 }}
                  className="group absolute left-0 top-0 z-10 flex flex-col items-center will-change-transform"
                >
                  <span className={`relative flex items-center rounded-full p-0.5 transition ${isSelected ? 'bg-gold shadow-[0_0_18px_rgba(250,204,21,0.7)]' : 'bg-white/90 shadow-[0_0_14px_rgba(233,70,125,0.6)]'} group-hover:scale-110`}>
                    {g.profiles.slice(0, 3).map((p, i) => (
                      <img
                        key={p.id}
                        src={avatarFor(p)}
                        onError={p.photos?.[0] ? fallbackToFullPhoto(p.photos[0]) : undefined}
                        alt=""
                        draggable={false}
                        className={`h-8 w-8 rounded-full border-2 border-[#0d0420] bg-violet-100 object-cover ${i ? '-ml-3' : ''}`}
                      />
                    ))}
                    {g.profiles.length > 3 && (
                      <span className="-ml-2 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-[#0d0420] bg-violet-600 px-1 text-[10px] font-bold">
                        +{g.profiles.length - 3}
                      </span>
                    )}
                    {hasOnline && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0d0420] bg-mint-500" />}
                  </span>
                  <span className={`mt-1 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold transition ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {g.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="relative border-t border-white/10 p-3 desktop:flex desktop:min-h-0 desktop:flex-col desktop:border-l desktop:border-t-0 desktop:bg-black/20 desktop:p-4">
          <div className="flex items-center justify-between px-1">
            <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">{selected ? selected.label : 'Les plus actifs'}</p>
            {selected && (
              <button type="button" onClick={() => setSelectedKey(null)} className="text-[11px] font-semibold text-white/60 hover:text-white">
                Tout le monde
              </button>
            )}
          </div>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] desktop:min-h-0 desktop:flex-1 desktop:flex-col desktop:overflow-y-auto desktop:overflow-x-hidden [&::-webkit-scrollbar]:hidden">
            {listed.map((p) => {
              const isOnline = now - p.lastActiveAt < ONLINE_MS
              return (
                <li key={p.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(p)}
                    className="flex w-40 items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2 text-left ring-1 ring-white/10 transition hover:bg-white/[0.12] desktop:w-full"
                  >
                    <span className="relative shrink-0">
                      <img
                        src={avatarFor(p)}
                        onError={p.photos?.[0] ? fallbackToFullPhoto(p.photos[0]) : undefined}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 rounded-full bg-violet-100 object-cover"
                      />
                      {isOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1a0d33] bg-mint-500" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {p.firstName}
                        {ageSuffix(p)}
                      </span>
                      <span className={`block truncate text-[11px] ${isOnline ? 'font-semibold text-mint-400' : 'text-white/55'}`}>
                        {activityLabel(p.lastActiveAt, now)}
                      </span>
                      <span className="hidden truncate text-[11px] text-white/40 desktop:block">{p.city}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default ActiveGlobe
