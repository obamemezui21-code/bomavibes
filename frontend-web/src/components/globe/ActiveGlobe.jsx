import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Globe2 } from 'lucide-react'
import { createGlobeScene } from './globeScene.js'

// The street map at the end of the zoom, loaded only when someone gets there.
const GlobeStreetMap = lazy(() => import('./GlobeStreetMap.jsx'))
import { globePlaceForProfile } from '../../lib/nearby.js'
import { fallbackToFullPhoto, photoVariant } from '../../lib/photoVariants.js'
import { fallbackAvatar } from '../../lib/fallbackAvatar.js'
import { ageSuffix } from '../../lib/profileDisplay.js'

const SHOWN = 60
const ONLINE_MS = 150 * 1000 // same threshold as the chat's "En ligne"
const CLUSTER_DEG = 6

function avatarFor(profile) {
  return photoVariant(profile.photos?.[0], 'thumb') || fallbackAvatar(profile.firstName || profile.id)
}

function activityLabel(lastActiveAt, now) {
  if (!lastActiveAt) return null
  const diff = now - lastActiveAt
  if (diff < ONLINE_MS) return 'En ligne'
  const min = Math.round(diff / 60000)
  if (min < 60) return `Actif·ve il y a ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `Actif·ve il y a ${hours} h`
  return `Actif·ve il y a ${Math.round(hours / 24)} j`
}

// The most recently active members, grouped per place: their city's centre, or
// their country when the city isn't known (never anyone's real position).
// Members who hide their distance aren't placed on the globe. Most recently
// active first, with no cut-off.
// clusterDeg: smaller as the globe zooms in, so close cities get their own pin.
function activeGroups(profiles, clusterDeg = CLUSTER_DEG) {
  const active = profiles
    .filter((p) => !p.hideDistance && globePlaceForProfile(p))
    .sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0))
    .slice(0, SHOWN)
  const cities = new Map()
  for (const p of active) {
    const { lat, lng, place } = globePlaceForProfile(p)
    const key = `${lat},${lng}`
    if (!cities.has(key)) cities.set(key, { key, city: place, lat, lng, profiles: [] })
    cities.get(key).profiles.push(p)
  }
  // On the globe a pin covers about 10° of latitude: cities closer than
  // CLUSTER_DEG share one pin (on the most active of them), or their pins would
  // pile up and hide each other. Each city keeps its own pulse on the globe.
  const groups = []
  for (const c of cities.values()) {
    const near = groups.find((g) => Math.hypot(g.lat - c.lat, (g.lng - c.lng) * Math.cos((g.lat * Math.PI) / 180)) < clusterDeg)
    if (near) {
      near.cities.push(c.city)
      near.profiles.push(...c.profiles)
    } else {
      groups.push({ key: c.key, city: c.city, cities: [c.city], lat: c.lat, lng: c.lng, profiles: [...c.profiles] })
    }
  }
  for (const g of groups) {
    g.label = g.cities.length > 1 ? `${g.city} et alentours` : g.city
  }
  return { active, cities: [...cities.values()], groups }
}

// "Les plus actifs": a slowly turning globe of glowing dots, the most active
// members pinned on their city, light running along arcs from your city to
// theirs. Drag it to turn it, pinch (or wheel) to zoom in, no buttons (pins split
// into their cities as it does); tap a city to bring it in front, zoomed in.
// Positions stay city or country centres at any zoom. Under it (on a
// computer, beside it) the same members in a list, each opening their profile.
// No WebGL: the list alone. No member with a known city yet: the globe turns
// on its own, with a word saying members will show up on it.
function ActiveGlobe({ profiles, me, onOpenProfile }) {
  const reducedMotion = useReducedMotion()
  const [now] = useState(() => Date.now())
  // The zoom as the scene reports it: level 1, 2, 4 or 8 (pins regroup by it).
  const [zoomState, setZoomState] = useState({ level: 1, zoomed: false, atMax: false })
  // Zoomed in past the globe's maximum: a street map of that place.
  const [streetMap, setStreetMap] = useState(null)
  const { active, cities, groups } = useMemo(() => activeGroups(profiles, CLUSTER_DEG / zoomState.level), [profiles, zoomState.level])
  const home = useMemo(() => {
    const place = me && globePlaceForProfile(me)
    return place ? [place.lat, place.lng] : null
  }, [me])
  // The city tapped, kept as it was then: zooming regroups the pins, the list stays.
  const [selected, setSelected] = useState(null)
  const selectedKey = selected?.key ?? null
  const [failed, setFailed] = useState(false)
  const stage = useRef(null)
  const pins = useRef(new Map())
  const scene = useRef(null)

  const citiesKey = cities.map((c) => `${c.key}:${c.profiles.length}`).join('|')

  useEffect(() => {
    if (!stage.current) return undefined
    let handle
    try {
      handle = createGlobeScene(stage.current, {
        cities,
        groups,
        home,
        pins: pins.current,
        reducedMotion: !!reducedMotion,
        onZoom: setZoomState,
        onDive: setStreetMap,
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
    // citiesKey stands for cities: the scene is only rebuilt when they change
    // (not when pins regroup with the zoom: see below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesKey, home?.[0], home?.[1], reducedMotion])

  // Pins regrouped (the zoom changed): the scene moves the new ones.
  useEffect(() => {
    scene.current?.setPins(groups)
  }, [groups])

  const online = active.filter((p) => now - p.lastActiveAt < ONLINE_MS).length
  const listed = selected ? selected.profiles : active

  function backToGlobe() {
    if (streetMap) scene.current?.returnFrom(streetMap.lat, streetMap.lng)
    setStreetMap(null)
  }

  function selectCity(key) {
    const city = cities.find((c) => c.key === key)
    if (city) setSelected({ key: city.key, label: city.city, profiles: city.profiles })
  }

  function select(group) {
    if (selectedKey === group.key) {
      setSelected(null)
      return
    }
    setSelected({ key: group.key, label: group.label, profiles: group.profiles })
    // In front, and zoomed in on it.
    scene.current?.focus(group.lat, group.lng, 4)
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
          {active.length
            ? `${active.length} membre${active.length > 1 ? 's' : ''} dans ${cities.length} endroit${cities.length > 1 ? 's' : ''} du monde`
            : 'Les membres apparaissent sur leur ville'}
        </p>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-[24px] bg-[#0d0420] text-white shadow-xl shadow-violet-900/25 desktop:grid desktop:h-[460px] desktop:grid-cols-[minmax(0,1fr)_300px]">
        <p className="pointer-events-none absolute bottom-2 left-4 z-20 hidden text-[10px] text-white/40 desktop:block">Position par ville ou pays uniquement · Pincement, double-clic ou clic puis molette pour zoomer</p>
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

            <p className="pointer-events-none absolute bottom-3 left-4 z-20 text-[10px] text-white/45 desktop:hidden">
              {zoomState.atMax
                ? 'Écarte encore les doigts pour voir les villes et les rues'
                : zoomState.zoomed
                  ? 'Glisse pour te déplacer · pince pour dézoomer'
                  : 'Pince pour zoomer'}
            </p>
            {streetMap && (
              <Suspense fallback={null}>
                <GlobeStreetMap lat={streetMap.lat} lng={streetMap.lng} cities={cities} onSelect={selectCity} onBack={backToGlobe} />
              </Suspense>
            )}
          </div>
        )}

        <div className="relative border-t border-white/10 p-3 desktop:flex desktop:min-h-0 desktop:flex-col desktop:border-l desktop:border-t-0 desktop:bg-black/20 desktop:p-4">
          <div className="flex items-center justify-between px-1">
            <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">{selected ? selected.label : 'Les plus actifs'}</p>
            {selected && (
              <button type="button" onClick={() => setSelected(null)} className="text-[11px] font-semibold text-white/60 hover:text-white">
                Tout le monde
              </button>
            )}
          </div>
          {!listed.length && (
            <p className="mt-2 px-1 text-xs text-white/60">Personne à placer sur le globe pour le moment : les membres actifs y apparaîtront sur leur ville.</p>
          )}
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
                        {activityLabel(p.lastActiveAt, now) || p.city || p.country}
                      </span>
                      {p.lastActiveAt && <span className="hidden truncate text-[11px] text-white/40 desktop:block">{p.city || p.country}</span>}
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
