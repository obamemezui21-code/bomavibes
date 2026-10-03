import { useEffect, useRef } from 'react'
import { Scissors } from 'lucide-react'

function formatTime(s) {
  const total = Math.max(0, Math.round(s))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Picks the part of a video to post: two handles on one bar, never more
// than maxLength seconds apart. The preview plays the chosen part on a loop.
function VideoTrimmer({ src, duration, maxLength, start, end, onChange }) {
  const videoRef = useRef(null)

  // Keep the preview inside [start, end].
  useEffect(() => {
    const v = videoRef.current
    if (!v) return undefined
    const onTime = () => {
      if (v.currentTime >= end || v.currentTime < start - 0.25) v.currentTime = start
    }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [start, end])

  function seek(t) {
    if (videoRef.current) videoRef.current.currentTime = t
  }

  function moveStart(value) {
    const s = Math.min(value, end - 1)
    // Dragging the start past the limit pulls the end along.
    const e = Math.min(end, s + maxLength)
    onChange(s, e)
    seek(s)
  }

  function moveEnd(value) {
    const e = Math.max(value, start + 1)
    const s = Math.max(start, e - maxLength)
    onChange(s, e)
    seek(Math.max(s, e - 2))
  }

  const pct = (t) => `${(t / duration) * 100}%`
  const length = end - start
  const thumb =
    'pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-ew-resize [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-ew-resize [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow'

  return (
    <div>
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        onLoadedMetadata={() => seek(start)}
        className="max-h-72 w-full rounded-xl bg-black"
      />

      <div className="mt-3 rounded-xl bg-ink/5 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <Scissors size={13} strokeWidth={2.25} className="text-violet-500" />
            Passage à publier
          </span>
          <span className="font-semibold tabular-nums text-violet-600">{Math.round(length)} s / {maxLength} s max</span>
        </div>

        <div className="relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink/15" />
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
            style={{ left: pct(start), width: pct(length) }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={start}
            onChange={(e) => moveStart(Number(e.target.value))}
            aria-label="Début du passage"
            className={thumb}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={end}
            onChange={(e) => moveEnd(Number(e.target.value))}
            aria-label="Fin du passage"
            className={thumb}
          />
        </div>

        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-ink-soft/60">
          <span>Début {formatTime(start)}</span>
          <span>Fin {formatTime(end)}</span>
        </div>
      </div>
    </div>
  )
}

export default VideoTrimmer
