// How to play FLÈCHE D'ÉBÈNE: the gesture, and with variant "full" the
// targets and the scoring too.
const TARGETS = [
  ['🎯', 'Cible de paille', '15 pts, ×2 en plein centre'],
  ['🐗', 'Potamochère', '20 pts, il file à toute allure'],
  ['🐦', 'Pintade', '35 pts, en plein vol'],
  ['👹', 'Monstre de la forêt', '45 pts, 2 flèches (1 dans la tête). S’il arrive jusqu’à toi : un cœur perdu'],
  ['🥷', 'Braconnier', '30 pts, ×2 dans la tête. Touche-le avant qu’il tire (« ! » rouge), sinon : un cœur perdu'],
  ['🦍', 'Animal protégé (badge vert)', 'ÉPARGNE-LE : −50 pts et le combo perdu. Tire par-dessus !'],
  ['🪙', 'Pièce d’or', '75 pts, elle file tout en haut'],
]

function FlecheHelp({ variant = 'full' }) {
  return (
    <div className="space-y-3 text-xs text-white/85">
      <ul className="space-y-1">
        <li>
          🏹 <b className="text-white">Pose le doigt</b> n’importe où{variant === 'full' ? ' (ou clique)' : ''}, <b className="text-white">tire vers l’arrière</b> pour bander l’arc, <b className="text-white">relâche</b> pour décocher.
        </li>
        <li>📏 Plus tu tires loin, plus la flèche va vite et loin.</li>
        <li>🌬️ La flèche retombe et le vent la pousse : vise au-dessus des cibles lointaines.</li>
      </ul>
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
            Une touche au loin vaut le double. Enchaîne les flèches réussies pour un combo (jusqu’à ×4). 3 cœurs, 90 secondes : le score donne
            jusqu’à 3 étoiles, chaque étoile vaut 1 Ngori.
          </p>
        </div>
      ) : (
        <p className="text-white/70">👹 Arrête les monstres et les braconniers. 🦍 Épargne les animaux au badge vert.</p>
      )}
    </div>
  )
}

export default FlecheHelp
