import { BadgeCheck, Camera, Check, CheckCircle2, Heart, Mic, MicOff, PhoneOff, Send, Star, Video, X } from 'lucide-react'
import { DEMO_PROFILES } from '../../lib/demoProfiles.js'
import FlagIcon from '../FlagIcon.jsx'
import Reveal from './Reveal.jsx'

const { aicha, ines, kofi, serge, zola } = DEMO_PROFILES

// Reveal on scroll (CSS), then a resting tilt that straightens on hover.
// Tilt uses the `rotate` property and hover the `translate`/`scale` ones, so
// none of them fights the reveal animation (which runs on `transform`).
function PhoneFrame({ children, label, delay, tilt }) {
  return (
    <Reveal delay={delay} className="w-[220px] shrink-0 snap-center sm:mx-auto sm:w-full sm:max-w-[240px]">
      <div
        style={{ '--tilt': `${tilt}deg` }}
        className="rotate-[var(--tilt)] transition duration-500 ease-out hover:-translate-y-1.5 hover:rotate-0 hover:scale-[1.035]"
      >
        <div className="overflow-hidden rounded-[2.25rem] border-[10px] border-[#261b28] bg-white shadow-2xl shadow-violet-600/20">
          <div className="mx-auto -mt-1 h-4 w-24 rounded-b-2xl bg-[#261b28]" />
          {children}
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-[#261b28]">{label}</p>
      </div>
    </Reveal>
  )
}

function DiscoverMock() {
  return (
    <div className="flex h-[410px] flex-col bg-[#f7f1e6] p-3">
      <p className="mb-2 text-center text-[11px] font-bold text-[#261b28]">Découvrir</p>
      <div className="relative flex-1 overflow-hidden rounded-2xl">
        <img loading="lazy" decoding="async" src={aicha.photo} alt="Aïcha" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="flex items-center gap-1 text-sm font-bold text-white">
            Aïcha, 27
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500">
              <Check size={8} strokeWidth={3.5} />
            </span>
          </p>
          <p className="text-[10px] text-white/80">Paris · 89% match</p>
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
    <div className="flex h-[410px] flex-col bg-[#f7f1e6] p-3">
      <p className="mb-2 text-center text-[11px] font-bold text-[#261b28]">Messages</p>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex justify-start">
          <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-black/6 px-3 py-2 text-[11px] text-[#261b28]">
            Salut ! Ton profil me plaît beaucoup 😊
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-r from-violet-500 to-pink-500 px-3 py-2 text-[11px] text-[#261b28]">
            Merci ! Le tien aussi, on discute ?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="flex w-32 items-center gap-2 rounded-2xl rounded-bl-sm bg-black/6 px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-violet-600">
              <Mic size={11} strokeWidth={2.5} />
            </span>
            <div className="h-1 flex-1 rounded-full bg-black/15" />
            <span className="text-[9px] text-[#635a65]">0:12</span>
          </div>
        </div>
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint-500/15 text-mint-600">
            <Video size={10} strokeWidth={2.5} />
          </span>
          <span className="text-[9px] font-medium text-[#261b28]">Appel vidéo · 12 min</span>
          <span className="text-[9px] font-bold text-violet-600">Rappeler</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2">
        <span className="flex-1 text-[10px] text-[#635a65]/60">Écrivez un message…</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-[#261b28]">
          <Send size={11} strokeWidth={2.5} />
        </span>
      </div>
    </div>
  )
}

function VideoCallMock() {
  return (
    <div className="relative flex h-[410px] flex-col bg-[#1c1024]">
      <img loading="lazy" decoding="async" src={zola.photo} alt="Zola" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-3 text-center">
        <p className="text-xs font-bold text-white">Zola</p>
        <p className="text-[10px] text-white/80">Appel vidéo · 04:12</p>
      </div>
      <img
        loading="lazy"
        decoding="async"
        src={kofi.photo}
        alt=""
        className="absolute right-3 top-14 h-20 w-14 rounded-xl border-2 border-white/80 object-cover shadow-lg"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pb-5 pt-10">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white">
          <MicOff size={14} strokeWidth={2.5} />
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-coral-500 text-white shadow-lg">
          <PhoneOff size={16} strokeWidth={2.5} />
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white">
          <Video size={14} strokeWidth={2.5} />
        </span>
      </div>
    </div>
  )
}

function ColorPostsMock() {
  const posts = [
    { text: 'Qui est chaud pour un resto ce week-end à Libreville ? 🍲', bg: 'linear-gradient(135deg, #4b164c 0%, #8a4d8b 100%)', color: '#fff', font: 'Outfit, sans-serif', weight: 800, who: 'Inès', photo: ines.photo },
    { text: 'La vie est belle quand on sourit ☀️', bg: 'linear-gradient(135deg, #f2726c 0%, #f2bf4e 100%)', color: '#2b1a2c', font: '"Dancing Script", cursive', weight: 700, who: 'Serge', photo: serge.photo },
  ]
  return (
    <div className="flex h-[410px] flex-col gap-2.5 bg-[#f7f1e6] p-3">
      <p className="text-center text-[11px] font-bold text-[#261b28]">Fil d'actualité</p>
      {posts.map((p) => (
        <div key={p.who} className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <img loading="lazy" decoding="async" src={p.photo} alt="" className="h-5 w-5 rounded-full object-cover" />
            <span className="text-[10px] font-bold text-[#261b28]">{p.who}</span>
          </div>
          <div
            className="flex h-[118px] items-center justify-center px-4 text-center text-[13px] leading-snug"
            style={{ background: p.bg, color: p.color, fontFamily: p.font, fontWeight: p.weight }}
          >
            {p.text}
          </div>
        </div>
      ))}
      <div className="mt-auto flex items-center justify-center gap-1.5">
        {['#4b164c', '#dd88cf', '#f2726c', '#1f6b44', '#1e5aa8'].map((c) => (
          <span key={c} className="h-5 w-5 rounded-full ring-2 ring-white" style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}

function VerifiedMock() {
  return (
    <div className="flex h-[410px] flex-col items-center bg-[#f7f1e6] p-3">
      <p className="mb-4 text-center text-[11px] font-bold text-[#261b28]">Vérification du profil</p>
      <div className="relative">
        <img loading="lazy" decoding="async" src={kofi.photo} alt="Kofi" className="h-24 w-24 rounded-full object-cover shadow-lg ring-4 ring-white" />
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow">
          <BadgeCheck size={22} strokeWidth={2.25} className="text-sky-500" />
        </span>
      </div>
      <p className="mt-3 text-sm font-bold text-[#261b28]">Kofi, 33</p>
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2.5 py-1 text-[10px] font-bold text-sky-600">
        <BadgeCheck size={11} strokeWidth={2.5} />
        Profil vérifié
      </span>
      <div className="mt-5 w-full space-y-2">
        {['Selfie avec la pose demandée', 'Vérifié par notre équipe', 'Badge ✓ activé'].map((step) => (
          <div key={step} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint-500 text-white">
              <Check size={11} strokeWidth={3} />
            </span>
            <span className="text-[10px] font-medium text-[#261b28]">{step}</span>
          </div>
        ))}
      </div>
      <p className="mt-auto flex items-center gap-1 text-[10px] text-[#635a65]">
        <Camera size={11} strokeWidth={2.25} />
        Votre selfie n'est jamais affiché
      </p>
    </div>
  )
}

function MobileMoneyMock() {
  return (
    <div className="flex h-[410px] flex-col bg-[#f7f1e6] p-3">
      <p className="mb-3 text-center text-[11px] font-bold text-[#261b28]">Activer Diamant Rouge</p>
      <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
        <p className="text-[10px] text-[#635a65]">Forfait mensuel</p>
        <p className="whitespace-nowrap font-display text-lg font-extrabold text-[#261b28]">3 500 FCFA</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {['Likes illimités', 'Boost 3×/sem.', 'Appels'].map((perk) => (
            <span key={perk} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-medium text-violet-600">
              {perk}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[9px] font-semibold uppercase tracking-wide text-pink-600">Numéro Mobile Money</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-violet-400 bg-white px-3 py-2">
        <FlagIcon code="GA" className="!h-3 !w-4 rounded-sm" />
        <span className="text-[11px] font-medium text-[#261b28]">+241 074 12 34 56</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        <span className="flex-1 rounded-lg bg-[#e4002b] py-1.5 text-center text-[9px] font-bold text-white">Airtel Money</span>
        <span className="flex-1 rounded-lg bg-[#0066b3] py-1.5 text-center text-[9px] font-bold text-white">Moov Money</span>
      </div>
      <div className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-mint-500 py-2.5 text-[11px] font-bold text-white">
        <CheckCircle2 size={13} strokeWidth={2.5} />
        Paiement réussi, forfait activé
      </div>
    </div>
  )
}

const SCREENS = [
  { label: 'Découvrir', Mock: DiscoverMock, tilt: -3 },
  { label: 'Messagerie & appels', Mock: ChatMock, tilt: 2 },
  { label: 'Appels vidéo', Mock: VideoCallMock, tilt: -2 },
  { label: 'Publications en couleur', Mock: ColorPostsMock, tilt: 3 },
  { label: 'Profil vérifié', Mock: VerifiedMock, tilt: -2 },
  { label: 'Paiement Mobile Money', Mock: MobileMoneyMock, tilt: 2 },
]

function AppPreviewSection() {
  return (
    <section id="apercu" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#261b28] sm:text-5xl">Découvrez BomaVibes</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#635a65]">
          Un aperçu de l'expérience qui vous attend, dès votre inscription.
        </p>
      </div>

      {/* Phones keep their real proportions: a swipeable, snapping row on
          mobile (two squeezed columns looked stretched), a 3-column grid from
          tablet up. The row bleeds to the screen edges so a phone peeks in. */}
      <div className="-mx-4 mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[calc(50%-110px)] pb-6 pt-4 [scrollbar-width:none] sm:mx-0 sm:mt-16 sm:grid sm:grid-cols-3 sm:gap-x-10 sm:gap-y-14 sm:overflow-visible sm:p-0 [&::-webkit-scrollbar]:hidden">
        {SCREENS.map(({ label, Mock, tilt }, i) => (
          <PhoneFrame key={label} label={label} delay={Math.min(i, 2) * 0.08} tilt={tilt}>
            <Mock />
          </PhoneFrame>
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-medium text-[#635a65]/70 sm:hidden">← Faites glisser pour voir les autres écrans →</p>
    </section>
  )
}

export default AppPreviewSection
