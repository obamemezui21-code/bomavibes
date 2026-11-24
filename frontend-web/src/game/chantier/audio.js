// CHANTIER BOMA sound: the bricks, the crane and the site synthesised with Web
// Audio, and the games' shared music track (music.js). The AudioContext starts
// on the first tap, as browsers require.
import { muteTrack, pauseTrack, playTrack, unlockTrack } from '../music.js'

const MUTE_KEY = 'chantier.muted'

export function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // private mode: the choice just isn't remembered
  }
}

export function createChantierAudio(initiallyMuted) {
  let ctx = null
  let master = null
  let noiseBuffer = null
  let muted = initiallyMuted
  let musicOn = false

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume()
      return ctx
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.6
    master.connect(ctx.destination)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return ctx
  }

  function tone(freq, { at = 0, dur = 0.1, vol = 0.15, type = 'square', slideTo } = {}) {
    const t = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  function noise({ at = 0, dur = 0.15, vol = 0.25, freq = 1500, type = 'lowpass' } = {}) {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(filter).connect(gain).connect(master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  const effects = {
    move: () => noise({ dur: 0.03, vol: 0.09, freq: 2200, type: 'bandpass' }),
    turn: () => tone(420, { dur: 0.06, vol: 0.06, type: 'triangle', slideTo: 560 }),
    drop: () => noise({ dur: 0.12, vol: 0.14, freq: 900, type: 'bandpass' }),
    place: () => {
      noise({ dur: 0.07, vol: 0.28, freq: 700 })
      tone(150, { dur: 0.08, vol: 0.16, type: 'sine', slideTo: 80 })
    },
    // Higher as the perfect loads follow one another.
    perfect: (streak = 1) => {
      const base = 523 * 2 ** (Math.min(12, streak - 1) / 12)
      noise({ dur: 0.06, vol: 0.2, freq: 700 })
      tone(base, { dur: 0.16, vol: 0.1, type: 'triangle' })
      tone(base * 1.5, { at: 0.07, dur: 0.2, vol: 0.09, type: 'triangle' })
    },
    crack: () => {
      noise({ dur: 0.12, vol: 0.25, freq: 3000, type: 'bandpass' })
      tone(200, { dur: 0.18, vol: 0.14, type: 'sawtooth', slideTo: 110 })
    },
    broken: () => {
      noise({ dur: 0.35, vol: 0.32, freq: 1200 })
      tone(140, { at: 0.03, dur: 0.25, vol: 0.18, type: 'sawtooth', slideTo: 60 })
    },
    barrow: () => {
      noise({ dur: 0.3, vol: 0.16, freq: 600, type: 'bandpass' })
      tone(330, { at: 0.05, dur: 0.18, vol: 0.08, type: 'triangle', slideTo: 220 })
    },
    barrowBack: () => [880, 1175].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.16, vol: 0.09, type: 'triangle' })),
    level: () => [392, 523, 659].forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.18, vol: 0.1, type: 'triangle' })),
    clear: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.24, vol: 0.11, type: 'triangle' })),
    collapse: () => {
      for (let i = 0; i < 6; i++) noise({ at: i * 0.12, dur: 0.35, vol: 0.3, freq: 900 - i * 100 })
      tone(110, { dur: 0.9, vol: 0.2, type: 'sawtooth', slideTo: 40 })
    },
    victory: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.22, vol: 0.12 })),
    defeat: () => [392, 330, 262].forEach((f, i) => tone(f, { at: 0.5 + i * 0.18, dur: 0.25, vol: 0.12, type: 'triangle' })),
  }

  return {
    unlock() {
      ensure()
      unlockTrack()
    },
    startMusic() {
      if (!ensure() || musicOn) return
      musicOn = true
      playTrack(muted, () => {}) // no synthesised fallback
    },
    stopMusic() {
      musicOn = false
      pauseTrack()
    },
    setMuted(value) {
      muted = value
      muteTrack(value)
      if (master) master.gain.value = value ? 0 : 0.6
    },
    play(name, arg) {
      if (muted || !ensure()) return
      try {
        effects[name]?.(arg)
      } catch {
        // sound is never critical
      }
    },
    dispose() {
      musicOn = false
      pauseTrack()
      ctx?.close().catch(() => {})
      ctx = null
    },
  }
}
