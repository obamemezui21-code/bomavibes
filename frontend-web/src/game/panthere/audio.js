// ŒIL DE PANTHÈRE sound: rifle shots, bolt, reload and hit effects
// synthesised with Web Audio, and the games' shared music track (music.js).
// The AudioContext starts on the first tap, as browsers require.
import { muteTrack, pauseTrack, playTrack, unlockTrack } from '../music.js'

const MUTE_KEY = 'panthere.muted'

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

export function createPantherAudio(initiallyMuted) {
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
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate)
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

  // A rifle report: a sharp crack, a low boom and a short echo.
  function gunshot(heavy) {
    noise({ dur: 0.08, vol: 0.5, freq: 5000, type: 'highpass' })
    noise({ dur: heavy ? 0.6 : 0.35, vol: heavy ? 0.55 : 0.4, freq: heavy ? 700 : 1100 })
    tone(heavy ? 90 : 120, { dur: heavy ? 0.3 : 0.18, vol: 0.35, type: 'sine', slideTo: 40 })
    noise({ at: heavy ? 0.22 : 0.15, dur: 0.5, vol: 0.08, freq: 600 })
  }

  function click(at = 0, freq = 2400, vol = 0.12) {
    noise({ at, dur: 0.025, vol, freq, type: 'bandpass' })
  }

  const effects = {
    shot: () => gunshot(false),
    heavyShot: () => gunshot(true),
    burstShot: () => {
      noise({ dur: 0.06, vol: 0.4, freq: 4500, type: 'highpass' })
      noise({ dur: 0.22, vol: 0.3, freq: 1300 })
      tone(140, { dur: 0.1, vol: 0.25, type: 'sine', slideTo: 60 })
    },
    bolt: () => {
      click(0, 1800, 0.1)
      click(0.09, 2600, 0.12)
    },
    reload: () => {
      click(0, 1500, 0.14)
      click(0.18, 2200, 0.12)
      click(0.42, 1700, 0.16)
    },
    loaded: () => click(0, 3000, 0.16),
    empty: () => click(0, 3400, 0.1),
    ding: () => {
      tone(1320, { dur: 0.25, vol: 0.12, type: 'triangle' })
      tone(1980, { at: 0.02, dur: 0.2, vol: 0.06, type: 'sine' })
    },
    bullseye: () => [1320, 1760, 2640].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.2, vol: 0.1, type: 'triangle' })),
    thud: () => {
      noise({ dur: 0.12, vol: 0.3, freq: 500 })
      tone(160, { dur: 0.12, vol: 0.18, type: 'sine', slideTo: 70 })
    },
    monster: () => tone(180, { dur: 0.4, vol: 0.18, type: 'sawtooth', slideTo: 60 }),
    wound: () => tone(260, { dur: 0.15, vol: 0.14, type: 'sawtooth', slideTo: 180 }),
    protected: () => {
      tone(392, { dur: 0.22, vol: 0.14, type: 'triangle' })
      tone(311, { at: 0.2, dur: 0.35, vol: 0.14, type: 'triangle' })
    },
    gold: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.18, vol: 0.1, type: 'triangle' })),
    attack: () => {
      noise({ dur: 0.3, vol: 0.3, freq: 900 })
      tone(220, { at: 0.05, dur: 0.3, vol: 0.18, type: 'sawtooth', slideTo: 90 })
    },
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
      playTrack(muted, () => {}) // no synthesised fallback: the shots are the show
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
