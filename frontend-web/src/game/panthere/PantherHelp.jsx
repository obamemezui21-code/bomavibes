// How to play ŒIL DE PANTHÈRE: the controls (keyboard + mouse, or touch),
// and with variant "full" the targets and the scoring too.
function Key({ children }) {
  return <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">{children}</kbd>
}

const KEYBOARD = [
  ['Souris', 'déplacer la lunette'],
  ['Clic gauche', 'tirer'],
  ['Clic droit ou R', 'recharger'],
  ['Espace ou Maj (garder)', 'retenir son souffle : la lunette ne tremble presque plus'],
  ['Échap ou P', 'pause'],
]
const TOUCH = [
  ['Glisser le doigt', 'n’importe où sur l’écran : déplace la lunette'],
  ['TIR', 'tirer au centre de la lunette'],
  ['RECH.', 'recharger'],
  ['SOUFFLE (garder)', 'la lunette ne tremble presque plus'],
]
const TARGETS = [
  ['🎯', 'Cible', '10 pts, ×2 en plein centre'],
  ['🥷', 'Braconnier', '25 pts, ×2 dans la tête. Abats-le avant qu’il tire (⚠️ rouge) !'],
  ['👹', 'Monstre de la forêt', '40 pts, il faut 2 balles (1 au fusil de précision ou dans la tête)'],
  ['🦍', 'Animal protégé', 'NE TIRE PAS : −50 pts et un cœur perdu'],
  ['🪙', 'Pièce d’or', '75 pts, elle file dans le ciel'],
]

function PantherHelp({ variant = 'full' }) {
  const showKeyboard = variant === 'keyboard' || variant === 'full'
  const showTouch = variant === 'touch' || variant === 'full'
  return (
    <div className="space-y-3 text-xs text-white/85">
      {showKeyboard && (
        <div>
          {variant === 'full' && <p className="mb-1.5 font-semibold text-amber-300">💻 Sur ordinateur</p>}
          <ul className="space-y-1">
            {KEYBOARD.map(([k, what]) => (
              <li key={k} className="flex items-start gap-2">
                <Key>{k}</Key>
                <span className="pt-0.5">{what}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showTouch && (
        <div>
          {variant === 'full' && <p className="mb-1.5 font-semibold text-amber-300">📱 Sur téléphone</p>}
          <ul className="space-y-1">
            {TOUCH.map(([k, what]) => (
              <li key={k} className="flex items-start gap-2">
                <Key>{k}</Key>
                <span className="pt-0.5">{what}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {variant === 'full' ? (
        <div>
          <p className="mb-1.5 font-semibold text-amber-300">🎯 Les cibles</p>
          <ul className="space-y-1">
            {TARGETS.map(([icon, name, what]) => (
              <li key={name}>
                {icon} <b className="text-white">{name}</b> : {what}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-white/70">
            Les cibles du fond valent le double. Enchaîne les tirs réussis pour un combo (jusqu’à ×4). 5 cœurs, 90 secondes : le score donne
            jusqu’à 3 étoiles, chaque étoile vaut 1 Ngori.
          </p>
        </div>
      ) : (
        <p className="text-white/70">🎯 Abats cibles, braconniers et monstres. 🦍 Épargne les animaux protégés (badge vert).</p>
      )}
    </div>
  )
}

export default PantherHelp
