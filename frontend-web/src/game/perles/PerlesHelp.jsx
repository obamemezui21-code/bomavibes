// How to play PERLES PUNU: the controls (mouse + keyboard, or touch), and
// with variant "full" the special beads and the scoring too.
function Key({ children }) {
  return <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">{children}</kbd>
}

const KEYBOARD = [
  ['Souris', 'viser : les pointillés montrent où la perle arrivera'],
  ['Clic', 'lancer la perle'],
  ['Espace ou clic droit', 'échanger avec la perle suivante (sous le menton du masque)'],
  ['Échap ou P', 'pause'],
]
const TOUCH = [
  ['Poser le doigt', 'viser, puis glisser pour ajuster'],
  ['Lever le doigt', 'lancer la perle'],
  ['Toucher le masque', 'échanger avec la perle suivante'],
]
const SPECIALS = [
  ['🐢', 'Ralenti', 'la rivière avance moins vite pendant 6 secondes'],
  ['⏪', 'Recul', 'la rivière recule pendant 2 secondes'],
  ['💥', 'Bombe', 'fait éclater toutes les perles autour, quelle que soit leur couleur'],
]

function PerlesHelp({ variant = 'full' }) {
  const showKeyboard = variant === 'keyboard' || variant === 'full'
  const showTouch = variant === 'touch' || variant === 'full'
  return (
    <div className="space-y-3 text-xs text-white/85">
      <p className="text-white/70">
        Lance des perles dans la rivière : 3 perles de la même couleur qui se touchent éclatent. Ne laisse aucune perle atteindre la chute !
      </p>
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
        <>
          <div>
            <p className="mb-1.5 font-semibold text-amber-300">✨ Les perles spéciales (cerclées d’or)</p>
            <ul className="space-y-1">
              {SPECIALS.map(([icon, name, what]) => (
                <li key={name}>
                  {icon} <b className="text-white">{name}</b> : {what}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-white/70">
            Quand un trou se referme sur deux perles de la même couleur, les perles reculent et peuvent éclater à leur tour : c’est un combo,
            qui rapporte bien plus. Plusieurs tirs réussis d’affilée font une série. Attrape les pièces Ngori avec une perle (+300 pts). Chaque
            niveau réussi rapporte un bonus, plus encore si tu vas vite. Tu as 3 vies pour traverser les 5 niveaux, de la Lopé aux chutes de
            Kongou. Le score donne jusqu’à 3 étoiles, chaque étoile vaut 1 Ngori.
          </p>
        </>
      ) : (
        <p className="text-white/70">✨ Les perles cerclées d’or ont un pouvoir : fais-les éclater ! Chaque couleur a aussi son petit motif.</p>
      )}
    </div>
  )
}

export default PerlesHelp
