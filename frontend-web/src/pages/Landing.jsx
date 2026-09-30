import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import aboutPhoto from '../assets/people/couple-tradition.webp'
import SiteHeader from '../components/SiteHeader.jsx'
import WwfNewsSection from '../components/WwfNewsSection.jsx'
import HeroSection from '../components/landing/HeroSection.jsx'
import DiscoverProfilesSection from '../components/landing/DiscoverProfilesSection.jsx'
import HowItWorksSection from '../components/landing/HowItWorksSection.jsx'
import VibePlacesSection from '../components/landing/VibePlacesSection.jsx'
import PremiumSection from '../components/landing/PremiumSection.jsx'
import FeaturesGridSection from '../components/landing/FeaturesGridSection.jsx'
import SecuritySection from '../components/landing/SecuritySection.jsx'
import AppPreviewSection from '../components/landing/AppPreviewSection.jsx'
import AvailabilitySection from '../components/landing/AvailabilitySection.jsx'
import StatsSection from '../components/landing/StatsSection.jsx'
import PlatformUpdatesSection from '../components/landing/PlatformUpdatesSection.jsx'
import SupportTeaserSection from '../components/landing/SupportTeaserSection.jsx'
import FinalCtaSection from '../components/landing/FinalCtaSection.jsx'
import Reveal from '../components/landing/Reveal.jsx'
import SupportChatWidget from '../components/landing/SupportChatWidget.jsx'

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
    answer: "BomaVibes est disponible dès aujourd'hui au Gabon, en France et en Allemagne, avec une extension progressive vers le reste de l'Afrique francophone, puis panafricaine, puis dans le monde entier. Voir le détail dans la section Disponibilité dans le monde.",
  },
]

function Landing() {
  const [openFaq, setOpenFaq] = useState(null)

  return (
    // reducedMotion="user": framer-motion drops transform animations for
    // visitors who ask their OS for reduced motion.
    <MotionConfig reducedMotion="user">
    <div className="relative min-h-svh overflow-x-clip bg-[#f7f1e6]">
      <SiteHeader />

      <HeroSection />
      <DiscoverProfilesSection />
      <HowItWorksSection />
      <VibePlacesSection />
      <PremiumSection />
      <SecuritySection />

      {/* About */}
      <section id="about" className="scroll-mt-20 px-4 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal from="scale" className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-3 -z-10 rotate-3 rounded-[2.25rem] bg-gradient-to-br from-pink-400/40 to-[#f2bf4e]/40" />
            <img
              src={aboutPhoto}
              alt="Un couple en tenue traditionnelle"
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-xl"
            />
          </Reveal>
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">À propos</p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-[#261b28] sm:text-5xl">
              L'amour naît quand on peut être pleinement soi-même
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-[#635a65] sm:text-lg">
              <p>
                BomaVibes est une plateforme de rencontre pensée avant tout pour les célibataires africains et de la
                diaspora : un espace où la culture, les valeurs, les traditions et les ambitions se rencontrent
                naturellement.
              </p>
              <p>
                Ici, chaque profil est une histoire, chaque échange une opportunité, et chaque rencontre peut devenir le
                début de quelque chose de beau — dans un environnement sûr, respectueux et bienveillant.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <FeaturesGridSection />
      <AppPreviewSection />
      <AvailabilitySection />
      <StatsSection />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-8">
        <h2 className="text-center font-display text-4xl font-bold text-[#261b28] sm:text-5xl">Questions fréquentes</h2>
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
                  <span className="font-display text-lg font-bold text-[#261b28]">{f.question}</span>
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
                      <p className="pt-3 text-base leading-relaxed text-[#635a65]">{f.answer}</p>
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
            className="inline-block rounded-xl bg-pink-500 px-8 py-3.5 text-base font-semibold text-[#261b28] shadow-lg transition hover:bg-pink-400"
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
    </MotionConfig>
  )
}

export default Landing
