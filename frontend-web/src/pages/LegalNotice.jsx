import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'

const SECTIONS = [
  {
    title: 'Éditeur du site',
    body: [
      'Raison sociale / nom du responsable : [à compléter]',
      'Adresse : [à compléter]',
      'Email de contact : contact@bomavibes.tech',
    ],
  },
  {
    title: 'Directeur de la publication',
    body: ['[à compléter]'],
  },
  {
    title: 'Hébergement',
    body: [
      'Ce site et l\'application BomaVibes sont hébergés sur un serveur dédié.',
      'Hébergeur : [à compléter — nom et adresse de l\'hébergeur]',
    ],
  },
  {
    title: 'Propriété intellectuelle',
    body: [
      'Le nom "BomaVibes", son logo et l\'ensemble des éléments graphiques du site sont la propriété de son éditeur. Toute reproduction sans autorisation est interdite.',
    ],
  },
]

function LegalNotice() {
  return (
    <div className="relative min-h-svh bg-[#FAF6EF]">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9c7220]">Légal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl">
          Mentions légales
        </h1>

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
          <Link to="/" className="inline-block text-sm font-semibold text-[#1F3D2B] underline-offset-4 hover:underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LegalNotice
