import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Camera, ChevronDown, Heart, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import heroPhoto from '../assets/hero.jpg'
import heroLogoIcon from '../assets/bomavibes-icon.png'
import heroAmara from '../assets/faces/amara.jpg'
import heroKwame from '../assets/faces/kwame.jpg'
import heroZola from '../assets/faces/zola.jpg'
import SiteHeader from '../components/SiteHeader.jsx'
import { TIERS } from '../components/PricingTiers.jsx'
import WwfNewsSection from '../components/WwfNewsSection.jsx'
import FeaturesGridSection from '../components/landing/FeaturesGridSection.jsx'
import SecuritySection from '../components/landing/SecuritySection.jsx'
import AppPreviewSection from '../components/landing/AppPreviewSection.jsx'
import AvailabilitySection from '../components/landing/AvailabilitySection.jsx'
import StatsSection from '../components/landing/StatsSection.jsx'
import TestimonialsSection from '../components/landing/TestimonialsSection.jsx'
import PlatformUpdatesSection from '../components/landing/PlatformUpdatesSection.jsx'
import SupportTeaserSection from '../components/landing/SupportTeaserSection.jsx'
import FinalCtaSection from '../components/landing/FinalCtaSection.jsx'
import SupportChatWidget from '../components/landing/SupportChatWidget.jsx'

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

const HERO_SLIDES = [
  { src: heroPhoto, alt: 'Couple BomaVibes', position: 'object-[68%_35%] sm:object-center' },
  { src: heroKwame, alt: 'Membre BomaVibes', position: 'object-center' },
  { src: heroAmara, alt: 'Membre BomaVibes', position: 'object-center' },
  { src: heroZola, alt: 'Membre BomaVibes', position: 'object-center' },
]
const HERO_SLIDE_MS = 5000

const FEATURES = [
  { icon: ShieldCheck, title: 'Sécurisé', text: 'Vos données sont protégées' },
  { icon: BadgeCheck, title: 'Authentique', text: 'Des profils vérifiés et réels' },
  { icon: Users, title: 'Afrocentré', text: 'Une communauté qui te ressemble' },
]

const FEATURE_DETAILS = [
  {
    icon: ShieldCheck,
    title: 'Sécurisé',
    text: "Vos données ne sont jamais vendues et restent sous votre contrôle : mots de passe chiffrés, connexions protégées, et suppression complète et définitive de vos données en un clic depuis les Paramètres si vous changez d'avis.",
    link: { to: '/confidentialite', label: 'Notre politique de confidentialité' },
  },
  {
    icon: BadgeCheck,
    title: 'Authentique',
    text: 'Chaque profil est modéré pour limiter les faux comptes et les usurpations. Signalement et blocage en un geste, pour une communauté où vous pouvez vraiment faire confiance à qui vous matchez.',
    link: { to: '/securite', label: 'Sécurité & signalement' },
  },
  {
    icon: Users,
    title: 'Afrocentré',
    text: "Pensé par et pour les célibataires africains et afrodescendants : mêmes codes, mêmes valeurs, même énergie. BomaVibes célèbre votre culture au lieu de vous demander de vous adapter à celle des autres.",
    link: null,
  },
]

const STEPS = [
  {
    icon: Camera,
    title: 'Créez votre profil',
    text: "Donnez vie à votre profil. Ajoutez vos photos et présentez-vous en quelques mots. En seulement 30 secondes, augmentez vos chances de faire des rencontres authentiques.",
  },
  {
    icon: Heart,
    title: 'Découvrez & matchez',
    text: "Explorez des profils authentiques près de chez vous et matchez avec des personnes qui partagent vos valeurs et vos centres d'intérêt.",
  },
  {
    icon: MessageCircle,
    title: 'Discutez pour de vrai',
    text: 'Vous avez matché ? Lancez la conversation, apprenez à vous connaître et laissez naître une connexion authentique.',
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
        Elles ne sont jamais vendues et restent sous votre contrôle : vous pouvez les consulter,
        les modifier ou tout supprimer à tout moment. Détails dans notre{' '}
        <Link to="/confidentialite" className="font-semibold text-pink-600 underline-offset-2 hover:underline">
          politique de confidentialité
        </Link>
        .
      </>
    ),
  },
  {
    question: 'Comment supprimer mon compte ?',
    answer: 'Directement depuis Paramètres → Supprimer mon compte. Toutes vos données sont effacées définitivement, sans délai.',
  },
  {
    question: 'Que faire si un profil me met mal à l\'aise ?',
    answer: (
      <>
        Vous pouvez le signaler ou le bloquer en un clic depuis la conversation ou le profil.
        Retrouvez nos conseils sur la{' '}
        <Link to="/securite" className="font-semibold text-pink-600 underline-offset-2 hover:underline">
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
  {
    question: 'Le blocage empêche-t-il vraiment quelqu\'un de me recontacter ?',
    answer: "Oui. Une fois bloqué·e, la personne disparaît de vos deux côtés (Découvrir, Matchs, Messages), et l'envoi de nouveaux messages est bloqué techniquement, pas seulement caché à l'écran.",
  },
  {
    question: 'Dans quels pays BomaVibes est-il disponible ?',
    answer: "BomaVibes est disponible dès aujourd'hui au Gabon, avec une extension progressive prévue vers 14 autres pays d'Afrique francophone, puis panafricaine, puis dans le monde entier. Voir le détail dans la section Disponibilité dans le monde.",
  },
]

function Landing() {
  const [logoSettled, setLogoSettled] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [heroSlide, setHeroSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide((i) => (i + 1) % HERO_SLIDES.length)
    }, HERO_SLIDE_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      {/* Hero */}
      <div id="top" className="relative flex min-h-svh items-end overflow-hidden sm:items-center">
        <AnimatePresence initial={false}>
          <motion.img
            key={heroSlide}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
            src={HERO_SLIDES[heroSlide].src}
            alt={HERO_SLIDES[heroSlide].alt}
            className={`absolute inset-0 h-full w-full object-cover ${HERO_SLIDES[heroSlide].position}`}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25 sm:bg-gradient-to-r sm:from-black/80 sm:via-black/40 sm:to-transparent" />

        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-2 sm:bottom-8">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => setHeroSlide(i)}
              aria-label={`Photo ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === heroSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>

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
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
              className="mt-9 flex flex-wrap gap-4"
            >
              <Link
                to="/signup"
                className="rounded-xl bg-pink-500 px-7 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-pink-400 hover:shadow-xl hover:shadow-black/30 active:translate-y-0"
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
                    <f.icon size={18} strokeWidth={2} className="text-pink-400" />
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
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-violet-600 shadow-md">
                <s.icon size={34} strokeWidth={1.75} className="text-pink-400" />
              </div>
              <p className="mt-6 font-display text-xl font-bold text-[#2B1D14] sm:text-2xl">
                <span className="text-pink-500">{i + 1}.</span> {s.title}
              </p>
              <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-[#6b5d4f]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 text-center sm:px-10">
        <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">À propos de BomaVibes</h2>
        <div className="mx-auto mt-6 max-w-3xl space-y-5 text-lg leading-relaxed text-[#6b5d4f]">
          <p>
            Chez BomaVibes, nous croyons que l'amour naît lorsque deux personnes peuvent être
            pleinement elles-mêmes.
          </p>
          <p>
            C'est pourquoi nous avons créé une plateforme de rencontre pensée avant tout pour
            les célibataires africains et de la diaspora noire : un espace où la culture, les
            valeurs, les traditions et les ambitions se rencontrent naturellement.
          </p>
          <p>
            Ici, chaque profil est une histoire, chaque échange une opportunité, et chaque
            rencontre peut devenir le début de quelque chose de beau.
          </p>
          <p>
            Notre priorité est d'offrir une expérience de qualité grâce à une communauté
            authentique, des profils vérifiés et un environnement sûr, respectueux et
            bienveillant.
          </p>
          <p>
            Plus qu'une application de rencontre, BomaVibes est une communauté qui rapproche
            les cœurs, célèbre nos racines et favorise des relations sincères et durables.
          </p>
        </div>
      </section>

      {/* Why BomaVibes */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-10">
        <h2 className="text-center font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Pourquoi choisir BomaVibes</h2>
        <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-[#6b5d4f]">
          Trois principes qui guident tout ce qu'on construit.
        </p>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {FEATURE_DETAILS.map((f) => (
            <div key={f.title} className="rounded-3xl border border-violet-600/8 bg-white p-8 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 shadow-md">
                <f.icon size={26} strokeWidth={1.75} className="text-pink-400" />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-[#2B1D14]">{f.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-[#6b5d4f]">{f.text}</p>
              {f.link && (
                <Link
                  to={f.link.to}
                  className="mt-4 inline-block text-sm font-semibold text-pink-600 underline-offset-2 hover:underline"
                >
                  {f.link.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <FeaturesGridSection />
      <SecuritySection />
      <AppPreviewSection />
      <AvailabilitySection />
      <StatsSection />
      <TestimonialsSection />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-8">
        <h2 className="text-center font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Questions fréquentes</h2>
        <div className="mt-14">
          {FAQS.map((f, i) => {
            const isOpen = openFaq === i
            return (
              <div key={f.question} className="border-b border-violet-600/10 py-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-lg font-bold text-[#2B1D14]">{f.question}</span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-pink-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
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

      <PlatformUpdatesSection />
      <WwfNewsSection />

      {/* Nos tarifs (teaser) */}
      <section id="tarifs" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-24 sm:px-10">
        <h2 className="text-center font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Nos tarifs</h2>
        <p className="mx-auto mt-5 max-w-xl text-center text-lg leading-relaxed text-[#6b5d4f]">
          BomaVibes reste gratuit pour matcher et discuter. Choisissez le niveau qui vous correspond,
          sans engagement caché.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <Link
              key={tier.name}
              to="/tarifs"
              className={`rounded-2xl border bg-white p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                tier.highlight ? 'border-pink-500' : 'border-violet-600/8'
              }`}
            >
              <img src={tier.badge} alt="" className="mx-auto h-14 w-14 rounded-xl object-cover shadow" />
              <p className="mt-4 font-display text-base font-bold text-[#2B1D14]">
                {tier.emoji} {tier.name}
              </p>
              <p className="mt-1 text-sm text-[#6b5d4f]">
                à partir de <span className="font-semibold text-[#2B1D14]">{tier.prices[0].amount}</span>
                <span className="text-ink-soft/60"> / {tier.prices[0].period.toLowerCase()}</span>
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/tarifs"
            className="inline-block rounded-xl bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-500"
          >
            Voir tous les tarifs
          </Link>
        </div>
      </section>

      <SupportTeaserSection />
      <FinalCtaSection />

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-violet-600 px-4 py-24 text-center sm:px-8">
        <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">Contactez-nous</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/75">
          Une question, une suggestion ? Écrivez-nous, nous vous répondons avec plaisir.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="mailto:Bomavibes241@gmail.com"
            className="inline-block rounded-xl bg-pink-500 px-8 py-3.5 text-base font-semibold text-[#2B1D14] shadow-lg transition hover:bg-pink-400"
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
          <Link
            to="/soutenir"
            className="text-xs font-medium text-white/50 underline-offset-4 transition hover:text-white/80 hover:underline"
          >
            Soutenir le projet
          </Link>
        </div>
      </section>

      <SupportChatWidget />
    </div>
  )
}

export default Landing
