import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Camera, ChevronDown, Heart, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import heroPhoto from '../assets/hero.jpg'
import heroLogoIcon from '../assets/bomavibes-icon.png'
import amaraPhoto from '../assets/faces/amara.jpg'
import malikPhoto from '../assets/faces/malik.jpg'
import ndeyePhoto from '../assets/faces/ndeye.jpg'
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

const PROMOS = [
  {
    photo: amaraPhoto,
    eyebrow: 'Des liens vrais',
    title: 'Des connexions qui durent',
    text: "Ici, on ne swipe pas juste pour swiper. BomaVibes met en avant les profils qui cherchent vraiment à connaître quelqu'un — pas juste à collectionner des matchs.",
    reverse: false,
  },
  {
    photo: malikPhoto,
    eyebrow: 'Une communauté',
    title: 'Une communauté qui te ressemble',
    text: 'Des célibataires africains et afrodescendants, avec les mêmes codes, la même culture, et surtout la même envie de rire vrai.',
    reverse: true,
  },
  {
    photo: ndeyePhoto,
    eyebrow: 'En confiance',
    title: 'Du match au premier rendez-vous',
    text: "Discute, apprends à connaître l'autre, et passe à l'étape d'après quand tu es prêt·e — en toute sécurité, avec nos conseils pour des rencontres réussies.",
    reverse: false,
  },
]

const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com/bomavibes' },
  { label: 'Facebook', href: 'https://facebook.com/bomavibes' },
  { label: 'TikTok', href: 'https://tiktok.com/@bomavibes' },
  { label: 'WhatsApp', href: 'https://wa.me/33744233809' },
]

const FAQS = [
  {
    question: 'Est-ce que BomaVibes est gratuit ?',
    answer: "Oui. L'inscription et les fonctionnalités essentielles — créer un profil, matcher, discuter — sont gratuites.",
  },
  {
    question: 'Comment mes données sont-elles protégées ?',
    answer: (
      <>
        Elles ne sont jamais vendues et restent sous ton contrôle : tu peux les consulter,
        les modifier ou tout supprimer à tout moment. Détails dans notre{' '}
        <Link to="/confidentialite" className="font-semibold text-[#9c7220] underline-offset-2 hover:underline">
          politique de confidentialité
        </Link>
        .
      </>
    ),
  },
  {
    question: 'Comment supprimer mon compte ?',
    answer: 'Directement depuis Paramètres → Supprimer mon compte. Toutes tes données sont effacées définitivement, sans délai.',
  },
  {
    question: 'Que faire si un profil me met mal à l\'aise ?',
    answer: (
      <>
        Tu peux le signaler ou le bloquer en un clic depuis la conversation ou le profil.
        Retrouve nos conseils sur la{' '}
        <Link to="/securite" className="font-semibold text-[#9c7220] underline-offset-2 hover:underline">
          page Sécurité
        </Link>
        .
      </>
    ),
  },
  {
    question: 'BomaVibes est fait pour qui ?',
    answer: 'Pour les célibataires africains et afrodescendants de 18 ans et plus, qui cherchent des connexions authentiques et durables.',
  },
]

function Landing() {
  const [logoSettled, setLogoSettled] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

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
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-10">
        <h2 className="text-center font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Comment ça marche</h2>
        <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1F3D2B] shadow-md">
                <s.icon size={34} strokeWidth={1.75} className="text-[#E8C468]" />
              </div>
              <p className="mt-6 font-display text-xl font-bold text-[#2B1D14] sm:text-2xl">
                <span className="text-[#C9962B]">{i + 1}.</span> {s.title}
              </p>
              <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-[#6b5d4f]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 text-center sm:px-10">
        <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">À propos de BomaVibes</h2>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-[#6b5d4f]">
          BomaVibes est né d'une conviction simple : les célibataires africains et de la
          communauté noire méritent un espace de rencontre pensé pour eux, qui célèbre leur
          culture et leurs valeurs. Notre mission est de créer des connexions authentiques,
          sûres et durables, portées par une communauté vérifiée et bienveillante.
        </p>
      </section>

      {/* Promo sections */}
      <div className="mx-auto max-w-6xl space-y-24 px-4 py-8 sm:px-10">
        {PROMOS.map((p) => (
          <section
            key={p.title}
            className={`grid grid-cols-1 items-center gap-10 sm:grid-cols-2 sm:gap-16 ${
              p.reverse ? 'sm:[&>*:first-child]:order-2' : ''
            }`}
          >
            <div className="aspect-[4/3] overflow-hidden rounded-3xl shadow-xl">
              <img src={p.photo} alt="" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#9c7220]">{p.eyebrow}</p>
              <h3 className="mt-3 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl">{p.title}</h3>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-[#6b5d4f]">{p.text}</p>
            </div>
          </section>
        ))}
      </div>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-8">
        <h2 className="text-center font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Questions fréquentes</h2>
        <div className="mt-14">
          {FAQS.map((f, i) => {
            const isOpen = openFaq === i
            return (
              <div key={f.question} className="border-b border-[#1F3D2B]/10 py-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-lg font-bold text-[#2B1D14]">{f.question}</span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-[#9c7220] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="pt-3 text-base leading-relaxed text-[#6b5d4f]">{f.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-[#1F3D2B] px-4 py-24 text-center sm:px-8">
        <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">Contactez-nous</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/75">
          Une question, une suggestion ? Écris-nous, on te répond avec plaisir.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="mailto:Bomavibes241@gmail.com"
            className="inline-block rounded-xl bg-[#C9962B] px-8 py-3.5 text-base font-semibold text-[#2B1D14] shadow-lg transition hover:bg-[#dba838]"
          >
            Bomavibes241@gmail.com
          </a>
          <a
            href="https://wa.me/33744233809"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl border border-white/40 bg-white/10 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            Écrire sur WhatsApp
          </a>
        </div>

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

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-6">
          <Link
            to="/confidentialite"
            className="text-xs font-medium text-white/50 underline-offset-4 transition hover:text-white/80 hover:underline"
          >
            Politique de confidentialité
          </Link>
          <Link
            to="/conditions"
            className="text-xs font-medium text-white/50 underline-offset-4 transition hover:text-white/80 hover:underline"
          >
            Conditions d'utilisation
          </Link>
          <Link
            to="/securite"
            className="text-xs font-medium text-white/50 underline-offset-4 transition hover:text-white/80 hover:underline"
          >
            Sécurité
          </Link>
          <Link
            to="/mentions-legales"
            className="text-xs font-medium text-white/50 underline-offset-4 transition hover:text-white/80 hover:underline"
          >
            Mentions légales
          </Link>
        </div>
      </section>
    </div>
  )
}

export default Landing
