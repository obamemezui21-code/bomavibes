// The games' soundtrack: one recorded track, shared by every game and looped
// (for now "Talk Facts" by Avock, vocals turned down). Each game keeps its
// synthesised loop as a fallback when the file can't play.
import trackUrl from '../assets/music/talk_facts_instru.mp3'

const VOLUME = 0.5
let audio = null
let wanted = false // the game asked for music: a pending unlock must not pause it

function element() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio(trackUrl)
    audio.loop = true
    audio.preload = 'none'
    audio.volume = VOLUME
  }
  return audio
}

// Called on a tap: lets the track start later outside a user gesture (iOS
// only allows play() on an element first played during a gesture).
export function unlockTrack() {
  const a = element()
  if (!a || !a.paused) return
  const wasMuted = a.muted
  a.muted = true
  a.play()
    .then(() => {
      if (!wanted) a.pause()
    })
    .catch(() => {})
    .finally(() => {
      if (!wanted) a.muted = wasMuted
    })
}

export function playTrack(muted, onFail) {
  const a = element()
  if (!a) {
    onFail()
    return
  }
  wanted = true
  a.muted = muted
  a.play().catch(() => {
    if (wanted) onFail()
  })
}

export function pauseTrack() {
  wanted = false
  audio?.pause()
}

export function muteTrack(muted) {
  if (audio) audio.muted = muted
}
