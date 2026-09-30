import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { Camera, Compass, Heart, MapPin, MessageCircle } from 'lucide-react'
import Reveal from './Reveal.jsx'


const STEPS = [
  {
    icon: Camera,
    title: 'Créez votre profil',
    text: 'Quelques photos, quelques mots, vos centres d’intérêt. Faites-le vérifier par selfie pour inspirer confiance dès le premier regard.',
  },
  {
    icon: Compass,
    title: 'Découvrez des personnes',
    text: 'Parcourez des profils près de chez vous, filtrés selon l’âge, la distance et ce que vous recherchez vraiment.',
  },
  {
    icon: Heart,
    title: 'Créez un match',
    text: 'Un like, un Super Like… Quand l’intérêt est réciproque, c’est un match : la conversation peut commencer.',
  },
  {
    icon: MessageCircle,
    title: 'Échangez',
    text: 'Messages, notes vocales, appels audio et vidéo : prenez le temps de vous découvrir, à votre rythme.',
  },
  {
    icon: MapPin,
    title: 'Faites évoluer la rencontre',
    text: 'Le courant passe ? Proposez un vrai rendez-vous dans un lieu sélectionné grâce à Vibe Places.',
  },
]

function HowItWorksSection() {
  const listRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 75%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })

  return (
    <section id="comment-ca-marche" className="scroll-mt-20 bg-white px-4 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Comment ça marche</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-[#261b28] sm:text-5xl">
            Du premier regard au premier rendez-vous
          </h2>
        </Reveal>

        <ol ref={listRef} className="relative mt-14 space-y-10 sm:space-y-12">
          {/* Track + scroll-driven fill */}
          <div aria-hidden="true" className="absolute bottom-6 left-[1.6rem] top-6 w-0.5 rounded-full bg-violet-600/10 sm:left-[2.1rem]" />
          <motion.div
            aria-hidden="true"
            style={{ scaleY: progress }}
            className="absolute bottom-6 left-[1.6rem] top-6 w-0.5 origin-top rounded-full bg-gradient-to-b from-pink-500 via-violet-500 to-[#f2bf4e] sm:left-[2.1rem]"
          />

          {STEPS.map((step, i) => (
            <Reveal
              key={step.title} as="li" from="left"              className="relative flex gap-5 sm:gap-7"
            >
              <div className="relative z-10 flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4b164c] to-violet-500 text-white shadow-lg shadow-violet-500/25 sm:h-[4.25rem] sm:w-[4.25rem]">
                <step.icon size={22} strokeWidth={2} className="sm:hidden" />
                <step.icon size={26} strokeWidth={2} className="hidden sm:block" />
              </div>
              <div className="min-w-0 pt-1">
                <p className="font-display text-sm font-extrabold tracking-widest text-pink-500">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-0.5 font-display text-xl font-bold text-[#261b28] sm:text-2xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#635a65] sm:text-base">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default HowItWorksSection
