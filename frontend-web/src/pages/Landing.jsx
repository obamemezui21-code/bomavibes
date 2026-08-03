import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeCheck, Camera, Heart, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import heroPhoto from '../assets/hero.jpg'
import heroLogoIcon from '../assets/bomavibes-icon.png'
import SiteHeader from '../components/SiteHeader.jsx'

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

const FEATURES = [
  { icon: ShieldCheck, title: 'Sécurisé', text: 'Vos données sont protégées' },
  { icon: BadgeCheck, title: 'Authentique', text: 'Des profils vérifiés et réels' },
  { icon: Users, title: 'Afrocentré', text: 'Une communauté qui te ressemble' },
]

const STEPS = [
  {
    icon: Camera,
    title: 'Crée ton profil',
    text: 'Ajoute tes photos et parle un peu de toi, ça prend deux minutes.',
  },
  {
    icon: Heart,
    title: 'Découvre & matche',
    text: 'Swipe parmi des profils authentiques de la communauté, près de chez toi.',
  },
  {
    icon: MessageCircle,
    title: 'Discute en vrai',
    text: 'Ça matche ? Lancez la conversation et voyez où ça vous mène.',
  },
]

const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com/bomavibes' },
  { label: 'Facebook', href: 'https://facebook.com/bomavibes' },
  { label: 'TikTok', href: 'https://tiktok.com/@bomavibes' },
  { label: 'WhatsApp', href: 'https://wa.me/24100000000' },
]

function Landing() {
  const [logoSettled, setLogoSettled] = useState(false)

  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      {/* Hero */}
      <div id="top" className="relative flex min-h-svh items-end overflow-hidden sm:items-center">
        <motion.img
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9 }}
          src={heroPhoto}
          alt="Couple BomaVibes"
          className="absolute inset-0 h-full w-full object-cover object-[68%_35%] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25 sm:bg-gradient-to-r sm:from-black/80 sm:via-black/40 sm:to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-14 pt-32 sm:px-8 sm:py-24">
          <div className="max-w-lg">
            <motion.h1
              initial={{ opacity: 1 }}
              className="font-display text-5xl font-extrabold uppercase leading-none tracking-tight text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.7),0_1px_4px_rgba(0,0,0,0.9)] sm:text-7xl"
              aria-label="BomaVibes"
            >
              <motion.span
                aria-hidden="true"
                className="inline-flex items-center"
                variants={WORD_CONTAINER}
                initial="hidden"
                animate="visible"
              >
                <motion.span variants={LETTER}>B</motion.span>
                <motion.img
                  src={heroLogoIcon}
                  alt=""
                  initial={{ opacity: 0, scale: 0.3, rotate: -140 }}
                  animate={logoSettled ? LOGO_PULSE : LOGO_SETTLE}
                  transition={logoSettled ? LOGO_PULSE_TRANSITION : LOGO_SETTLE_TRANSITION}
                  onAnimationComplete={() => setLogoSettled(true)}
                  className="mx-[0.02em] inline-block h-[0.95em] w-[0.95em] rounded-full object-cover align-middle shadow-md ring-2 ring-[#E8C468]/80"
                />
                <motion.span variants={LETTER}>M</motion.span>
                <motion.span variants={LETTER}>A</motion.span>
                <span className="inline-flex text-[#E8C468]">
                  <motion.span variants={LETTER}>V</motion.span>
                  <motion.span variants={LETTER}>I</motion.span>
                  <motion.span variants={LETTER}>B</motion.span>
                  <motion.span variants={LETTER}>E</motion.span>
                  <motion.span variants={LETTER}>S</motion.span>
                </span>
              </motion.span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
              className="mt-9 flex flex-wrap gap-4"
            >
              <Link
                to="/signup"
                className="rounded-xl bg-[#C9962B] px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#dba838] hover:shadow-xl hover:shadow-black/30 active:translate-y-0"
              >
                S'inscrire gratuitement
              </Link>
              <Link
                to="/welcome"
                className="rounded-xl border border-white/40 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/20 active:translate-y-0"
              >
                Se connecter
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.75, ease: 'easeOut' }}
              className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3"
            >
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                    <f.icon size={18} strokeWidth={2} className="text-[#E8C468]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-white">{f.title}</p>
                    <p className="text-xs text-white/70">{f.text}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-8">
        <h2 className="text-center font-display text-3xl font-bold text-[#2B1D14]">Comment ça marche</h2>
        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1F3D2B] shadow-md">
                <s.icon size={28} strokeWidth={1.75} className="text-[#E8C468]" />
              </div>
              <p className="mt-5 font-display text-lg font-bold text-[#2B1D14]">
                <span className="text-[#C9962B]">{i + 1}.</span> {s.title}
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#6b5d4f]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-20 text-center sm:px-8">
        <h2 className="font-display text-3xl font-bold text-[#2B1D14]">À propos de BomaVibes</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#6b5d4f]">
          BomaVibes est né d'une conviction simple : les célibataires africains et de la
          communauté noire méritent un espace de rencontre pensé pour eux, qui célèbre leur
          culture et leurs valeurs. Notre mission est de créer des connexions authentiques,
          sûres et durables, portées par une communauté vérifiée et bienveillante.
        </p>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-[#1F3D2B] px-4 py-20 text-center sm:px-8">
        <h2 className="font-display text-3xl font-bold text-white">Contactez-nous</h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/75">
          Une question, une suggestion ? Écris-nous, on te répond avec plaisir.
        </p>
        <a
          href="mailto:contact@bomavibes.tech"
          className="mt-6 inline-block rounded-xl bg-[#C9962B] px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg transition hover:bg-[#dba838]"
        >
          contact@bomavibes.tech
        </a>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
            >
              {s.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Landing
