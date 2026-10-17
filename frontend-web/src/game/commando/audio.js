// COMMANDO OKOUMÉ sound: 8-bit style effects and a ngoma-flavoured
// percussion loop, all synthesised with Web Audio (nothing to download).
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

const TEMPO = 132
const STEP = 60 / TEMPO / 4
// 16 steps: low drum (ngoma), high drum, shaker, bass note (MIDI) or null.
const LOW = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]
const HIGH = [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]
const BASS = [40, null, null, 40, null, 43, null, null, 38, null, null, 38, null, 45, null, 43]
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

  function drum(freq, t, vol) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.18)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + 0.22)
  }

  function scheduleStep(i, t) {
    if (LOW[i]) drum(90, t, 0.35)
    if (HIGH[i]) drum(220, t, 0.18)
    noise({ when: t, dur: 0.04, vol: i % 2 ? 0.03 : 0.06, freq: 6000 })
    const note = BASS[i]
    if (note) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = midi(note)
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + STEP * 2)
      osc.connect(gain).connect(master)
      osc.start(t)
      osc.stop(t + STEP * 2 + 0.02)
    }
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
          scheduleStep(stepIndex % 16, nextTime)
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
