import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, Heart, MapPin } from 'lucide-react'
import { DEMO_PROFILES, DISCOVER_ORDER } from '../../lib/demoProfiles.js'
import FlagIcon from '../FlagIcon.jsx'

const EASE = [0.22, 1, 0.36, 1]

// Hover (desktop) or tap (touch) reveals the interests and the CTA. Tapping
// the card body toggles; the CTA itself is a real link.
function ProfileCard({ profile, index, open, onToggle }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.08, ease: EASE }}
      className="group relative"
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${profile.name}, ${profile.age} ans, ${profile.city}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-[1.75rem] bg-[#261b28] shadow-lg shadow-violet-900/10 outline-none transition duration-500 ease-out focus-visible:ring-4 focus-visible:ring-pink-400/60 ${
          open ? '-translate-y-1.5 shadow-2xl shadow-violet-900/25' : 'group-hover:-translate-y-1.5 group-hover:shadow-2xl group-hover:shadow-violet-900/25'
        }`}
      >
        <img
          src={profile.photo}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition duration-700 ease-out ${open ? 'scale-[1.06]' : 'group-hover:scale-[1.06]'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1024] via-[#1c1024]/25 to-transparent" />

        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#4b164c] shadow backdrop-blur">
          <Heart size={11} className="fill-pink-500 text-pink-500" />
          {profile.match} %
        </span>

        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white sm:p-4">
          <p className="flex items-center gap-1.5 font-display text-lg font-bold leading-tight sm:text-xl">
            {profile.name}, {profile.age}
            {profile.verified && <BadgeCheck size={17} className="shrink-0 text-sky-400" strokeWidth={2.5} />}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/75">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{profile.city}</span>
            <FlagIcon code={profile.country} className="!h-3 !w-4 shrink-0 rounded-[2px]" />
          </p>

          {/* Revealed on hover / tap */}
          <div
            className={`grid transition-all duration-500 ease-out ${
              open ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 group-hover:mt-3 group-hover:grid-rows-[1fr] group-hover:opacity-100'
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((i) => (
                  <span key={i} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
                    {i}
                  </span>
                ))}
              </div>
              <Link
                to="/signup"
                onClick={(e) => e.stopPropagation()}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-white py-2 text-xs font-bold text-[#4b164c] transition hover:bg-pink-50 active:scale-[0.97]"
              >
                Découvrir le profil
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function DiscoverProfilesSection() {
  const [openId, setOpenId] = useState(null)

  return (
    <section id="decouverte" className="relative scroll-mt-20 overflow-hidden px-4 py-24 sm:px-8 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-10 h-96 w-96 rounded-full bg-pink-500/10 blur-[100px]" />
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Découverte</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-[#261b28] sm:text-5xl">
            Des personnes qui vous ressemblent, près de chez vous
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#635a65] sm:text-lg">
            Chaque jour, BomaVibes vous présente des profils compatibles avec vos valeurs, vos envies et votre style de
            vie. Survolez ou touchez une carte pour en savoir plus.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 lg:gap-7">
          {DISCOVER_ORDER.map((id, i) => (
            <ProfileCard
              key={id}
              profile={DEMO_PROFILES[id]}
              index={i}
              open={openId === id}
              onToggle={() => setOpenId((cur) => (cur === id ? null : id))}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[#635a65]/70">
          Profils d'illustration. Inscrivez-vous pour découvrir les vrais membres de votre région.
        </p>
      </div>
    </section>
  )
}

export default DiscoverProfilesSection
