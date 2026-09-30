import { Link } from 'react-router-dom'
import Reveal from './Reveal.jsx'
import { glow } from '../../lib/glow.js'

function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-violet-950 px-4 py-28 text-center sm:px-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem]" style={glow('var(--color-pink-500)', 22)} />
      <div className="pointer-events-none absolute -bottom-32 -right-40 h-[28rem] w-[28rem]" style={glow('var(--color-coral-600)', 22)} />

      <Reveal
        className="relative mx-auto max-w-2xl"
      >
        <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Votre prochaine rencontre commence ici
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/75">
          Rejoignez une communauté authentique, sûre et pensée pour vous. C'est gratuit, et ça prend 30 secondes.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            className="rounded-xl bg-pink-500 px-8 py-3.5 text-base font-semibold text-[#261b28] shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-pink-400 hover:shadow-xl active:translate-y-0"
          >
            Créer mon compte gratuitement
          </Link>
          <Link
            to="/welcome"
            className="rounded-xl border border-white/40 bg-white/10 px-8 py-3.5 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/20 active:translate-y-0"
          >
            Se connecter
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

export default FinalCtaSection
