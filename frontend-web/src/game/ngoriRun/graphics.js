// NGORI RUN's 3D graphics (beta). Three.js only ships in its own chunk,
// fetched when a player has switched 3D on; the lobby only needs to know
// whether this device can show it at all.

export function webglSupported() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export const loadRenderer3d = () => import('./renderer3d.js')
