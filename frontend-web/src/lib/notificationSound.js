let audioCtx = null

function getAudioContext() {
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Ringback tone the caller hears while the other phone rings: the classic
// French "tuut" (440 Hz, 1.5 s on / 3.5 s off), looped until stopped.
// Returns a function that stops it.
export function startRingback() {
  let stopped = false
  let timer = null
  const playing = new Set()

  function beep() {
    if (stopped) return
    try {
      const ctx = getAudioContext()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 440
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.12, now + 0.03)
      gain.gain.setValueAtTime(0.12, now + 1.47)
      gain.gain.linearRampToValueAtTime(0, now + 1.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 1.5)
      playing.add(osc)
      osc.onended = () => playing.delete(osc)
    } catch {
      // Audio isn't critical; the call still works silently.
    }
    timer = setTimeout(beep, 5000)
  }

  beep()
  return () => {
    stopped = true
    clearTimeout(timer)
    playing.forEach((osc) => {
      try {
        osc.stop()
      } catch {
        // already stopped
      }
    })
    playing.clear()
  }
}

export function playNotificationSound() {
  try {
    getAudioContext()
    const now = audioCtx.currentTime
    const notes = [880, 1175]
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.09
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    })
  } catch {
    // Audio isn't critical to the app working; ignore if unsupported/blocked.
  }
}
