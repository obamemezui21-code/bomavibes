// Shared Framer Motion presets so modals/sheets/cards don't each retype the
// same transition objects (found duplicated identically across ConfirmDialog,
// BlockConfirmModal, ReportModal, Chat's inline modals, etc.).

export const overlayFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const panelPop = {
  initial: { opacity: 0, scale: 0.95, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 8 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

export const sheetSpring = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 40 },
  transition: { type: 'spring', stiffness: 320, damping: 30 },
}
