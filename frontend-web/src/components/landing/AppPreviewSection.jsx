import { motion } from 'framer-motion'
import { Flag, Heart, Lock, Mic, Send, ShieldOff, Sparkles, Star, X } from 'lucide-react'

function PhoneFrame({ children, label, delay, tilt }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt }}
      viewport={{ once: true, margin: '-60px' }}
      whileHover={{ rotate: 0, scale: 1.035, y: -6 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="mx-auto w-full max-w-[240px]"
    >
      <div className="overflow-hidden rounded-[2.25rem] border-[10px] border-[#2B1D14] bg-white shadow-2xl shadow-[#1F3D2B]/20">
        <div className="mx-auto -mt-1 h-4 w-24 rounded-b-2xl bg-[#2B1D14]" />
        {children}
      </div>
      <p className="mt-4 text-center text-sm font-semibold text-[#2B1D14]">{label}</p>
    </motion.div>
  )
}

function DiscoverMock() {
  return (
    <div className="flex h-[410px] flex-col bg-[#FAF6EF] p-3">
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
    <div className="flex h-[410px] flex-col bg-[#FAF6EF] p-3">
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
    <div className="flex h-[410px] flex-col bg-[#FAF6EF] p-3">
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

function LikesYouMock() {
  return (
    <div className="flex h-[410px] flex-col bg-[#FAF6EF] p-3">
      <p className="mb-2 text-center text-[11px] font-bold text-[#2B1D14]">Qui vous a aimé·e</p>
      <div className="grid flex-1 grid-cols-2 gap-2">
        {['from-violet-400 to-pink-300', 'from-amber-200 to-pink-300', 'from-mint-300 to-violet-300', 'from-pink-300 to-amber-200'].map(
          (g, i) => (
            <div key={i} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${g} blur-[2px]`}>
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <Lock size={14} className="text-white/90" strokeWidth={2.5} />
              </div>
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 py-2">
        <Sparkles size={12} strokeWidth={2.5} className="text-[#2B1D14]" />
        <span className="text-[10px] font-bold text-[#2B1D14]">12 personnes vous ont aimé·e</span>
      </div>
    </div>
  )
}

function SecurityMock() {
  return (
    <div className="flex h-[410px] flex-col bg-[#FAF6EF] p-3">
      <div className="flex items-center gap-2 rounded-t-xl bg-white px-2 py-2 shadow-sm">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-400 to-pink-300" />
        <span className="flex-1 text-[11px] font-bold text-[#2B1D14]">Kwame</span>
      </div>
      <div className="relative flex-1 rounded-b-xl bg-white px-2 pb-2">
        <div className="ml-auto mt-2 w-40 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
          <div className="flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold text-[#2B1D14]">
            <Flag size={12} strokeWidth={2.25} />
            Signaler
          </div>
          <div className="flex items-center gap-2 border-t border-black/6 px-3 py-2.5 text-[10px] font-semibold text-coral-500">
            <ShieldOff size={12} strokeWidth={2.25} />
            Bloquer
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] font-medium text-[#6b5d4f]">
        Effet immédiat, des deux côtés
      </p>
    </div>
  )
}

function OnboardingMock() {
  const countries = [
    { flag: '🇬🇦', name: 'Gabon', active: true },
    { flag: '🇨🇲', name: 'Cameroun', active: false },
    { flag: '🇸🇳', name: 'Sénégal', active: false },
  ]
  const regions = ['Estuaire', 'Haut-Ogooué', 'Ngounié']
  return (
    <div className="flex h-[410px] flex-col bg-[#FAF6EF] p-3">
      <p className="mb-2 text-center text-[11px] font-bold text-[#2B1D14]">Où vous êtes</p>
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-[#9c7220]">Pays</p>
      <div className="flex flex-wrap gap-1.5">
        {countries.map((c) => (
          <span
            key={c.name}
            className={`rounded-full border px-2 py-1 text-[9px] font-medium ${
              c.active ? 'border-violet-400 bg-violet-500/15 text-violet-600' : 'border-black/10 text-[#6b5d4f]'
            }`}
          >
            {c.flag} {c.name}
          </span>
        ))}
      </div>
      <p className="mb-2 mt-4 text-[9px] font-semibold uppercase tracking-wide text-[#9c7220]">Région</p>
      <div className="flex flex-wrap gap-1.5">
        {regions.map((r, i) => (
          <span
            key={r}
            className={`rounded-full border px-2 py-1 text-[9px] font-medium ${
              i === 0 ? 'border-violet-400 bg-violet-500/15 text-violet-600' : 'border-black/10 text-[#6b5d4f]'
            }`}
          >
            {r}
          </span>
        ))}
      </div>
      <div className="mt-auto rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2 text-center text-[10px] font-bold text-[#2B1D14]">
        Continuer
      </div>
    </div>
  )
}

const SCREENS = [
  { label: 'Découvrir', Mock: DiscoverMock, tilt: -3 },
  { label: 'Messagerie & notes vocales', Mock: ChatMock, tilt: 2 },
  { label: 'Profil enrichi', Mock: ProfileMock, tilt: -2 },
  { label: 'Qui vous a aimé·e', Mock: LikesYouMock, tilt: 3 },
  { label: 'Sécurité en un geste', Mock: SecurityMock, tilt: -2 },
  { label: 'Onboarding guidé', Mock: OnboardingMock, tilt: 2 },
]

function AppPreviewSection() {
  return (
    <section id="apercu" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Découvrez BomaVibes</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#6b5d4f]">
          Un aperçu de l'expérience qui vous attend, dès votre inscription.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-14 sm:grid-cols-3 sm:gap-x-10">
        {SCREENS.map(({ label, Mock, tilt }, i) => (
          <PhoneFrame key={label} label={label} delay={i * 0.08} tilt={tilt}>
            <Mock />
          </PhoneFrame>
        ))}
      </div>
    </section>
  )
}

export default AppPreviewSection
