// Renders a real flag image (via the flag-icons package) instead of a flag
// emoji — Windows in particular often fails to render flag emoji as actual
// flag pictures and falls back to showing the raw two-letter country code.
function FlagIcon({ code, className = '' }) {
  if (!code) return null
  return <span className={`fi fi-${code.toLowerCase()} ${className}`} />
}

export default FlagIcon
