import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import heroPhoto from '../assets/hero.png'
import SiteHeader from '../components/SiteHeader.jsx'

const HERO_LINE_1 = "L'amour a sa vibe."
const HERO_LINE_2 = 'Et la tienne ?'
const TYPE_SPEED = 42

function useTypewriter() {
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [phase, setPhase] = useState('line1')

  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setLine1(HERO_LINE_1.slice(0, i))
      if (i >= HERO_LINE_1.length) {
        clearInterval(timer)
        setPhase('line2')
      }
    }, TYPE_SPEED)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (phase !== 'line2') return
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setLine2(HERO_LINE_2.slice(0, i))
      if (i >= HERO_LINE_2.length) {
        clearInterval(timer)
        setPhase('done')
      }
    }, TYPE_SPEED)
    return () => clearInterval(timer)
  }, [phase])

  return { line1, line2, phase }
}

const FEATURES = [
  { icon: '🛡️', title: 'Sécurisé', text: 'Vos données sont protégées' },
  { icon: '💚', title: 'Authentique', text: 'Des profils vérifiés et réels' },
  { icon: '👥', title: 'Afrocentré', text: 'Une communauté qui te ressemble' },
]

const STEPS = [
  {
    icon: '📸',
    title: 'Crée ton profil',
    text: 'Ajoute tes photos et parle un peu de toi, ça prend deux minutes.',
  },
  {
    icon: '💛',
    title: 'Découvre & matche',
    text: 'Swipe parmi des profils authentiques de la communauté, près de chez toi.',
  },
  {
    icon: '💬',
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
  const { line1, line2, phase } = useTypewriter()

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

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-32 sm:px-8 sm:py-24">
          <div className="max-w-lg">
            <h1
              className="font-hero text-4xl font-medium italic leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.65),0_1px_4px_rgba(0,0,0,0.85)] sm:text-5xl"
              aria-label={`${HERO_LINE_1} ${HERO_LINE_2}`}
            >
              <span aria-hidden="true" className="block">
                {line1}
                {phase === 'line1' && <span className="typewriter-cursor" />}
              </span>
              <span aria-hidden="true" className="block text-[#E8C468]">
                {line2}
                {phase !== 'line1' && <span className="typewriter-cursor" />}
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-md text-base leading-relaxed text-white/85"
            >
              BomaVibes est le site de rencontre africain, de la communauté noire, qui
              connecte des célibataires authentiques pour des relations vraies et durables.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/signup"
                className="rounded-xl bg-[#C9962B] px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-black/20 transition hover:bg-[#dba838]"
              >
                S'inscrire gratuitement
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-white/40 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Se connecter
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg backdrop-blur-sm">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.title}</p>
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
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1F3D2B] text-2xl shadow-md">
                {s.icon}
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
