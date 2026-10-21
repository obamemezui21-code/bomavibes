// How to play ESCADRILLE OGOUÉ: the controls (keyboard + mouse, or touch),
// and with variant "full" the enemies, the bonuses and the scoring too.
function Key({ children }) {
  return <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">{children}</kbd>
}

const KEYBOARD = [
  ['Souris', 'le chasseur suit la souris'],
  ['Flèches, ZQSD ou WASD', 'piloter au clavier'],
  ['Espace, B ou clic droit', 'lâcher une bombe'],
  ['Échap ou P', 'pause'],
]
const TOUCH = [
  ['Glisser le doigt', 'n’importe où sur l’écran : le chasseur suit ton doigt'],
  ['BOMBE', 'détruit les tirs ennemis et touche tout l’écran'],
]
const ENEMIES = [
  ['🛸', 'Drone', '50 pts. Il fonce sur toi : abats-le ou esquive-le'],
  ['✈️', 'Avion pirate', '150 pts. Il traverse en tirant'],
  ['🚁', 'Hélicoptère', '300 pts. Il s’arrête et arrose : il lâche toujours un bonus'],
  ['🚤', 'Vedette', '250 pts, sur l’eau'],
  ['🗼', 'Tourelle', '400 pts, dans les montagnes'],
  ['🦅', 'Le Condor Noir', '10 000 pts : la forteresse volante du Serpent Noir, en fin de mission'],
]
const BONUSES = [
  ['🔴 P', 'plus de canons (jusqu’à 4 niveaux, un niveau perdu à chaque coup reçu)'],
  ['🟠 B', 'une bombe de plus'],
  ['🟢 +', 'répare un cœur'],
  ['🪙 N', '500 pts'],
]

function EscadrilleHelp({ variant = 'full' }) {
  const showKeyboard = variant === 'keyboard' || variant === 'full'
  const showTouch = variant === 'touch' || variant === 'full'
  return (
    <div className="space-y-3 text-xs text-white/85">
      <p className="text-white/70">Ton chasseur tire tout seul : toi, tu le pilotes et tu esquives.</p>
      {showKeyboard && (
        <div>
          {variant === 'full' && <p className="mb-1.5 font-semibold text-sky-300">💻 Sur ordinateur</p>}
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
          {variant === 'full' && <p className="mb-1.5 font-semibold text-sky-300">📱 Sur téléphone</p>}
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
        <>
          <div>
            <p className="mb-1.5 font-semibold text-sky-300">🎯 La flotte du Serpent Noir</p>
            <ul className="space-y-1">
              {ENEMIES.map(([icon, name, what]) => (
                <li key={name}>
                  {icon} <b className="text-white">{name}</b> : {what}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-sky-300">🎁 Les bonus</p>
            <ul className="space-y-1">
              {BONUSES.map(([icon, what]) => (
                <li key={icon}>
                  <b className="text-white">{icon}</b> : {what}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-white/70">
            Enchaîne les victoires pour un combo (jusqu’à ×5). Les pilotes abattus sautent en parachute. Abats le Condor Noir pour gagner la
            mission : chaque cœur et chaque bombe qui te restent rapportent des points. Le score donne jusqu’à 3 étoiles, chaque étoile vaut 1 Ngori.
          </p>
        </>
      ) : (
        <p className="text-white/70">🎁 Passe sur les bonus pour les ramasser. Seul le petit point au centre du chasseur peut être touché !</p>
      )}
    </div>
  )
}

export default EscadrilleHelp
