import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'

const SECTIONS = [
  {
    title: 'Avant de rencontrer quelqu\'un en vrai',
    body: [
      'Donnez-vous le temps d\'échanger dans l\'app avant de partager votre numéro ou vos réseaux sociaux.',
      'Faites un appel vidéo avant le premier rendez-vous pour confirmer que la personne correspond à son profil.',
      'Choisissez un lieu public pour votre premier rendez-vous, et prévoyez votre propre moyen de transport.',
      'Prévenez un·e proche : où vous allez, avec qui, et à quelle heure vous comptez rentrer.',
      'Faites confiance à votre instinct — si quelque chose vous met mal à l\'aise, vous avez le droit d\'annuler à tout moment.',
    ],
  },
  {
    title: 'Ne jamais envoyer d\'argent',
    body: [
      'Un membre de BomaVibes ne vous demandera jamais d\'argent, de code de carte cadeau ou vos coordonnées bancaires.',
      'Méfiez-vous de toute personne qui invente une urgence ou un empêchement pour vous demander une aide financière, même après plusieurs échanges touchants — c\'est une technique d\'arnaque sentimentale courante.',
      'Signalez-nous immédiatement tout profil qui vous demande de l\'argent, sous quelque forme que ce soit.',
    ],
  },
  {
    title: 'Comment signaler ou bloquer quelqu\'un',
    body: [
      'Depuis une conversation ou un profil, utilisez l\'option "Signaler" pour nous alerter — notre équipe examine chaque signalement.',
      'Vous pouvez bloquer un membre à tout moment pour qu\'il ne puisse plus vous contacter ni voir votre profil.',
      'Les comptes qui violent nos règles (faux profils, harcèlement, arnaques, contenu inapproprié) sont suspendus ou définitivement fermés.',
    ],
  },
  {
    title: 'En cas d\'urgence',
    body: [
      'Si vous êtes en danger immédiat, contactez les services d\'urgence locaux avant toute autre démarche.',
      'Pour tout signalement lié à un comportement sur l\'app, écrivez-nous à Bomavibes241@gmail.com — nous vous répondons rapidement.',
    ],
  },
]

function Safety() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
        <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Communauté</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl">
          Sécurité &amp; signalement
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#6b5d4f]">
          Votre sécurité passe avant tout. Voici quelques conseils simples pour rencontrer en
          confiance, et comment nous prévenir si quelque chose ne va pas.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg font-bold text-[#2B1D14]">{s.title}</h2>
              <ul className="mt-3 space-y-2">
                {s.body.map((line) => (
                  <li key={line} className="flex gap-2 text-sm leading-relaxed text-[#6b5d4f]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pink-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-violet-600/10 pt-8">
          <p className="text-sm text-[#6b5d4f]">
            Besoin de nous alerter ?{' '}
            <a href="mailto:Bomavibes241@gmail.com" className="font-semibold text-violet-600 underline-offset-4 hover:underline">
              Bomavibes241@gmail.com
            </a>{' '}
            ou sur{' '}
            <a
              href="https://wa.me/33744233809"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-violet-600 underline-offset-4 hover:underline"
            >
              WhatsApp
            </a>
            .
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-violet-600 underline-offset-4 hover:underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Safety
