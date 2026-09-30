import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, BadgeCheck, Heart, ShieldCheck } from 'lucide-react'
import heroCouple from '../../assets/people/couple-complices.webp'
import logoIcon from '../../assets/bomavibes-icon.webp'
import { DEMO_PROFILES } from '../../lib/demoProfiles.js'

const EASE = [0.22, 1, 0.36, 1]

// "B[logo]MAVIBES" wordmark: letters rise in one by one, the logo spins into
// place of the O, then keeps a slow pulse.
const WORD_CONTAINER = {
  hidden: {},
  visible: { transition: { delayChildren: 0.1, staggerChildren: 0.06 } },
}
const LETTER = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}
const LOGO_SETTLE = { opacity: 1, scale: 1, rotate: 0 }
const LOGO_SETTLE_TRANSITION = { delay: 0.95, type: 'spring', stiffness: 260, damping: 15, mass: 0.7 }
const LOGO_PULSE = { opacity: 1, scale: [1, 1.045, 1], rotate: 0 }
const LOGO_PULSE_TRANSITION = { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }

function Wordmark() {
  const [logoSettled, setLogoSettled] = useState(false)
  return (
    <h1
      className="font-display text-[clamp(2.4rem,12vw,4.5rem)] font-extrabold uppercase leading-none tracking-tight text-white"
      aria-label="BomaVibes"
    >
      <motion.span aria-hidden="true" className="inline-flex items-center" variants={WORD_CONTAINER} initial="hidden" animate="visible">
        <motion.span variants={LETTER}>B</motion.span>
        <motion.img
          src={logoIcon}
          alt=""
          initial={{ opacity: 0, scale: 0.3, rotate: -140 }}
          animate={logoSettled ? LOGO_PULSE : LOGO_SETTLE}
          transition={logoSettled ? LOGO_PULSE_TRANSITION : LOGO_SETTLE_TRANSITION}
          onAnimationComplete={() => setLogoSettled(true)}
          className="mx-[0.02em] inline-block h-[0.95em] w-[0.95em] rounded-full object-cover align-middle shadow-md ring-2 ring-pink-400/80"
        />
        <motion.span variants={LETTER}>M</motion.span>
        <motion.span variants={LETTER}>A</motion.span>
        <span className="inline-flex text-pink-400">
          <motion.span variants={LETTER}>V</motion.span>
          <motion.span variants={LETTER}>I</motion.span>
          <motion.span variants={LETTER}>B</motion.span>
          <motion.span variants={LETTER}>E</motion.span>
          <motion.span variants={LETTER}>S</motion.span>
        </span>
      </motion.span>
    </h1>
  )
}

// Small profile card floating around the main photo. `depth` drives the
// parallax (how far it drifts while the hero scrolls away).
function FloatingProfile({ profile, className, delay, depth, scrollYProgress, floatDelay }) {
  const y = useTransform(scrollYProgress, [0, 1], [0, -120 * depth])
  return (
    <motion.div style={{ y }} className={`absolute z-20 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay, ease: EASE }}
      >
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: floatDelay }}
          className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-[#1c1024]/70 p-2 pr-3.5 shadow-2xl shadow-black/40 backdrop-blur-md"
        >
          <img src={profile.photo} alt="" className="h-11 w-11 rounded-xl object-cover sm:h-12 sm:w-12" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-bold text-white">
              {profile.name}, {profile.age}
              {profile.verified && <BadgeCheck size={14} className="text-sky-400" strokeWidth={2.5} />}
            </p>
            <p className="text-[11px] text-white/70">{profile.city}</p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function HeroSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const photoY = useTransform(scrollYProgress, [0, 1], [0, 60])
  const photoScale = useTransform(scrollYProgress, [0, 1], [1, 1.06])
  const textY = useTransform(scrollYProgress, [0, 1], [0, -40])

  const { zola, kofi, mariam } = DEMO_PROFILES

  return (
    <section
      id="top"
      ref={ref}
      className="relative isolate overflow-hidden bg-[#1c1024] pb-20 pt-28 text-white sm:pt-32 lg:flex lg:min-h-svh lg:items-center lg:pb-24"
    >
      {/* Ambient glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-violet-600/40 blur-[110px]" />
        <div className="absolute -right-24 top-1/3 h-[26rem] w-[26rem] rounded-full bg-pink-500/30 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#f2bf4e]/15 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#1c1024_75%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* Copy */}
        <motion.div style={{ y: textY }} className="relative z-10 text-center lg:text-left">
          <Wordmark />

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
            className="mt-6 font-display text-[clamp(1.6rem,6vw,2.6rem)] font-bold leading-[1.1] tracking-tight"
          >
            Rencontrez quelqu'un qui partage{' '}
            <span className="bg-gradient-to-r from-pink-400 via-[#f2a0c8] to-[#f2bf4e] bg-clip-text text-transparent">
              votre vibe.
            </span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.22, ease: EASE }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg lg:mx-0"
          >
            BomaVibes réunit les célibataires africains et afrodescendants autour de ce qui compte : vos valeurs, votre
            culture, votre énergie. Des profils vérifiés, des échanges sincères, et de vrais rendez-vous.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.34, ease: EASE }}
            className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start"
          >
            <Link
              to="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-pink-500/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pink-500/40 active:translate-y-0 active:scale-[0.98]"
            >
              Créer mon profil
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href="#decouverte"
              className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/10 active:translate-y-0 active:scale-[0.98]"
            >
              Découvrir BomaVibes
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/65 lg:justify-start"
          >
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck size={14} className="text-sky-400" /> Profils vérifiés par selfie
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-mint-400" /> Paiements sécurisés
            </span>
            <span>
              Déjà membre ?{' '}
              <Link to="/welcome" className="font-semibold text-white underline-offset-4 hover:underline">
                Se connecter
              </Link>
            </span>
          </motion.div>
        </motion.div>

        {/* Visual */}
        <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none">
          <div className="relative mx-auto aspect-[4/5] w-[78%] sm:w-[72%] lg:w-[80%]">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: -2 }}
              transition={{ duration: 1, delay: 0.15, ease: EASE }}
              className="absolute inset-0 overflow-hidden rounded-[2rem] shadow-2xl shadow-black/50 ring-1 ring-white/10"
            >
              <motion.img
                style={{ y: photoY, scale: photoScale }}
                src={heroCouple}
                alt="Un couple complice qui rit ensemble"
                fetchPriority="high"
                className="h-[115%] w-full -translate-y-[6%] object-cover object-[50%_30%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1c1024]/70 via-transparent to-transparent" />
            </motion.div>

            {/* "It's a match" pill */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 1.1, ease: EASE }}
              className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#4b164c] shadow-xl">
                <Heart size={15} className="fill-pink-500 text-pink-500" />
                C'est un match !
              </div>
            </motion.div>

            <FloatingProfile
              profile={zola}
              className="-left-[16%] top-[8%]"
              delay={0.55}
              depth={0.6}
              floatDelay={0}
              scrollYProgress={scrollYProgress}
            />
            <FloatingProfile
              profile={kofi}
              className="-right-[14%] top-[38%]"
              delay={0.75}
              depth={1}
              floatDelay={1.5}
              scrollYProgress={scrollYProgress}
            />
            <FloatingProfile
              profile={mariam}
              className="-left-[10%] bottom-[20%] hidden sm:block"
              delay={0.95}
              depth={0.8}
              floatDelay={3}
              scrollYProgress={scrollYProgress}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
