import { motion } from 'framer-motion'
import { Heart, Mic, Send, Star, X } from 'lucide-react'

function PhoneFrame({ children, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[2.25rem] border-[10px] border-[#2B1D14] bg-white shadow-2xl"
    >
      <div className="mx-auto -mt-1 h-4 w-24 rounded-b-2xl bg-[#2B1D14]" />
      {children}
    </motion.div>
  )
}

function DiscoverMock() {
  return (
    <div className="flex h-[440px] flex-col bg-[#FAF6EF] p-3">
      <p className="mb-2 text-center text-[11px] font-bold text-[#2B1D14]">Découvrir</p>
      <div className="relative flex-1 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-400 via-pink-300 to-amber-200">
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-sm font-bold text-white">Amara, 27</p>
          <p className="text-[10px] text-white/80">Libreville · 92% match</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-coral-500 shadow">
          <X size={15} strokeWidth={2.5} />
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg">
          <Star size={16} strokeWidth={2.5} fill="currentColor" />
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-500 text-white shadow">
          <Heart size={15} strokeWidth={2.5} fill="currentColor" />
        </span>
      </div>
    </div>
  )
}

function ChatMock() {
  return (
    <div className="flex h-[440px] flex-col bg-[#FAF6EF] p-3">
      <p className="mb-2 text-center text-[11px] font-bold text-[#2B1D14]">Messages</p>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex justify-start">
          <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-black/6 px-3 py-2 text-[11px] text-[#2B1D14]">
            Salut ! Ton profil me plaît beaucoup 😊
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-r from-violet-500 to-pink-500 px-3 py-2 text-[11px] text-[#2B1D14]">
            Merci ! Le tien aussi, on discute ?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="flex w-32 items-center gap-2 rounded-2xl rounded-bl-sm bg-black/6 px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-violet-600">
              <Mic size={11} strokeWidth={2.5} />
            </span>
            <div className="h-1 flex-1 rounded-full bg-black/15" />
            <span className="text-[9px] text-[#6b5d4f]">0:12</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2">
        <span className="flex-1 text-[10px] text-[#6b5d4f]/60">Écrivez un message…</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-[#2B1D14]">
          <Send size={11} strokeWidth={2.5} />
        </span>
      </div>
    </div>
  )
}

function ProfileMock() {
  const chips = ['Voyages', 'Musique', 'Cuisine', 'Sport', 'Cinéma', 'Nature']
  return (
    <div className="flex h-[440px] flex-col bg-[#FAF6EF] p-3">
      <p className="mb-2 text-center text-[11px] font-bold text-[#2B1D14]">Votre profil</p>
      <div className="flex flex-col items-center">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-400 to-pink-300 shadow" />
        <p className="mt-2 text-xs font-bold text-[#2B1D14]">Junior, 29</p>
        <p className="text-[10px] text-[#6b5d4f]">Douala, Cameroun</p>
      </div>
      <p className="mt-4 text-[9px] font-semibold uppercase tracking-wide text-[#9c7220]">Centres d'intérêt</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-full border border-violet-400 bg-violet-500/10 px-2 py-1 text-[9px] font-medium text-violet-600">
            {c}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[9px] font-semibold uppercase tracking-wide text-[#9c7220]">Langues</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {['Français', 'Anglais', 'Douala'].map((l) => (
          <span key={l} className="rounded-full border border-black/10 px-2 py-1 text-[9px] font-medium text-[#6b5d4f]">
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

function AppPreviewSection() {
  return (
    <section id="apercu" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Découvrez BomaVibes</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#6b5d4f]">
          Un aperçu de l'expérience qui vous attend, dès votre inscription.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-3">
        <PhoneFrame delay={0}>
          <DiscoverMock />
        </PhoneFrame>
        <PhoneFrame delay={0.1}>
          <ChatMock />
        </PhoneFrame>
        <PhoneFrame delay={0.2}>
          <ProfileMock />
        </PhoneFrame>
      </div>
    </section>
  )
}

export default AppPreviewSection
