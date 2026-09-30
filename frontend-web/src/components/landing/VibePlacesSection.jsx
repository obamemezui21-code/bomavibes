import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, CalendarHeart, Map, MapPin, Send, Sparkles, UtensilsCrossed } from 'lucide-react'
import dateCouple from '../../assets/people/couple-hiver.webp'
import { glow } from '../../lib/glow.js'
import Reveal from './Reveal.jsx'


// "Vibe Places" is the marketing name of the in-app venues module
// (/coins-chics): curated restaurants, bars and lounges a user can send to a
// match as an invitation, plus a map and events.
const POINTS = [
  { icon: UtensilsCrossed, title: 'Des lieux sélectionnés', text: 'Restaurants, bars et lounges choisis pour un premier rendez-vous réussi.' },
  { icon: Send, title: 'Invitez en un geste', text: 'Envoyez un lieu directement dans la conversation avec votre match.' },
  { icon: Map, title: 'Carte & événements', text: 'Repérez les adresses près de vous et les soirées à ne pas manquer.' },
]

function VibePlacesSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], [-30, 30])
  const cardY = useTransform(scrollYProgress, [0, 1], [30, -30])

  return (
    <section
      id="vibe-places"
      ref={ref}
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#1c1024] px-4 py-24 text-white sm:px-8 sm:py-28"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -bottom-32 -left-40 h-[34rem] w-[34rem]" style={glow('#f2bf4e', 22)} />
        <div className="absolute -right-32 -top-32 h-[36rem] w-[36rem]" style={glow('var(--color-violet-600)', 45)} />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
        {/* Visual */}
        <div className="relative order-2 mx-auto w-full max-w-md lg:order-1">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] ring-1 ring-white/10">
            <motion.img
              style={{ y: imageY }}
              src={dateCouple}
              alt="Un couple qui se retrouve pour un rendez-vous"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-[112%] w-full -translate-y-[6%] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1024]/80 via-transparent to-transparent" />
          </div>

          {/* Invitation card, as it appears in the chat */}
          <motion.div
            style={{ y: cardY }}
            className="absolute -bottom-6 left-1/2 w-[86%] -translate-x-1/2 sm:-right-8 sm:left-auto sm:w-72 sm:translate-x-0"
          >
            <Reveal delay={0.2}              className="rounded-2xl bg-white p-3.5 text-[#261b28] shadow-2xl shadow-black/40"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-pink-600">
                <CalendarHeart size={13} /> Invitation
              </p>
              <p className="mt-1.5 font-display text-base font-bold">Dîner en terrasse</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#635a65]">
                <MapPin size={12} /> Bord de mer, Libreville · Samedi 20 h
              </p>
              <div className="mt-3 flex gap-2">
                <span className="flex-1 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 py-1.5 text-center text-xs font-bold text-white">
                  J'accepte 💕
                </span>
                <span className="rounded-full bg-[#f7f1e6] px-3 py-1.5 text-xs font-semibold text-[#635a65]">Plus tard</span>
              </div>
            </Reveal>
          </motion.div>
        </div>

        {/* Copy */}
        <Reveal          className="order-1 lg:order-2"
        >
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f2bf4e]">
            <Sparkles size={14} /> Vibe Places
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Votre match mérite peut-être un vrai rendez-vous.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/75 sm:text-lg">
            Les meilleures histoires ne restent pas derrière un écran. Vibe Places fait le pont entre la rencontre
            virtuelle et la rencontre réelle : trouvez l'endroit idéal, invitez votre match, et laissez la magie opérer.
          </p>

          <ul className="mt-8 space-y-4">
            {POINTS.map((p, i) => (
              <Reveal
                key={p.title} as="li" from="left" delay={0.1 + i * 0.08}                className="flex gap-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#f2bf4e] ring-1 ring-white/10">
                  <p.icon size={20} />
                </span>
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-white/65">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>

          <Link
            to="/signup"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#4b164c] shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98]"
          >
            Explorer Vibe Places
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

export default VibePlacesSection
