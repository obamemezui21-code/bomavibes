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
