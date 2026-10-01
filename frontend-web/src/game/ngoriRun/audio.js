// NGORI RUN sound: effects and a light afro-pop loop, all synthesised with
// Web Audio — nothing to download. The AudioContext is created on the first
// tap (browsers refuse to play sound before a user gesture).

const MUTE_KEY = 'ngoriRun.muted'

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

const TEMPO = 112
const STEP = 60 / TEMPO / 4 // one 16th note, in seconds
// A minor pentatonic-ish loop: Am – F – C – G, one bar each.
const BASS = [
  [45, 0], [45, 3], [52, 6], [45, 10], [57, 12],
  [41, 16], [41, 19], [48, 22], [41, 26], [53, 28],
  [48, 32], [48, 35], [55, 38], [48, 42], [60, 44],
  [43, 48], [43, 51], [50, 54], [43, 58], [55, 60],
]
const PLUCKS = [
  [69, 2], [72, 5], [76, 8], [74, 13],
  [72, 18], [69, 21], [65, 24], [69, 29],
  [67, 34], [72, 37], [76, 40], [79, 45],
  [74, 50], [71, 53], [67, 56], [74, 61],
]
const LOOP_STEPS = 64

const midi = (n) => 440 * 2 ** ((n - 69) / 12)

export function createGameAudio(initiallyMuted) {
  let ctx = null
  let master = null
  let musicGain = null
  let noiseBuffer = null
  let muted = initiallyMuted
  let musicTimer = null
  let nextStepTime = 0
  let stepIndex = 0

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume()
      return ctx
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.9
    master.connect(ctx.destination)
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.22
    musicGain.connect(master)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return ctx
  }

  function tone({ freq, type = 'sine', at = 0, dur = 0.15, vol = 0.2, slideTo, dest }) {
    const c = ensure()
    if (!c) return
    const t = c.currentTime + at
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain)
    gain.connect(dest || master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  function noise({ at = 0, dur = 0.2, vol = 0.3, filter = 'lowpass', freq = 1200, dest, when }) {
    const c = ensure()
    if (!c) return
    const t = when ?? c.currentTime + at
    const src = c.createBufferSource()
    src.buffer = noiseBuffer
    const f = c.createBiquadFilter()
    f.type = filter
    f.frequency.value = freq
    const gain = c.createGain()
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(gain)
    gain.connect(dest || master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  const effects = {
    coin: () => {
      tone({ freq: 988, dur: 0.08, vol: 0.12, type: 'square' })
      tone({ freq: 1319, at: 0.07, dur: 0.16, vol: 0.12, type: 'square' })
    },
    gold: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone({ freq: f, at: i * 0.06, dur: 0.18, vol: 0.13, type: 'triangle' })),
    jump: () => tone({ freq: 320, slideTo: 640, dur: 0.16, vol: 0.06, type: 'triangle' }),
    slide: () => noise({ dur: 0.22, vol: 0.12, filter: 'bandpass', freq: 900 }),
    lane: () => tone({ freq: 520, slideTo: 420, dur: 0.06, vol: 0.035, type: 'sine' }),
    powerup: () => tone({ freq: 400, slideTo: 1600, dur: 0.35, vol: 0.14, type: 'sawtooth' }),
    shield: () => {
      noise({ dur: 0.3, vol: 0.25, filter: 'highpass', freq: 2500 })
      tone({ freq: 220, slideTo: 110, dur: 0.3, vol: 0.15 })
    },
    bonus: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, at: i * 0.08, dur: 0.25, vol: 0.12, type: 'triangle' })),
    crash: () => {
      noise({ dur: 0.6, vol: 0.55, freq: 700 })
      tone({ freq: 140, slideTo: 40, dur: 0.5, vol: 0.35, type: 'sine' })
    },
    // Entering a new district: a soft two-note chime.
    district: () => {
      tone({ freq: 880, dur: 0.25, vol: 0.09, type: 'sine' })
      tone({ freq: 1175, at: 0.12, dur: 0.4, vol: 0.09, type: 'sine' })
    },
    reward: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, at: i * 0.09, dur: 0.35, vol: 0.12, type: 'triangle' })),
  }

  function scheduleStep(i, t) {
    const s = i % LOOP_STEPS
    const inBar = s % 16
    // Kick on the beat, a syncopated extra before beat 3.
    if (inBar % 4 === 0 || inBar === 7) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(150, t)
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
      gain.gain.setValueAtTime(inBar === 7 ? 0.35 : 0.6, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      osc.connect(gain)
      gain.connect(musicGain)
      osc.start(t)
      osc.stop(t + 0.2)
    }
    // Shaker on every 8th, accented off-beats.
    if (inBar % 2 === 0) noise({ when: t, dur: 0.05, vol: inBar % 4 === 2 ? 0.16 : 0.07, filter: 'highpass', freq: 6000, dest: musicGain })
    for (const [note, at] of BASS) if (at === s) bassNote(note, t)
    for (const [note, at] of PLUCKS) if (at === s) pluck(note, t)
  }

  function bassNote(note, t) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = midi(note)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 2.6)
    osc.connect(gain)
    gain.connect(musicGain)
    osc.start(t)
    osc.stop(t + STEP * 3)
  }

  // Marimba-like: a sine and its quickly fading 4th harmonic.
  function pluck(note, t) {
    for (const [mult, vol, dur] of [
      [1, 0.22, 0.45],
      [4, 0.06, 0.08],
    ]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = midi(note) * mult
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(gain)
      gain.connect(musicGain)
      osc.start(t)
      osc.stop(t + dur + 0.02)
    }
  }

  return {
    unlock: () => ensure(),
    play(name) {
      if (muted) return
      try {
        effects[name]?.()
      } catch {
        // sound is never critical
      }
    },
    startMusic() {
      const c = ensure()
      if (!c || musicTimer) return
      nextStepTime = c.currentTime + 0.1
      musicTimer = setInterval(() => {
        while (nextStepTime < c.currentTime + 0.2) {
          scheduleStep(stepIndex++, nextStepTime)
          nextStepTime += STEP
        }
      }, 50)
    },
    stopMusic() {
      clearInterval(musicTimer)
      musicTimer = null
    },
    setMuted(value) {
      muted = value
      if (master) master.gain.setTargetAtTime(value ? 0 : 0.9, ctx.currentTime, 0.05)
    },
    close() {
      clearInterval(musicTimer)
      musicTimer = null
      ctx?.close().catch(() => {})
      ctx = null
    },
  }
}
