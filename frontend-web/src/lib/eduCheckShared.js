// EDU-CHECK constants and helpers shared by its screens (components/eduCheck/).

export const BANDS = {
  faible: { label: 'Indice faible', range: '0–20', className: 'bg-mint-500/15 text-mint-600 dark:text-mint-400' },
  limite: { label: 'Indice limité', range: '21–40', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  modere: { label: 'Indice modéré', range: '41–60', className: 'bg-gold/20 text-[#7a5200] dark:text-gold' },
  eleve: { label: 'Indice élevé', range: '61–80', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  tres_eleve: { label: 'Indice très élevé', range: '81–100', className: 'bg-coral-500/15 text-coral-600 dark:text-coral-400' },
  non_concluant: { label: 'Non concluant', range: '', className: 'bg-ink/8 text-ink-soft' },
}

export const countWords = (text) => (String(text).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length

// A level shared by the three AI engines: how strong the indication is.
export const LEVEL_TONES = {
  aucune: { label: 'Aucune preuve', color: '#4cc3ff', glow: 'rgba(76,195,255,.35)', step: 0 },
  faible: { label: 'Indication faible', color: '#2fd083', glow: 'rgba(47,208,131,.35)', step: 1 },
  moderee: { label: 'Indication modérée', color: '#ffc83d', glow: 'rgba(255,200,61,.35)', step: 2 },
  elevee: { label: 'Indication élevée', color: '#ff6b5e', glow: 'rgba(255,107,94,.4)', step: 3 },
  off: { label: 'Indisponible', color: '#8b8198', glow: 'rgba(139,129,152,.2)', step: 0 },
}

// The style index (0–100) on the same three steps.
export const styleLevel = (score) => (score > 60 ? 'elevee' : score > 40 ? 'moderee' : 'faible')

export const scoreColor = (v) => (v >= 80 ? '#2fd083' : v >= 60 ? '#ffc83d' : '#ff6b5e')
