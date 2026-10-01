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

// A soukous / ndombolo-flavoured loop, the sound of Libreville's maquis:
// bright major I – IV – V – IV, a cascading "sebene" guitar on every 16th,
// a bouncing bass, four-on-the-floor kick, snare on 2 and 4, clave on top.
const TEMPO = 128
const STEP = 60 / TEMPO / 4 // one 16th note, in seconds
const LOOP_STEPS = 64
// Per bar: bass root (MIDI) and the guitar's chord tones, low to high.
const BARS = [
  { root: 48, tones: [72, 76, 79, 84] }, // C
  { root: 53, tones: [72, 77, 81, 84] }, // F
  { root: 55, tones: [71, 74, 79, 83] }, // G
  { root: 53, tones: [72, 77, 81, 84] }, // F
]
// Which chord tone the sebene guitar plays on each 16th of a bar.
const SEBENE = [3, 2, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 3, 1, 2, 0]
// Bass: [16th in the bar, interval above the root].
const BASS = [[0, 0], [3, 7], [6, 12], [8, 0], [10, 7], [14, 12]]
const CLAVE = [0, 3, 6, 10, 12] // 3-2 clave

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
    // A Libreville taxi's double "pin-pin!" — two detuned square horns.
    honk: () => {
      for (const at of [0, 0.22]) {
        tone({ freq: 370, at, dur: 0.16, vol: 0.07, type: 'square' })
        tone({ freq: 466, at, dur: 0.16, vol: 0.06, type: 'square' })
      }
    },
  }

  function scheduleStep(i, t) {
    const s = i % LOOP_STEPS
    const inBar = s % 16
    const bar = BARS[Math.floor(s / 16)]
    // Four-on-the-floor kick.
    if (inBar % 4 === 0) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(150, t)
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
      gain.gain.setValueAtTime(0.55, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      osc.connect(gain)
      gain.connect(musicGain)
      osc.start(t)
      osc.stop(t + 0.2)
    }
    // Snare on 2 and 4, light hi-hat on every 16th.
    if (inBar === 4 || inBar === 12) noise({ when: t, dur: 0.12, vol: 0.22, filter: 'bandpass', freq: 1800, dest: musicGain })
    noise({ when: t, dur: 0.03, vol: inBar % 2 ? 0.04 : 0.08, filter: 'highpass', freq: 7000, dest: musicGain })
    // Clave: a short wooden click.
    if (CLAVE.includes(inBar)) tone({ freq: 1750, at: Math.max(0, t - ctx.currentTime), dur: 0.04, vol: 0.06, type: 'sine', dest: musicGain })
    for (const [at, interval] of BASS) if (at === inBar) bassNote(bar.root + interval, t)
    pluck(bar.tones[SEBENE[inBar]], t, inBar % 4 === 0 ? 0.2 : 0.12)
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

  // Bright guitar-like pluck: a triangle and its quickly fading 3rd harmonic.
  function pluck(note, t, volume = 0.15) {
    for (const [mult, vol, dur, type] of [
      [1, volume, 0.22, 'triangle'],
      [3, volume * 0.25, 0.06, 'sine'],
    ]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
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
    // A street vendor's call, in the browser's own French voice (none on
    // some devices: then simply silent).
    say(text) {
      if (muted || typeof speechSynthesis === 'undefined') return
      try {
        speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'fr-FR'
        u.rate = 1.1
        u.pitch = 1.2
        u.volume = 0.8
        speechSynthesis.speak(u)
      } catch {
        // sound is never critical
      }
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
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
      clearInterval(musicTimer)
      musicTimer = null
      ctx?.close().catch(() => {})
      ctx = null
    },
  }
}
