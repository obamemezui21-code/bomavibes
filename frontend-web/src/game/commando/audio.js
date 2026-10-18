// COMMANDO OKOUMÉ sound: 8-bit style effects and a hip-hop beat,
// all synthesised with Web Audio (nothing to download).
// The AudioContext starts on the first tap, as browsers require.

const MUTE_KEY = 'commando.muted'

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

// A dark hip-hop beat: 90 BPM boom-bap with a little swing, 808 bass that
// slides, trap hi-hat rolls at the end of the second bar, minor electric
// piano chords. Two bars of 16 steps (16ths), looped.
const TEMPO = 90
const STEP = 60 / TEMPO / 4
const LOOP = 32
const SWING = 0.14 // off-beat 16ths come a little late
const KICK = [0, 3, 7, 10, 16, 19, 22, 26, 29]
const SNARE = [4, 12, 20, 28]
const GHOST = [15, 31] // soft snare just before the next bar
const OPEN_HAT = [14, 30]
const HAT_ROLL = [24, 25, 26, 27, 28, 29] // 16th roll in bar 2
// 808 notes (MIDI) by step, held until the next one: A minor, then F.
const BASS = { 0: 33, 7: 33, 10: 36, 16: 29, 22: 29, 26: 31, 29: 33 }
// Chords (MIDI), one per bar: Am9, Fmaj7(#11).
const CHORDS = { 0: [57, 60, 64, 67, 71], 16: [53, 57, 60, 64, 71] }
const midi = (n) => 440 * 2 ** ((n - 69) / 12)

export function createCommandoAudio(initiallyMuted) {
  let ctx = null
  let master = null
  let noiseBuffer = null
  let muted = initiallyMuted
  let timer = null
  let nextTime = 0
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
    master.gain.value = muted ? 0 : 0.5
    master.connect(ctx.destination)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return ctx
  }

  function tone(freq, { at = 0, dur = 0.1, vol = 0.15, type = 'square', slideTo } = {}) {
    if (!ensure()) return
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

  function noise({ at = 0, dur = 0.15, vol = 0.25, freq = 1500, when } = {}) {
    if (!ensure()) return
    const t = when ?? ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(filter).connect(gain).connect(master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  // Filtered noise for the drums (hats, snare, clap).
  function hiss(t, { dur, vol, type = 'highpass', freq = 7000, q = 1 }) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(filter).connect(gain).connect(master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  function kick(t) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    gain.gain.setValueAtTime(0.55, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
    osc.connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + 0.4)
  }

  function snare(t, vol = 1) {
    hiss(t, { dur: 0.2, vol: 0.32 * vol, type: 'bandpass', freq: 1900, q: 0.8 })
    // Clap: three quick bursts on top.
    for (let k = 0; k < 3; k++) hiss(t + k * 0.011, { dur: 0.05, vol: 0.14 * vol, type: 'bandpass', freq: 1300, q: 1.5 })
    const body = ctx.createOscillator()
    const gain = ctx.createGain()
    body.type = 'triangle'
    body.frequency.setValueAtTime(190, t)
    body.frequency.exponentialRampToValueAtTime(140, t + 0.08)
    gain.gain.setValueAtTime(0.16 * vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    body.connect(gain).connect(master)
    body.start(t)
    body.stop(t + 0.12)
  }

  // 808: a deep sine with a bit of drive, gliding up from below.
  function bass808(note, t, dur) {
    const osc = ctx.createOscillator()
    const drive = ctx.createWaveShaper()
    const curve = new Float32Array(256)
    for (let k = 0; k < 256; k++) {
      const x = (k / 128) - 1
      curve[k] = Math.tanh(2.2 * x)
    }
    drive.curve = curve
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(midi(note) * 0.94, t)
    osc.frequency.exponentialRampToValueAtTime(midi(note), t + 0.06)
    gain.gain.setValueAtTime(0.32, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(drive).connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  // Electric piano chord: soft triangles through a low-pass, slow decay.
  function chord(notes, t) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1400
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, t + STEP * 14)
    filter.connect(gain).connect(master)
    for (const n of notes) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = midi(n)
      osc.detune.value = (Math.random() - 0.5) * 8
      osc.connect(filter)
      osc.start(t)
      osc.stop(t + STEP * 14 + 0.05)
    }
  }

  function scheduleStep(i, base) {
    const t = base + (i % 2 ? STEP * SWING : 0)
    if (KICK.includes(i)) kick(t)
    if (SNARE.includes(i)) snare(t)
    if (GHOST.includes(i)) snare(t, 0.3)
    if (OPEN_HAT.includes(i)) hiss(t, { dur: 0.22, vol: 0.07, freq: 6500 })
    else if (HAT_ROLL.includes(i) || i % 2 === 0) hiss(t, { dur: 0.035, vol: HAT_ROLL.includes(i) ? 0.05 : i % 4 === 0 ? 0.08 : 0.05, freq: 8000 })
    if (BASS[i]) {
      const steps = Object.keys(BASS).map(Number)
      const next = steps.find((s) => s > i) ?? LOOP
      bass808(BASS[i], t, STEP * (next - i) * 0.95)
    }
    if (CHORDS[i]) chord(CHORDS[i], t)
  }

  return {
    unlock() {
      ensure()
    },
    startMusic() {
      if (!ensure() || timer) return
      nextTime = ctx.currentTime + 0.05
      stepIndex = 0
      timer = setInterval(() => {
        while (nextTime < ctx.currentTime + 0.2) {
          scheduleStep(stepIndex % LOOP, nextTime)
          stepIndex += 1
          nextTime += STEP
        }
      }, 50)
    },
    stopMusic() {
      clearInterval(timer)
      timer = null
    },
    setMuted(value) {
      muted = value
      if (master) master.gain.value = value ? 0 : 0.5
    },
    play(name) {
      if (muted) return
      switch (name) {
        case 'shot':
          tone(880, { dur: 0.05, vol: 0.05, slideTo: 440 })
          break
        case 'grenade':
          tone(300, { dur: 0.12, vol: 0.08, slideTo: 150 })
          break
        case 'hit':
          tone(220, { dur: 0.04, vol: 0.06 })
          break
        case 'kill':
          noise({ dur: 0.2, vol: 0.18, freq: 900 })
          break
        case 'explosion':
          noise({ dur: 0.45, vol: 0.35, freq: 600 })
          break
        case 'hurt':
          tone(200, { dur: 0.25, vol: 0.15, slideTo: 80, type: 'sawtooth' })
          break
        case 'jump':
          tone(330, { dur: 0.1, vol: 0.06, slideTo: 660 })
          break
        case 'pickup':
          tone(660, { dur: 0.08, vol: 0.1 })
          tone(990, { at: 0.08, dur: 0.12, vol: 0.1 })
          break
        case 'special':
          tone(440, { dur: 0.3, vol: 0.1, slideTo: 1320 })
          break
        case 'boss':
          tone(110, { dur: 0.6, vol: 0.2, type: 'sawtooth' })
          tone(104, { at: 0.3, dur: 0.6, vol: 0.2, type: 'sawtooth' })
          break
        case 'victory':
          ;[523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.2, vol: 0.12 }))
          break
        case 'defeat':
          ;[392, 330, 262].forEach((f, i) => tone(f, { at: i * 0.18, dur: 0.25, vol: 0.12, type: 'triangle' }))
          break
        default:
      }
    },
    dispose() {
      clearInterval(timer)
      ctx?.close().catch(() => {})
      ctx = null
    },
  }
}
