// Cuts a video down to [start, end] in the browser, so a member can post
// the part they choose of a longer (or heavier) video. The segment is
// played once in real time and re-recorded from a canvas (+ its sound
// through Web Audio) with MediaRecorder: the result is a new, lighter file
// (720p max). Nothing on the server transcodes videos.

const MAX_SIDE = 1280 // 720p, landscape or portrait
const MAX_VIDEO_BITRATE = 2_500_000
const AUDIO_BITRATE = 128_000

const MIME_TYPES = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

export function canTrimVideo() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    !!(window.AudioContext || window.webkitAudioContext)
  )
}

function pickMimeType() {
  return MIME_TYPES.find((t) => window.MediaRecorder.isTypeSupported(t)) || ''
}

// → { file, posterBlob, duration }. maxBytes caps the bitrate so the
// result fits the upload limit. onProgress(0…1) while it records.
// Must be called from a user gesture (a click), for the AudioContext.
export function trimVideo(source, start, end, { maxBytes, onProgress } = {}) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const audioCtx = new AudioCtx()
  const url = URL.createObjectURL(source)
  const video = document.createElement('video')
  video.playsInline = true
  video.preload = 'auto'
  const length = end - start

  return new Promise((resolve, reject) => {
    let recorder = null
    let frameLoop = null
    let posterBlob = null
    let done = false
    const chunks = []

    const cleanup = () => {
      if (frameLoop) cancelAnimationFrame(frameLoop)
      video.pause()
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      audioCtx.close().catch(() => {})
    }
    const fail = (err) => {
      if (done) return
      done = true
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      cleanup()
      // Browser errors are often in English: members get ours instead.
      reject(new Error(err?.userMessage || 'Impossible de couper cette vidéo.'))
    }

    video.onerror = () => fail({ userMessage: 'Impossible de lire cette vidéo.' })

    video.onloadedmetadata = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth || MAX_SIDE, video.videoHeight || MAX_SIDE))
      // Even sizes: some encoders refuse odd ones.
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(((video.videoWidth || MAX_SIDE) * scale) / 2) * 2
      canvas.height = Math.round(((video.videoHeight || 720) * scale) / 2) * 2
      const ctx2d = canvas.getContext('2d')
      const draw = () => ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Sound goes to the recording only, not to the speakers.
      const audioOut = audioCtx.createMediaStreamDestination()
      try {
        audioCtx.createMediaElementSource(video).connect(audioOut)
      } catch {
        // no usable audio: the clip is recorded silent
      }

      const stream = canvas.captureStream(30)
      audioOut.stream.getAudioTracks().forEach((t) => stream.addTrack(t))

      const budget = maxBytes ? (maxBytes * 8 * 0.85) / length - AUDIO_BITRATE : MAX_VIDEO_BITRATE
      const mimeType = pickMimeType()
      try {
        recorder = new MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: Math.max(400_000, Math.min(MAX_VIDEO_BITRATE, budget)),
          audioBitsPerSecond: AUDIO_BITRATE,
        })
      } catch (err) {
        fail(err)
        return
      }
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = () => {
        if (done) return
        done = true
        cleanup()
        // The upload checks the plain type (video/mp4 or video/webm).
        const type = (recorder.mimeType || mimeType || 'video/webm').split(';')[0]
        const blob = new Blob(chunks, { type })
        const name = `video.${type === 'video/mp4' ? 'mp4' : 'webm'}`
        resolve({ file: new File([blob], name, { type }), posterBlob, duration: length })
      }

      const loop = () => {
        draw()
        const t = video.currentTime
        onProgress?.(Math.min(1, Math.max(0, (t - start) / length)))
        if (t >= end || video.ended) {
          video.pause()
          if (recorder.state !== 'inactive') recorder.stop()
          return
        }
        frameLoop = requestAnimationFrame(loop)
      }

      video.onseeked = () => {
        video.onseeked = null
        draw()
        canvas.toBlob(
          (blob) => {
            posterBlob = blob
            audioCtx
              .resume()
              .catch(() => {})
              .then(() => {
                recorder.start(1000)
                return video.play()
              })
              .then(() => {
                frameLoop = requestAnimationFrame(loop)
              })
              .catch(fail)
          },
          'image/jpeg',
          0.8,
        )
      }
      // (a seek to exactly 0 may never fire 'seeked')
      video.currentTime = Math.max(start, 0.001)
    }

    video.src = url
  })
}
