// First-message ideas shown in an empty conversation. Personal ones come
// first (their prompt answers, shared interests, their city), then general
// questions fill the rest. Pure data in, strings out — easy to extend.

const GENERAL = [
  'Plutôt soirée posée à la maison ou sortie au bord de mer ?',
  "Quel est ton plat gabonais préféré ? Moi je ne dis jamais non à un bon poulet nyembwe 😋",
  "Si on se voyait ce week-end, tu proposerais quoi ?",
  'Quelle chanson tu écoutes en boucle en ce moment ?',
  "C'est quoi le meilleur conseil qu'on t'ait jamais donné ?",
  'Matin ou soir ? Je dois savoir avant de continuer 😄',
  "Qu'est-ce qui t'a fait sourire aujourd'hui ?",
  'Ton voyage de rêve, ce serait où ?',
  'Tu es plutôt Pointe-Denis, Cap Estérias ou Lopé ?',
  'Deux vérités et un mensonge sur toi ? Je devine 🕵️',
  "Qu'est-ce que tu fais quand tu as une journée entière rien que pour toi ?",
  'Série du moment ? Je cherche quoi regarder ce soir.',
]

const INTEREST_LINES = [
  (i) => `On a ${i.toLowerCase()} en commun ! Qu'est-ce qui t'a fait aimer ça ?`,
  (i) => `Je vois que tu aimes aussi ${i.toLowerCase()} 👀 Ton meilleur souvenir avec ça ?`,
]

function shuffle(list, seed) {
  // Deterministic for a given seed, so the ideas don't jump on every render.
  const out = [...list]
  let s = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// other: the match's profile ({ firstName, city, interests, prompts }),
// mine: my interests. seed: changes when the member asks for other ideas.
export function icebreakersFor(other, mine = [], seed = 1, count = 3) {
  const personal = []

  for (const p of other?.prompts || []) {
    if (!p?.question || !p?.answer) continue
    const topic = p.question.replace(/…$/, '').trim()
    personal.push(`« ${topic} » : ta réponse m'a intrigué·e ! Raconte-moi en plus ?`)
  }

  const shared = (other?.interests || []).filter((i) => mine.includes(i))
  shared.forEach((interest, idx) => personal.push(INTEREST_LINES[idx % INTEREST_LINES.length](interest)))

  if (other?.city) personal.push(`Tu es de ${other.city} ? C'est quoi ton coin préféré là-bas ?`)

  const pool = [...shuffle(personal, seed), ...shuffle(GENERAL, seed)]
  // Rotate by seed so "autres idées" also brings new personal lines.
  const start = ((seed - 1) * count) % pool.length
  const rotated = [...pool.slice(start), ...pool.slice(0, start)]
  return [...new Set(rotated)].slice(0, count)
}
