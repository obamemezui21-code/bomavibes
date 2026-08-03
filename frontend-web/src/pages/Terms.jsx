import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'

const SECTIONS = [
  {
    title: '1. Objet',
    body: [
      'Ces Conditions d\'utilisation ("CGU") régissent l\'accès et l\'usage de BomaVibes, l\'application de rencontre destinée à la communauté africaine et afrodescendante. En créant un compte, tu acceptes ces conditions.',
    ],
  },
  {
    title: '2. Qui peut utiliser BomaVibes',
    body: [
      'Tu dois avoir 18 ans révolus pour créer un compte.',
      'Tu ne peux avoir qu\'un seul compte, et les informations que tu fournis (prénom, âge, photos) doivent être exactes et te concerner réellement.',
      'Nous nous réservons le droit de refuser ou fermer un compte qui ne respecte pas ces règles.',
    ],
  },
  {
    title: '3. Ton compte',
    body: [
      'Tu es responsable de la confidentialité de ton mot de passe et de toute activité effectuée depuis ton compte.',
      'Préviens-nous immédiatement à Bomavibes241@gmail.com si tu penses que ton compte a été utilisé sans ton autorisation.',
    ],
  },
  {
    title: '4. Règles de conduite',
    body: [
      'Respecte les autres membres : pas de harcèlement, propos haineux, menaces ou contenu à caractère sexuel non sollicité.',
      'Pas de fausse identité, de faux profil, ni d\'usurpation d\'identité.',
      'Pas de sollicitation commerciale, publicité, arnaque ou demande d\'argent envers d\'autres membres.',
      'Pas de contenu illégal, violent ou portant atteinte aux droits d\'autrui dans tes photos, bio ou messages.',
      'Le non-respect de ces règles peut entraîner un avertissement, une suspension ou une fermeture définitive de ton compte.',
    ],
  },
  {
    title: '5. Le contenu que tu publies',
    body: [
      'Tu restes propriétaire de tes photos et de ce que tu publies sur ton profil.',
      'En les publiant, tu nous autorises à les afficher au sein de l\'app, uniquement pour faire fonctionner le service (afficher ton profil aux autres membres).',
      'Tu garantis avoir le droit de publier ce contenu et qu\'il ne porte pas atteinte aux droits d\'un tiers.',
    ],
  },
  {
    title: '6. Suspension et suppression',
    body: [
      'Tu peux supprimer ton compte à tout moment depuis Paramètres → Supprimer mon compte ; toutes tes données sont alors définitivement effacées.',
      'Nous pouvons suspendre ou fermer un compte qui enfreint ces CGU, notamment suite à des signalements d\'autres membres.',
    ],
  },
  {
    title: '7. Avertissement',
    body: [
      'BomaVibes est un outil de mise en relation : nous ne vérifions pas l\'identité de chaque membre au-delà de nos contrôles de modération, et nous ne garantissons pas la véracité des profils ni le résultat d\'une rencontre.',
      'Reste prudent·e lors de tes échanges et de tes rencontres — consulte notre page Sécurité pour des conseils concrets.',
    ],
  },
  {
    title: '8. Modifications',
    body: [
      'Nous pouvons faire évoluer ces CGU. En cas de changement important, nous t\'en informerons via l\'app avant qu\'il prenne effet.',
    ],
  },
]

function Terms() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">Légal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl">
          Conditions d'utilisation
        </h1>
        <p className="mt-3 text-sm text-[#6b5d4f]">Dernière mise à jour : août 2026</p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#6b5d4f]">
          En utilisant BomaVibes, tu acceptes les règles ci-dessous. On les a gardées aussi
          simples et honnêtes que possible.
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
            Une question sur ces conditions ?{' '}
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

export default Terms
