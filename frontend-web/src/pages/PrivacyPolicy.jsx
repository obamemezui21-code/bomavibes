import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'

const SECTIONS = [
  {
    title: '1. Les données que nous collectons',
    body: [
      'Informations de compte : prénom, email et mot de passe (ou votre compte Google si vous choisissez cette option).',
      'Informations de profil : âge, genre, photos, bio, centres d\'intérêt et préférences de rencontre (genre recherché, distance).',
      'Contenu que vous générez : messages échangés avec vos matchs, signalements que vous envoyez.',
      'Données techniques : type d\'appareil, navigateur, et le jeton de notification si vous activez les notifications push.',
    ],
  },
  {
    title: '2. Pourquoi nous les utilisons',
    body: [
      'Créer et afficher votre profil aux autres membres, et vous proposer des profils pertinents selon vos préférences.',
      'Permettre les matchs et la messagerie entre membres qui se sont mutuellement likés.',
      'Vérifier l\'authenticité des profils et assurer la sécurité de la communauté (modération, lutte contre les faux comptes).',
      'Vous envoyer des notifications liées à l\'app (nouveau match, nouveau message) si vous les avez autorisées.',
    ],
  },
  {
    title: '3. Avec qui vos données sont partagées',
    body: [
      'Nous ne vendons jamais vos données à des tiers.',
      'Votre profil (photos, âge, bio, centres d\'intérêt) est visible par les autres membres de BomaVibes dans le cadre normal de l\'app.',
      'Nous utilisons des prestataires techniques (hébergement, authentification, stockage des photos) uniquement pour faire fonctionner le service, sous leurs propres engagements de sécurité.',
    ],
  },
  {
    title: '4. Combien de temps nous les conservons',
    body: [
      'Tant que votre compte est actif, pour vous fournir le service.',
      'Si vous supprimez votre compte depuis les Paramètres, toutes vos données (profil, photos, messages) sont définitivement effacées de nos systèmes.',
    ],
  },
  {
    title: '5. Comment elles sont protégées',
    body: [
      'Les mots de passe sont chiffrés et jamais stockés en clair.',
      'Les échanges avec l\'app sont chiffrés en transit (HTTPS).',
      'L\'accès à nos systèmes est limité à l\'équipe technique qui en a strictement besoin.',
    ],
  },
  {
    title: '6. Vos droits',
    body: [
      'Vous pouvez à tout moment consulter et modifier vos informations de profil directement dans l\'app.',
      'Vous pouvez supprimer votre compte et toutes les données associées depuis Paramètres → Supprimer mon compte.',
      'Pour toute autre demande (accès, rectification, question sur vos données), écrivez-nous à Bomavibes241@gmail.com.',
    ],
  },
  {
    title: '7. Cookies',
    body: [
      'Nous utilisons uniquement des cookies/stockage technique nécessaires au fonctionnement du site (garder votre session connectée). Nous n\'utilisons pas de cookies publicitaires tiers.',
    ],
  },
  {
    title: '8. Âge minimum',
    body: [
      'BomaVibes est réservé aux personnes de 18 ans et plus. La création de compte est refusée en dessous de cet âge.',
    ],
  },
  {
    title: '9. Modifications de cette politique',
    body: [
      'Si cette politique évolue de façon significative, nous vous en informerons via l\'app avant que les changements prennent effet.',
    ],
  },
]

function PrivacyPolicy() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">Légal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-sm text-[#6b5d4f]">Dernière mise à jour : août 2026</p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#6b5d4f]">
          Chez BomaVibes, nous savons que vous nous confiez des informations personnelles pour
          trouver des connexions authentiques. Cette page explique simplement quelles données nous
          collectons, pourquoi, et comment vous gardez le contrôle dessus.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg font-bold text-[#2B1D14]">{s.title}</h2>
              <ul className="mt-3 space-y-2">
                {s.body.map((line) => (
                  <li key={line} className="flex gap-2 text-sm leading-relaxed text-[#6b5d4f]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#C9962B]" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-[#1F3D2B]/10 pt-8">
          <p className="text-sm text-[#6b5d4f]">
            Une question sur vos données ?{' '}
            <a href="mailto:Bomavibes241@gmail.com" className="font-semibold text-[#1F3D2B] underline-offset-4 hover:underline">
              Bomavibes241@gmail.com
            </a>{' '}
            ou sur{' '}
            <a
              href="https://wa.me/33744233809"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1F3D2B] underline-offset-4 hover:underline"
            >
              WhatsApp
            </a>
            .
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-[#1F3D2B] underline-offset-4 hover:underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
