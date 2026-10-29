import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'

const SECTIONS = [
  {
    title: '1. Objet',
    body: [
      'Ces Conditions d\'utilisation ("CGU") régissent l\'accès et l\'usage de BomaVibes, l\'application de rencontre destinée à la communauté africaine et afrodescendante. En créant un compte, vous acceptez ces conditions.',
    ],
  },
  {
    title: '2. Qui peut utiliser BomaVibes',
    body: [
      'Vous devez avoir 18 ans révolus pour créer un compte.',
      'Vous ne pouvez avoir qu\'un seul compte, et les informations que vous fournissez (prénom, âge, photos) doivent être exactes et vous concerner réellement.',
      'Nous nous réservons le droit de refuser ou fermer un compte qui ne respecte pas ces règles.',
    ],
  },
  {
    title: '3. Votre compte',
    body: [
      'Vous êtes responsable de la confidentialité de votre mot de passe et de toute activité effectuée depuis votre compte.',
      'Prévenez-nous immédiatement à Bomavibes241@gmail.com si vous pensez que votre compte a été utilisé sans votre autorisation.',
    ],
  },
  {
    title: '4. Règles de conduite',
    body: [
      'Respectez les autres membres : pas de harcèlement, propos haineux, menaces ou contenu à caractère sexuel non sollicité.',
      'Pas de fausse identité, de faux profil, ni d\'usurpation d\'identité.',
      'Pas de sollicitation commerciale, publicité, arnaque ou demande d\'argent envers d\'autres membres.',
      'Pas de contenu illégal, violent ou portant atteinte aux droits d\'autrui dans vos photos, bio ou messages.',
      'Le non-respect de ces règles peut entraîner un avertissement, une suspension ou une fermeture définitive de votre compte.',
    ],
  },
  {
    title: '5. Le contenu que vous publiez',
    body: [
      'Vous restez propriétaire de vos photos et de ce que vous publiez sur votre profil.',
      'En les publiant, vous nous autorisez à les afficher au sein de l\'app, uniquement pour faire fonctionner le service (afficher votre profil aux autres membres).',
      'Vous garantissez avoir le droit de publier ce contenu et qu\'il ne porte pas atteinte aux droits d\'un tiers.',
    ],
  },
  {
    title: "6. Captures d'écran et confidentialité des échanges",
    body: [
      "Les photos des autres membres et le contenu de vos conversations sont privés. Il est interdit de les capturer (capture ou enregistrement d'écran, photo de l'écran), de les copier, de les enregistrer ou de les diffuser, sur BomaVibes ou ailleurs, sans l'accord de la personne concernée.",
      "Pour dissuader ces captures, chaque photo et chaque conversation porte un filigrane discret avec le prénom et l'identifiant du membre qui les consulte : une capture diffusée permet de retrouver son auteur. Les photos ne sont accessibles qu'aux membres connectés.",
      "Diffuser la photo ou les messages d'un membre sans son accord peut entraîner la fermeture définitive de votre compte, sans préjudice des poursuites prévues par la loi (atteinte à la vie privée, droit à l'image).",
    ],
  },
  {
    title: '7. Suspension et suppression',
    body: [
      'Vous pouvez supprimer votre compte à tout moment depuis Paramètres → Supprimer mon compte ; toutes vos données sont alors définitivement effacées.',
      'Nous pouvons suspendre ou fermer un compte qui enfreint ces CGU, notamment suite à des signalements d\'autres membres.',
    ],
  },
  {
    title: '8. Avertissement',
    body: [
      'BomaVibes est un outil de mise en relation : nous ne vérifions pas l\'identité de chaque membre au-delà de nos contrôles de modération, et nous ne garantissons pas la véracité des profils ni le résultat d\'une rencontre.',
      'Restez prudent·e lors de vos échanges et de vos rencontres — consultez notre page Sécurité pour des conseils concrets.',
    ],
  },
  {
    title: '9. Modifications',
    body: [
      'Nous pouvons faire évoluer ces CGU. En cas de changement important, nous vous en informerons via l\'app avant qu\'il prenne effet.',
    ],
  },
]

function Terms() {
  return (
    <div className="relative min-h-svh bg-[#f7f1e6]">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
        <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Légal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#261b28] sm:text-4xl">
          Conditions d'utilisation
        </h1>
        <p className="mt-3 text-sm text-[#635a65]">Dernière mise à jour : octobre 2026</p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#635a65]">
          En utilisant BomaVibes, vous acceptez les règles ci-dessous. Nous les avons gardées
          aussi simples et honnêtes que possible.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg font-bold text-[#261b28]">{s.title}</h2>
              <ul className="mt-3 space-y-2">
                {s.body.map((line) => (
                  <li key={line} className="flex gap-2 text-sm leading-relaxed text-[#635a65]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pink-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-violet-600/10 pt-8">
          <p className="text-sm text-[#635a65]">
            Une question sur ces conditions ?{' '}
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

export default Terms
