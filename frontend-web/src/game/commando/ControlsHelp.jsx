import { CHARACTERS } from '../../../../shared/commando-okoume/engine.mjs'

// "Comment jouer": the keyboard and touch controls, and what a mission asks.
// Shown on the game page, during the mission intro and in the pause menu.

function Key({ children, wide }) {
  return (
    <kbd
      className={`inline-flex h-7 items-center justify-center rounded-md border border-b-[3px] border-current/30 bg-white/10 px-2 font-mono text-[11px] font-bold ${
        wide ? 'min-w-16' : 'min-w-7'
      }`}
    >
      {children}
    </kbd>
  )
}

const KEYBOARD = [
  { keys: [['←'], ['→']], alt: 'ou Q / D', action: 'Avancer, reculer' },
  { keys: [['Espace', true]], alt: 'ou K', action: 'Sauter' },
  { keys: [['J']], alt: 'ou clic gauche maintenu', action: 'Tirer (garder appuyé)' },
  { keys: [['↑']], alt: 'ou Z / W', action: 'Viser vers le haut (avec ← → : en diagonale)' },
  { keys: [['L']], alt: 'ou C', action: 'Pouvoir spécial' },
  { keys: [['Échap', true]], alt: 'ou bouton ⏸', action: 'Pause' },
]

const TOUCH = [
  ['◀ ▶', 'Avancer, reculer (croix à gauche)'],
  ['▲', 'Viser vers le haut'],
  ['SAUT', 'Sauter'],
  ['TIR', 'Tirer (garder appuyé)'],
  ['SPÉ', 'Pouvoir spécial (quand la jauge bleue est pleine)'],
]

/**
 * @param {{ variant?: 'full' | 'keyboard', character?: string }} props
 *   full: keyboard + touch + goals (game page); keyboard: keys only (in game)
 */
function ControlsHelp({ variant = 'full', character }) {
  const c = character ? CHARACTERS[character] : null
  return (
    <div className="space-y-4">
      <div>
        {variant === 'full' && <p className="mb-2 text-xs font-bold uppercase tracking-wide opacity-70">💻 Sur ordinateur</p>}
        <ul className="space-y-1.5">
          {KEYBOARD.map(({ keys, alt, action }) => (
            <li key={action} className="flex items-center gap-2 text-sm">
              <span className="flex w-28 shrink-0 items-center gap-1">
                {keys.map(([k, wide]) => (
                  <Key key={k} wide={wide}>
                    {k}
                  </Key>
                ))}
              </span>
              <span className="min-w-0">
                <span className="font-semibold">{action}</span>
                <span className="ml-1 text-xs opacity-60">{alt}</span>
              </span>
            </li>
          ))}
        </ul>
        {c && (
          <p className="mt-2 text-xs opacity-75">
            Pouvoir de {c.name} : <b>{c.special}</b> ({c.specialText.toLowerCase()})
          </p>
        )}
      </div>

      {variant === 'full' && (
        <>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide opacity-70">📱 Sur téléphone</p>
            <ul className="space-y-1.5">
              {TOUCH.map(([button, action]) => (
                <li key={button} className="flex items-center gap-2 text-sm">
                  <span className="flex w-28 shrink-0">
                    <span className="rounded-full border-2 border-current/30 px-2.5 py-0.5 font-mono text-[11px] font-bold">{button}</span>
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide opacity-70">🎯 Le but</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Avance vers la droite, mets les braconniers hors de combat et saute par-dessus les trous.</li>
              <li>Touche les otages (🙌) pour les libérer, ramasse les caisses <b>TRI</b> (tir triple) et <b>GRN</b> (grenades), et les trousses de soin.</li>
              <li>Au bout de la mission, bats le boss : surveille sa barre de vie en haut de l’écran.</li>
              <li>Les marques rouges au sol annoncent où une caisse va tomber : écarte-toi !</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export default ControlsHelp
