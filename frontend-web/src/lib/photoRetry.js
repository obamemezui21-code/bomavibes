// Until 30/10/2026 members' photos needed a cookie, and a photo asked for
// before it was refused — a refusal browsers keep for a day. One listener for
// every <img> of the app: a member's photo that didn't load is asked for
// again once, past that cached refusal. Can go once those have expired.

const MEMBER_MEDIA = /\/uploads\/(profile-photos|chat-attachments)\//

export function installPhotoRetry() {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target
      if (!(img instanceof HTMLImageElement)) return
      const src = img.getAttribute('src') || ''
      const base = src.replace(/[?&]r=\d+$/, '')
      // Once per photo: a file that really is missing must not loop.
      if (!MEMBER_MEDIA.test(base) || img.dataset.photoRetry === base) return
      img.dataset.photoRetry = base
      img.src = `${base}${base.includes('?') ? '&' : '?'}r=${Date.now()}`
    },
    true,
  )
}
