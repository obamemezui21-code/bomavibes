import { BarrowIcon, BrickIcon } from './BrickIcon.jsx'
import { MATERIAL_NAMES } from './bricks.js'

// How to play CHANTIER BOMA: the controls (keyboard, or touch), and with
// variant "full" the materials and the scoring too.
function Key({ children }) {
  return <kbd className="inline-flex min-w-[1.6rem] shrink-0 items-center justify-center rounded-md border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">{children}</kbd>
}

const KEYBOARD = [
  ['← →', 'déplacer les briques'],
  ['↑', 'les tourner'],
  ['↓', 'les descendre plus vite'],
  ['Espace', 'les lâcher d’un coup'],
  ['B', 'la brouette : renvoyer ces briques'],
  ['Échap ou P', 'pause'],
]
const TOUCH = [
  ['Glisser ← →', 'déplacer les briques'],
  ['Toucher', 'les tourner'],
  ['Glisser ↓ vite', 'les lâcher d’un coup'],
  ['Boutons', 'tout est aussi en bas de l’écran, avec la brouette'],
]

function Controls({ rows }) {
  return (
    <ul className="space-y-1">
      {rows.map(([k, what]) => (
        <li key={k} className="flex items-start gap-2">
          <Key>{k}</Key>
          <span className="pt-0.5">{what}</span>
        </li>
      ))}
    </ul>
  )
}

function ChantierHelp({ variant = 'full' }) {
  const full = variant === 'full'
  return (
    <div className="space-y-3 text-xs text-white/85">
      <p className="text-white/75">
        Les briques tombent de la grue : pose chacune sur sa place du plan, <b className="text-white">dans la bonne matière</b>. Le contour{' '}
        <b className="text-emerald-300">vert</b> ou <b className="text-red-300">rouge</b> montre d’avance où elles se poseront.
      </p>
      {(full || variant === 'keyboard') && (
        <div>
          {full && <p className="mb-1.5 font-semibold text-amber-300">💻 Sur ordinateur</p>}
          <Controls rows={KEYBOARD} />
        </div>
      )}
      {(full || variant === 'touch') && (
        <div>
          {full && <p className="mb-1.5 font-semibold text-amber-300">📱 Sur téléphone</p>}
          <Controls rows={TOUCH} />
        </div>
      )}
      {full && (
        <>
          <div>
            <p className="mb-1.5 font-semibold text-amber-300">🧱 Les matières</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {['T', 'B', 'P', 'R', 'V', 'O'].map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <BrickIcon material={m} size={20} /> {MATERIAL_NAMES[m]}
                  {m === 'O' && <span className="text-white/60">: bonne partout</span>}
                </li>
              ))}
            </ul>
          </div>
          <ul className="space-y-1">
            <li>
              ✅ <b className="text-white">Bonne matière</b> : 10 pts la brique. Toutes bonnes d’un coup : <b className="text-white">Parfait</b>, et les parfaits
              d’affilée multiplient les points (jusqu’à ×4).
            </li>
            <li>
              💢 <b className="text-white">Mauvaise matière</b> : la brique se fissure, −5 de solidité.
            </li>
            <li>
              💥 <b className="text-white">Hors du plan</b> : la brique se casse, −8 de solidité. À 0, tout s’écroule !
            </li>
            <li>
              <BarrowIcon size={14} className="inline-block align-[-2px] text-amber-200" /> <b className="text-white">Brouette</b> : 3 par bâtiment, pour renvoyer des briques mal tombées. 5 parfaits d’affilée en rendent une.
            </li>
            <li>
              🏆 <b className="text-white">Chef-d’œuvre</b> : un bâtiment sans une fissure rapporte 500 pts de plus.
            </li>
          </ul>
          <p className="text-white/70">
            Cinq bâtiments, de la case du village à Saint-Michel de Nkembo. Finir vite rapporte un bonus. Le score donne jusqu’à 3 étoiles,
            chaque étoile vaut 1 Ngori.
          </p>
        </>
      )}
    </div>
  )
}

export default ChantierHelp
