// PERLES PUNU sound: wooden clicks and balafon-like notes synthesised with
// Web Audio (a burst climbs higher with each combo), the falls' warning
// drum, and the games' shared music track (music.js). The AudioContext
// starts on the first tap, as browsers require.
import { muteTrack, pauseTrack, playTrack, unlockTrack } from '../music.js'

const MUTE_KEY = 'perles.muted'
// A pentatonic scale, like a balafon's keys.
const SCALE = [392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319]

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

export function createPerlesAudio(initiallyMuted) {
  let ctx = null
  let master = null
  let noiseBuffer = null
  let muted = initiallyMuted
  let musicOn = false
  let lastDrum = 0

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume()
      return ctx
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.55
    master.connect(ctx.destination)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return ctx
  }

  function tone(freq, { at = 0, dur = 0.15, vol = 0.15, type = 'sine', slideTo } = {}) {
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

  function noise({ at = 0, dur = 0.08, vol = 0.15, freq = 2000, type = 'bandpass' } = {}) {
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

  // A balafon key: a quick sine with a woody knock.
  function key(freq, at = 0, vol = 0.14) {
    tone(freq, { at, dur: 0.35, vol, type: 'sine' })
    tone(freq * 2.01, { at, dur: 0.12, vol: vol * 0.35, type: 'triangle' })
    noise({ at, dur: 0.03, vol: vol * 0.6, freq: 1800 })
  }

  const effects = {
    throw: () => noise({ dur: 0.09, vol: 0.08, freq: 3000, type: 'highpass' }),
    insert: () => {
      noise({ dur: 0.04, vol: 0.18, freq: 1200 })
      tone(320, { dur: 0.06, vol: 0.08, type: 'triangle' })
    },
    swap: () => tone(700, { dur: 0.06, vol: 0.06, type: 'triangle', slideTo: 900 }),
    burst: (combo = 1) => {
      const base = Math.min(SCALE.length - 3, (combo - 1) * 2)
      key(SCALE[base], 0)
      key(SCALE[base + 2], 0.07)
      if (combo > 1) key(SCALE[base + 3], 0.14, 0.16)
    },
    streak: () => [0, 2, 4].forEach((i, n) => key(SCALE[5 + i] || 1319, n * 0.06, 0.1)),
    coin: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.16, vol: 0.1, type: 'triangle' })),
    coinUp: () => tone(1568, { dur: 0.25, vol: 0.06, type: 'sine', slideTo: 2093 }),
    ralenti: () => tone(500, { dur: 0.7, vol: 0.12, type: 'sine', slideTo: 180 }),
    recul: () => tone(200, { dur: 0.6, vol: 0.12, type: 'sawtooth', slideTo: 700 }),
    bombe: () => {
      noise({ dur: 0.6, vol: 0.4, freq: 500, type: 'lowpass' })
      tone(90, { dur: 0.5, vol: 0.25, type: 'sine', slideTo: 30 })
    },
    miss: () => {},
    // A talking-drum beat when the beads near the falls.
    danger: () => {
      const now = ctx.currentTime
      if (now - lastDrum < 0.6) return
      lastDrum = now
      tone(110, { dur: 0.18, vol: 0.22, type: 'sine', slideTo: 70 })
      tone(110, { at: 0.2, dur: 0.18, vol: 0.16, type: 'sine', slideTo: 70 })
    },
    level: () => [0, 2, 4, 5].forEach((i, n) => key(SCALE[i], n * 0.12, 0.12)),
    clear: () => [0, 2, 4, 5, 7, 9].forEach((i, n) => key(SCALE[i], n * 0.09, 0.13)),
    lost: () => [7, 5, 4, 2, 0].forEach((i, n) => key(SCALE[i], n * 0.14, 0.12)),
    victory: () => [0, 2, 4, 5, 7, 9, 7, 9].forEach((i, n) => key(SCALE[i], n * 0.11, 0.14)),
    defeat: () => [4, 2, 1, 0].forEach((i, n) => tone(SCALE[i] / 2, { at: n * 0.22, dur: 0.35, vol: 0.12, type: 'triangle' })),
  }

  return {
    unlock() {
      ensure()
      unlockTrack()
    },
    startMusic() {
      if (!ensure() || musicOn) return
      musicOn = true
      playTrack(muted, () => {})
    },
    stopMusic() {
      musicOn = false
      pauseTrack()
    },
    setMuted(value) {
      muted = value
      muteTrack(value)
      if (master) master.gain.value = value ? 0 : 0.55
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
