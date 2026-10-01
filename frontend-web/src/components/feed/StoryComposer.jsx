import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Camera, Palette, Pencil, SendHorizontal, X } from 'lucide-react'
import { useToast } from '../../context/ToastContext.jsx'
import { createStory, uploadStoryPhoto, uploadStoryVideo } from '../../firebase/stories.js'
import { readVideoFile } from '../../lib/videoFile.js'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
// Must match backend/src/routes/storyVideoRoutes.js (and the 31 s cap in firestore.rules).
const MAX_VIDEO_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_SECONDS = 30
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_TEXT_LENGTH = 300

const BACKGROUNDS = [
  'linear-gradient(135deg,#a95dda,#e652a3)',
  'linear-gradient(135deg,#67c7f5,#4dbf85)',
  'linear-gradient(135deg,#ea3d38,#ef8fc7)',
  'linear-gradient(135deg,#f2bf4e,#e652a3)',
  'linear-gradient(135deg,#261b28,#635a65)',
]

function SendButton({ onClick, disabled, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg shadow-pink-500/30 transition active:scale-95 disabled:opacity-50"
      aria-label="Publier la story"
    >
      {busy ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <SendHorizontal size={20} strokeWidth={2.25} />
      )}
    </button>
  )
}

// Full-screen story composer, WhatsApp-status style: choose "Photo ou
// vidéo" (the type is read from the file, with an optional caption) or
// "Texte" (big text on a colour you cycle through), then send.
function StoryComposer({ userId, onClose, onCreated }) {
  const { showToast } = useToast()
  const fileInputRef = useRef(null)
  const [mode, setMode] = useState('choose') // choose | media | text
  const [text, setText] = useState('')
  const [backgroundIndex, setBackgroundIndex] = useState(0)
  // { kind: 'photo' | 'video', file, preview, duration?, posterBlob? }
  const [media, setMedia] = useState(null)
  const [isReading, setIsReading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.type.startsWith('image/')) {
      if (file.size > MAX_PHOTO_BYTES) {
        showToast('Photo trop volumineuse (10 Mo maximum).', 'error')
        return
      }
      setMedia({ kind: 'photo', file, preview: URL.createObjectURL(file) })
      setMode('media')
      return
    }

    if (!VIDEO_TYPES.includes(file.type)) {
      showToast('Format non pris en charge : choisissez une photo ou une vidéo MP4, MOV ou WebM.', 'error')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      showToast('Vidéo trop lourde (25 Mo maximum).', 'error')
      return
    }
    setIsReading(true)
    try {
      const { duration, posterBlob } = await readVideoFile(file)
      if (duration > MAX_VIDEO_SECONDS + 0.5) {
        showToast(`Vidéo trop longue (${MAX_VIDEO_SECONDS} secondes maximum).`, 'error')
        return
      }
      setMedia({ kind: 'video', file, preview: URL.createObjectURL(file), duration, posterBlob })
      setMode('media')
    } catch {
      showToast('Impossible de lire cette vidéo sur cet appareil.', 'error')
    } finally {
      setIsReading(false)
    }
  }

  function backToChoice() {
    setMedia(null)
    setText('')
    setMode('choose')
  }

  async function handleSubmit() {
    const isText = mode === 'text'
    if (isSubmitting || (isText ? !text.trim() : !media)) return
    setIsSubmitting(true)
    try {
      let photoUrl = null
      let photoThumbUrl = null
      let videoUrl = null
      if (media?.kind === 'photo') {
        const uploaded = await uploadStoryPhoto(media.file)
        photoUrl = uploaded.url
        photoThumbUrl = uploaded.thumbUrl
      } else if (media?.kind === 'video') {
        const uploaded = await uploadStoryVideo(media.file, media.posterBlob)
        videoUrl = uploaded.videoUrl
        photoThumbUrl = uploaded.posterUrl
      }
      await createStory(userId, {
        type: isText ? 'text' : media.kind,
        text: text.trim() || null,
        background: isText ? BACKGROUNDS[backgroundIndex] : null,
        photoUrl,
        photoThumbUrl,
        videoUrl,
        duration: media?.kind === 'video' ? Math.round(media.duration * 10) / 10 : null,
      })
      showToast('Story publiée pour 24h.', 'success')
      onCreated?.()
      onClose()
    } catch (err) {
      showToast(
        media?.kind === 'video' && err?.message && err.message !== 'upload failed'
          ? err.message
          : 'Impossible de publier la story, réessayez.',
        'error',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const topBarButton = 'flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/50'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      style={mode === 'text' ? { background: BACKGROUNDS[backgroundIndex] } : undefined}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Top bar */}
      <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={mode === 'choose' ? onClose : backToChoice}
          className={topBarButton}
          aria-label={mode === 'choose' ? 'Fermer' : 'Retour'}
        >
          {mode === 'choose' ? <X size={20} /> : <ArrowLeft size={20} />}
        </button>
        {mode === 'text' && (
          <button
            type="button"
            onClick={() => setBackgroundIndex((i) => (i + 1) % BACKGROUNDS.length)}
            className={topBarButton}
            aria-label="Changer la couleur"
          >
            <Palette size={20} />
          </button>
        )}
        {mode === 'media' && media?.kind === 'video' && (
          <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            Vidéo · {Math.round(media.duration)} s
          </span>
        )}
      </div>

      {mode === 'choose' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold">Nouvelle story</h2>
            <p className="mt-1 text-sm text-white/60">Visible 24h, puis elle disparaît automatiquement.</p>
          </div>
          <div className="flex gap-10">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isReading} className="flex flex-col items-center gap-3">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 shadow-xl shadow-pink-500/30 transition active:scale-95">
                {isReading ? (
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Camera size={32} strokeWidth={1.75} />
                )}
              </span>
              <span className="text-sm font-semibold">{isReading ? 'Lecture…' : 'Photo ou vidéo'}</span>
            </button>
            <button type="button" onClick={() => setMode('text')} className="flex flex-col items-center gap-3">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 transition active:scale-95">
                <Pencil size={30} strokeWidth={1.75} />
              </span>
              <span className="text-sm font-semibold">Texte</span>
            </button>
          </div>
          <p className="text-xs text-white/45">Vidéo : {MAX_VIDEO_SECONDS} secondes maximum · 25 Mo</p>
        </div>
      )}

      {mode === 'media' && media && (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {media.kind === 'photo' ? (
              <img src={media.preview} alt="" className="max-h-full w-full object-contain" />
            ) : (
              <video src={media.preview} autoPlay loop playsInline muted controls className="max-h-full w-full object-contain" />
            )}
          </div>
          <div className="flex items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <input
              type="text"
              maxLength={MAX_TEXT_LENGTH}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Ajouter une légende…"
              className="min-w-0 flex-1 rounded-full bg-white/12 px-4 py-3 text-sm text-white placeholder-white/55 outline-none backdrop-blur-md focus:bg-white/18"
            />
            <SendButton onClick={handleSubmit} disabled={isSubmitting} busy={isSubmitting} />
          </div>
        </>
      )}

      {mode === 'text' && (
        <>
          <div className="flex flex-1 items-center justify-center px-6">
            <textarea
              autoFocus
              rows={4}
              maxLength={MAX_TEXT_LENGTH}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Écrivez votre story…"
              className="w-full resize-none bg-transparent text-center font-display text-3xl font-bold leading-snug text-white placeholder-white/60 outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <span className="text-xs text-white/70">
              {text.length}/{MAX_TEXT_LENGTH}
            </span>
            <SendButton onClick={handleSubmit} disabled={!text.trim() || isSubmitting} busy={isSubmitting} />
          </div>
        </>
      )}
    </motion.div>
  )
}

export default StoryComposer
