import { useRef, useState } from 'react'
import { Mic, Pause, Play } from 'lucide-react'
import { formatDuration } from '../lib/formatDuration.js'

// A profile's voice prompt: the question and a play button with progress.
function VoicePromptPlayer({ voicePrompt, children }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const { question, url, duration } = voicePrompt
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play().catch(() => setIsPlaying(false))
  }

  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        <Mic size={14} strokeWidth={2.25} className="text-violet-500" />
        {question}
      </p>
      <div className="mt-3 flex items-center gap-3 pr-12">
        <button
          type="button"
          onClick={toggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md"
          aria-label={isPlaying ? 'Pause' : 'Écouter'}
        >
          {isPlaying ? <Pause size={18} strokeWidth={2.5} /> : <Play size={18} strokeWidth={2.5} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-violet-500 transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="mt-1 block text-[11px] text-ink-soft/60">
            {formatDuration(isPlaying || progress > 0 ? progress : duration)}
          </span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setProgress(0)
        }}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
      />
      {children}
    </div>
  )
}

export default VoicePromptPlayer
