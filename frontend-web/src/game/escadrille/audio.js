// ESCADRILLE OGOUÉ sound: cannon bursts, explosions, bonuses, the bomb and
// the boss's siren synthesised with Web Audio, and the games' shared music
// track (music.js). The AudioContext starts on the first tap, as browsers
// require.
import { muteTrack, pauseTrack, playTrack, unlockTrack } from '../music.js'

const MUTE_KEY = 'escadrille.muted'

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

export function createEscadrilleAudio(initiallyMuted) {
  let ctx = null
  let master = null
  let noiseBuffer = null
  let muted = initiallyMuted
  let musicOn = false
  let lastShot = 0

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
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
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

  function boom(size) {
    noise({ dur: 0.25 + size * 0.5, vol: 0.25 + size * 0.3, freq: 900 - size * 500 })
    tone(110 - size * 50, { dur: 0.2 + size * 0.5, vol: 0.2 + size * 0.2, type: 'sine', slideTo: 30 })
  }

  const effects = {
    // the cannons fire all the time: a soft, quick burst, at most ~8 a second
    shot: () => {
      const now = ctx.currentTime
      if (now - lastShot < 0.12) return
      lastShot = now
      noise({ dur: 0.05, vol: 0.05, freq: 3200, type: 'bandpass' })
    },
    smallBoom: () => boom(0.2),
    boom: () => boom(0.5),
    bigBoom: () => {
      boom(1)
      noise({ at: 0.15, dur: 1.2, vol: 0.25, freq: 300 })
    },
    hit: () => tone(900, { dur: 0.04, vol: 0.04, type: 'square', slideTo: 600 }),
    bonus: () => [880, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.14, vol: 0.1, type: 'triangle' })),
    power: () => [523, 784, 1047, 1568].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.18, vol: 0.12, type: 'square' })),
    coin: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.16, vol: 0.1, type: 'triangle' })),
    bomb: () => {
      tone(60, { dur: 1.2, vol: 0.4, type: 'sine', slideTo: 25 })
      noise({ dur: 1.4, vol: 0.5, freq: 600 })
      noise({ dur: 0.3, vol: 0.3, freq: 4000, type: 'highpass' })
    },
    hurt: () => {
      noise({ dur: 0.2, vol: 0.35, freq: 1200 })
      tone(320, { dur: 0.25, vol: 0.18, type: 'sawtooth', slideTo: 120 })
    },
    alarm: () => {
      for (let i = 0; i < 4; i++) {
        tone(660, { at: i * 0.5, dur: 0.24, vol: 0.12, type: 'sawtooth', slideTo: 880 })
        tone(880, { at: i * 0.5 + 0.25, dur: 0.24, vol: 0.12, type: 'sawtooth', slideTo: 660 })
      }
    },
    stage: () => tone(220, { dur: 0.6, vol: 0.18, type: 'sawtooth', slideTo: 110 }),
    victory: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.13, dur: 0.25, vol: 0.12 })),
    defeat: () => [392, 330, 262, 196].forEach((f, i) => tone(f, { at: i * 0.2, dur: 0.3, vol: 0.12, type: 'triangle' })),
  }

  return {
    unlock() {
      ensure()
      unlockTrack()
    },
    startMusic() {
      if (!ensure() || musicOn) return
      musicOn = true
      playTrack(muted, () => {}) // no synthesised fallback: the explosions are the show
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
