// Until 30/10/2026 members' photos needed a cookie, and a photo asked for
// before it was refused — a refusal browsers keep for a day. One listener for
// every <img> of the app: a member's photo that didn't load is asked for
// again once, with a fresh address so the cached refusal isn't used. Can go
// once those have expired.

const MEMBER_MEDIA = /\/uploads\/(profile-photos|chat-attachments)\//

export function installPhotoRetry() {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target
      if (!(img instanceof HTMLImageElement) || img.dataset.photoRetry) return
      if (!MEMBER_MEDIA.test(img.getAttribute('src') || '')) return
      // Once per <img>, whatever it shows: a file that really is missing
      // must not loop.
      img.dataset.photoRetry = '1'
      // After the image's own onError (fallbackToFullPhoto may switch to
      // the full-size photo first): retry what it shows by then.
      setTimeout(() => {
        const src = img.getAttribute('src') || ''
        if (!MEMBER_MEDIA.test(src)) return
        img.src = `${src}${src.includes('?') ? '&' : '?'}r=${Date.now()}`
      }, 0)
    },
    true,
  )
}
