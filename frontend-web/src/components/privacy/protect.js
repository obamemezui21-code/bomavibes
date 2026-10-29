// Props for a container of members' photos or messages (with the
// .protected-media class, index.css): no right-click menu, no dragging out.
const block = (event) => event.preventDefault()

export const PROTECT_PROPS = { onContextMenu: block, onDragStart: block }
