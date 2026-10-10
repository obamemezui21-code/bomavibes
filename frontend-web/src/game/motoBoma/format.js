import { TICK_RATE } from '../../../../shared/moto-boma/engine.mjs'

// cm per tick → km/h
export const kmh = (speed) => Math.round((speed * TICK_RATE * 3.6) / 100)

// Race time, "1:24.6".
export function formatTicks(ticks) {
  const s = ticks / TICK_RATE
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

export const MEDAL_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' }
export const MEDAL_LABEL = { gold: 'Or', silver: 'Argent', bronze: 'Bronze' }
