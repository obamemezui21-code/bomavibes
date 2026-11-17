import { photoVariant } from '../../lib/photoVariants.js'
import { fallbackAvatar } from '../../lib/fallbackAvatar.js'

// A member's photo as a map pin, for the "Autour de moi" map (NearbyMap.jsx)
// and the globe's street map (globe/GlobeStreetMap.jsx).

export const PIN_SIZE = 44

export function avatarFor(profile) {
  return (
    photoVariant(profile.photos?.[0], 'thumb') ||
    fallbackAvatar(profile.firstName || profile.id, 'f3e8ff,fce7f3,ede9fe')
  )
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// Avatar of the city's first profile, with a count bubble when there are more.
// Also the pins of the globe's street map.
export function pinHtml(group) {
  const count = group.profiles.length
  const bubble =
    count > 1
      ? `<span style="position:absolute;top:-4px;right:-6px;min-width:20px;padding:1px 5px;border-radius:9999px;border:2px solid #fff;background:linear-gradient(90deg,#7e3a7f,#4b164c);color:#fff;font:700 10px/16px system-ui,sans-serif;text-align:center">${count > 99 ? '99+' : count}</span>`
      : ''
  return `<div style="position:relative;width:${PIN_SIZE}px;height:${PIN_SIZE}px"><img src="${escapeAttr(avatarFor(group.profiles[0]))}" alt="" style="width:100%;height:100%;border-radius:9999px;border:3px solid #fff;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.35);background:#f2ecf4" />${bubble}</div>`
}
