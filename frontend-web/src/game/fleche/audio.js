// FLÈCHE D'ÉBÈNE sound: the bow, the arrow and the hits synthesised with Web
// Audio, and the games' shared music track (music.js). The AudioContext starts
// on the first tap, as browsers require.
import { muteTrack, pauseTrack, playTrack, unlockTrack } from '../music.js'

const MUTE_KEY = 'fleche.muted'

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

export function createFlecheAudio(initiallyMuted) {
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
    draw: () => tone(140, { dur: 0.25, vol: 0.05, type: 'sawtooth', slideTo: 240 }),
    // The string snaps forward, and the arrow whistles away.
    release: () => {
      tone(320, { dur: 0.09, vol: 0.2, type: 'triangle', slideTo: 110 })
      noise({ dur: 0.28, vol: 0.14, freq: 2600, type: 'bandpass' })
    },
    nocked: () => noise({ dur: 0.03, vol: 0.1, freq: 2400, type: 'bandpass' }),
    empty: () => noise({ dur: 0.025, vol: 0.08, freq: 3200, type: 'bandpass' }),
    thunk: () => {
      noise({ dur: 0.08, vol: 0.28, freq: 800 })
      tone(170, { dur: 0.1, vol: 0.18, type: 'sine', slideTo: 80 })
    },
    ground: () => noise({ dur: 0.1, vol: 0.14, freq: 500 }),
    ding: () => {
      tone(1320, { dur: 0.25, vol: 0.12, type: 'triangle' })
      tone(1980, { at: 0.02, dur: 0.2, vol: 0.06, type: 'sine' })
    },
    bullseye: () => [1320, 1760, 2640].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.2, vol: 0.1, type: 'triangle' })),
    monster: () => tone(180, { dur: 0.4, vol: 0.18, type: 'sawtooth', slideTo: 60 }),
    wound: () => tone(260, { dur: 0.15, vol: 0.14, type: 'sawtooth', slideTo: 180 }),
    bird: () => tone(1500, { dur: 0.16, vol: 0.1, type: 'triangle', slideTo: 700 }),
    protected: () => {
      tone(392, { dur: 0.22, vol: 0.14, type: 'triangle' })
      tone(311, { at: 0.2, dur: 0.35, vol: 0.14, type: 'triangle' })
    },
    gold: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.18, vol: 0.1, type: 'triangle' })),
    attack: () => {
      noise({ dur: 0.3, vol: 0.3, freq: 900 })
      tone(220, { at: 0.05, dur: 0.3, vol: 0.18, type: 'sawtooth', slideTo: 90 })
    },
    wind: () => noise({ dur: 0.7, vol: 0.09, freq: 700, type: 'bandpass' }),
    victory: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.22, vol: 0.12 })),
    defeat: () => [392, 330, 262].forEach((f, i) => tone(f, { at: i * 0.18, dur: 0.25, vol: 0.12, type: 'triangle' })),
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
    play(name) {
      if (muted || !ensure()) return
      try {
        effects[name]?.()
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
