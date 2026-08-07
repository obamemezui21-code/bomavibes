import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'

const SECTIONS = [
  {
    title: 'Éditeur du site',
    body: [
      'Raison sociale / nom du responsable : [à compléter]',
      'Adresse : [à compléter]',
      'Email de contact : Bomavibes241@gmail.com',
      (
        <>
          WhatsApp :{' '}
          <a
            href="https://wa.me/33744233809"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-violet-600 underline-offset-2 hover:underline"
          >
            +33 7 44 23 38 09
          </a>
        </>
      ),
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
        <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Légal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#2B1D14] sm:text-4xl">
          Mentions légales
        </h1>

        <div className="mt-12 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg font-bold text-[#2B1D14]">{s.title}</h2>
              <ul className="mt-3 space-y-2">
                {s.body.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-[#6b5d4f]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pink-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-violet-600/10 pt-8">
          <Link to="/" className="inline-block text-sm font-semibold text-violet-600 underline-offset-4 hover:underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LegalNotice
