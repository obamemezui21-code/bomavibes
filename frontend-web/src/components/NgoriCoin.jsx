// The Ngori coin: a gold disc stamped with an "N". `size` in px.
function NgoriCoin({ size = 20, className = '' }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffe08a] via-gold to-[#c98a12] font-display font-black leading-none text-[#7a4b00] shadow-[inset_0_-2px_0_rgba(0,0,0,0.18),0_1px_3px_rgba(201,138,18,0.45)] ring-1 ring-[#c98a12]/40 ${className}`}
    >
      N
    </span>
  )
}

export default NgoriCoin
