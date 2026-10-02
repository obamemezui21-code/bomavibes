import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { openCookieSettings, useCookieConsent } from '../lib/cookieConsent.js'

// What BomaVibes stores on the visitor's device or loads from third parties.
// Keep in sync with the app: a new tracker or third-party service must be
// listed here (and, if it isn't essential, get a category in cookieConsent.js).
const ESSENTIAL = [
  ['Connexion (Firebase Authentication)', 'Garde votre session ouverte d’une visite à l’autre.', 'Jusqu’à la déconnexion'],
  ['Sécurité (Firebase App Check / Google reCAPTCHA)', 'Vérifie que les requêtes viennent bien de l’app et non d’un robot.', 'Quelques heures'],
  ['Anti-robots à l’inscription (Cloudflare Turnstile)', 'Bloque les créations de comptes automatiques.', 'Le temps de l’inscription'],
  ['Notifications', 'Mémorise l’autorisation des notifications de cet appareil.', 'Jusqu’à leur désactivation'],
  ['Vos réglages', 'Thème clair/sombre, mode d’affichage de Découvrir, son et personnage de NGORI RUN.', 'Jusqu’à ce que vous les changiez'],
  ['Votre choix de cookies', 'Retient ce que vous avez accepté ou refusé ici.', '13 mois'],
]

const OPTIONAL = [
  ['Cartes (OpenStreetMap)', 'Cartes des Coins Chics, des profils proches et des positions partagées dans le chat. Les images de carte viennent des serveurs d’OpenStreetMap, qui reçoivent votre adresse IP.'],
]

function Table({ rows, columns }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-violet-600/10 bg-white/60">
      <table className="w-full text-left text-sm">
        <thead className="bg-violet-600/5 text-xs uppercase tracking-wide text-[#635a65]">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-violet-600/10 align-top">
              {row.map((cell, i) => (
                <td key={i} className={`px-4 py-3 leading-relaxed ${i === 0 ? 'font-semibold text-[#261b28]' : 'text-[#635a65]'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CookiePolicy() {
  const { decided, maps } = useCookieConsent()

  return (
    <div className="relative min-h-svh bg-[#f7f1e6]">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
        <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Légal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#261b28] sm:text-4xl">Politique de cookies</h1>
        <p className="mt-3 text-sm text-[#635a65]">Dernière mise à jour : octobre 2026</p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#635a65]">
          BomaVibes n’utilise ni publicité, ni pistage, ni statistiques de visite. Nous stockons seulement ce qui est
          nécessaire au fonctionnement de l’app, et nous ne chargeons du contenu extérieur (les cartes) qu’avec votre
          accord. Nos polices d’écriture et nos avatars sont servis par nos propres serveurs.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 p-4">
          <p className="flex-1 text-sm text-[#635a65]">
            Votre choix actuel :{' '}
            <strong className="text-[#261b28]">
              {!decided ? 'pas encore choisi' : maps ? 'cartes autorisées' : 'essentiels uniquement'}
            </strong>
          </p>
          <button
            type="button"
            onClick={openCookieSettings}
            className="rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Gérer les cookies
          </button>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-lg font-bold text-[#261b28]">1. Essentiels — toujours actifs</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#635a65]">
            Sans eux, l’app ne peut pas fonctionner ou être protégée. La loi ne demande pas votre accord pour ceux-ci.
          </p>
          <Table rows={ESSENTIAL} columns={['Élément', 'À quoi il sert', 'Durée']} />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-lg font-bold text-[#261b28]">2. Optionnels — avec votre accord</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#635a65]">
            Si vous refusez, les cartes sont remplacées par un bouton « Afficher les cartes » ; tout le reste fonctionne
            normalement.
          </p>
          <Table rows={OPTIONAL} columns={['Élément', 'À quoi il sert']} />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-lg font-bold text-[#261b28]">3. Changer d’avis</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#635a65]">
            Vous pouvez modifier votre choix à tout moment avec le bouton « Gérer les cookies » ci-dessus, en bas de la
            page d’accueil ou dans Paramètres. Vous pouvez aussi effacer les données du site dans les réglages de votre
            navigateur.
          </p>
        </section>

        <div className="mt-14 border-t border-violet-600/10 pt-8">
          <p className="text-sm text-[#635a65]">
            Voir aussi notre{' '}
            <Link to="/confidentialite" className="font-semibold text-violet-600 underline-offset-4 hover:underline">
              politique de confidentialité
            </Link>
            . Une question ?{' '}
            <a href="mailto:Bomavibes241@gmail.com" className="font-semibold text-violet-600 underline-offset-4 hover:underline">
              Bomavibes241@gmail.com
            </a>
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-violet-600 underline-offset-4 hover:underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CookiePolicy
