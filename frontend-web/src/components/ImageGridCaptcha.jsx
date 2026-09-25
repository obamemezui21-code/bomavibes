import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Bike, Bus, Car, Truck } from 'lucide-react'
import { labelClass } from '../lib/formStyles.js'

// Lucide has no "traffic light" or "crosswalk" icon, so these two are drawn
// by hand in the same stroke style as the rest of the set.
function TrafficLightIcon({ size = 26, strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="18" rx="3" />
      <circle cx="12" cy="6.5" r="1.4" />
      <circle cx="12" cy="11" r="1.4" />
      <circle cx="12" cy="15.5" r="1.4" />
      <line x1="12" y1="20" x2="12" y2="22" />
    </svg>
  )
}

function CrosswalkIcon({ size = 26, strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="1" />
      <line x1="7" y1="6" x2="7" y2="18" />
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="17" y1="6" x2="17" y2="18" />
    </svg>
  )
}

// Keep in sync with CATEGORIES in backend/src/controllers/captchaController.js.
const CATEGORIES = {
  'feu-rouge': { label: 'feu rouge', Icon: TrafficLightIcon },
  velo: { label: 'vélo', Icon: Bike },
  'passage-pieton': { label: 'passage piéton', Icon: CrosswalkIcon },
  bus: { label: 'bus', Icon: Bus },
  voiture: { label: 'voiture', Icon: Car },
  camion: { label: 'camion', Icon: Truck },
}

const ImageGridCaptcha = forwardRef(function ImageGridCaptcha({ onChange }, ref) {
  const [target, setTarget] = useState('')
  const [cells, setCells] = useState([])
  const [token, setToken] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)

  function fetchChallenge() {
    setIsLoading(true)
    setSelected(new Set())
    fetch('/api/captcha/challenge')
      .then((res) => res.json())
      .then((data) => {
        setTarget(data.target)
        setCells(data.cells)
        setToken(data.token)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchChallenge()
  }, [])

  useEffect(() => {
    onChange({ token, indices: [...selected] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selected])

  useImperativeHandle(ref, () => ({ refresh: fetchChallenge }))

  function toggle(i) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const targetLabel = CATEGORIES[target]?.label

  return (
    <fieldset>
      <legend className={labelClass}>
        Vérification anti-robot {targetLabel && `— cliquez sur toutes les images : ${targetLabel}`}
      </legend>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {(isLoading ? Array.from({ length: 9 }) : cells).map((category, i) => {
          const Icon = CATEGORIES[category]?.Icon
          const isSelected = selected.has(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={isLoading}
              aria-pressed={isSelected}
              className={`flex aspect-square items-center justify-center rounded-lg border-2 transition ${
                isSelected
                  ? 'border-violet-500 bg-violet-500/15 text-violet-600'
                  : 'border-ink/12 bg-ink/[0.03] text-ink-soft/70 hover:bg-ink/5'
              }`}
            >
              {Icon && <Icon size={26} strokeWidth={2} />}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
})

export default ImageGridCaptcha
