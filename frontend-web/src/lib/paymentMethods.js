// Selectable ways to contribute. No gateway is wired up yet — every method
// is 'coming-soon' until real merchant credentials/API keys exist. Adding a
// working method later means flipping status to 'live' and handling that
// key in the checkout flow; the UI list itself needs no other change.

export const PAYMENT_METHODS = [
  { key: 'orange', label: 'Orange Money', status: 'coming-soon' },
  { key: 'airtel', label: 'Airtel Money', status: 'coming-soon' },
  { key: 'mtn', label: 'MTN Mobile Money', status: 'coming-soon' },
  { key: 'card', label: 'Carte bancaire', status: 'coming-soon' },
]

export const CONTRIBUTION_AMOUNTS = [500, 1000, 2500, 5000, 10000]
