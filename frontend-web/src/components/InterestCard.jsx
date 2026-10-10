import { interestVisual } from '../lib/interests.js'

// An interest as a picture card: photo (or gradient + big icon) with the
// name in bold at the bottom left and an optional line below it
// ("2816 profils", "En commun"). A button when `onClick` is given.
function InterestCard({ interest, subtitle, active = false, onClick, className = '' }) {
  const { Icon, gradient, photo } = interestVisual(interest)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-pressed': active } : {})}
      className={`relative isolate aspect-square overflow-hidden rounded-3xl text-left shadow-md shadow-black/10 transition ${
        onClick ? 'active:scale-[0.97]' : ''
      } ${active ? 'ring-[3px] ring-pink-500 ring-offset-2 ring-offset-surface-soft' : ''} ${className}`}
      style={{ background: gradient }}
    >
      {photo ? (
        <img src={photo} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : (
        <Icon
          aria-hidden="true"
          strokeWidth={1.5}
          className="absolute -right-[12%] -top-[8%] -z-10 h-[78%] w-[78%] rotate-12 text-white/25"
        />
      )}
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 p-3">
        <span className="block font-display text-[15px] font-bold leading-tight text-white [overflow-wrap:anywhere]">
          {interest}
        </span>
        {subtitle && <span className="mt-0.5 block text-xs font-medium text-white/80">{subtitle}</span>}
      </span>
    </Tag>
  )
}

export default InterestCard
