// Reads a picked video in the browser before it's uploaded: its length (to
// enforce the story limit) and a poster frame grabbed from it. Resolves
// { duration (s), posterBlob | null }; rejects if the browser can't read
// the file at all.
export function readVideoFile(file, { posterWidth = 720 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    let duration = 0
    let settled = false

    const finish = (posterBlob) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve({ duration, posterBlob })
    }

    video.onloadedmetadata = () => {
      duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        settled = true
        URL.revokeObjectURL(url)
        reject(new Error('unreadable video'))
        return
      }
      // A frame a little way in is more telling than the first, often black.
      video.currentTime = Math.min(0.5, duration / 2)
    }

    video.onseeked = () => {
      try {
        const scale = Math.min(1, posterWidth / (video.videoWidth || posterWidth))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round((video.videoWidth || posterWidth) * scale)
        canvas.height = Math.round((video.videoHeight || posterWidth) * scale)
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.8)
      } catch {
        finish(null)
      }
    }

    video.onerror = () => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      reject(new Error('unreadable video'))
    }

    // Some codecs give the length but never a frame, some nothing at all:
    // don't wait forever either way.
    setTimeout(() => {
      if (settled) return
      if (duration) {
        finish(null)
        return
      }
      settled = true
      URL.revokeObjectURL(url)
      reject(new Error('unreadable video'))
    }, 8000)
    video.src = url
  })
}
