import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Image as ImageIcon, Type, X } from 'lucide-react'
import { useToast } from '../../context/ToastContext.jsx'
import { createStory, uploadStoryPhoto } from '../../firebase/stories.js'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_TEXT_LENGTH = 300

const BACKGROUNDS = [
  'linear-gradient(135deg,#a855f7,#ec4899)',
  'linear-gradient(135deg,#0ea5e9,#34d399)',
  'linear-gradient(135deg,#f43f5e,#f472b6)',
  'linear-gradient(135deg,#f59e0b,#ec4899)',
  'linear-gradient(135deg,#2b1d14,#6b5d4f)',
]

function StoryComposer({ userId, onClose, onCreated }) {
  const { showToast } = useToast()
  const fileInputRef = useRef(null)
  const [type, setType] = useState('photo')
  const [text, setText] = useState('')
  const [background, setBackground] = useState(BACKGROUNDS[0])
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      showToast('Photo trop volumineuse (10 Mo maximum).', 'error')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const canSubmit = type === 'photo' ? !!photoFile : text.trim().length > 0

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      let photoUrl = null
      let photoThumbUrl = null
      if (type === 'photo' && photoFile) {
        const uploaded = await uploadStoryPhoto(photoFile)
        photoUrl = uploaded.url
        photoThumbUrl = uploaded.thumbUrl
      }
      await createStory(userId, {
        type,
        text: type === 'text' ? text.trim() : null,
        background: type === 'text' ? background : null,
        photoUrl,
        photoThumbUrl,
      })
      showToast('Story publiée pour 24h.', 'success')
      onCreated?.()
      onClose()
    } catch {
      showToast('Impossible de publier la story, réessayez.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-lg rounded-t-[28px] p-5 md:rounded-[28px]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Nouvelle story</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/10"
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft/60">Visible 24h par la communauté, puis disparaît automatiquement.</p>

        <div className="mt-4 flex gap-1.5">
          <button
            type="button"
            onClick={() => setType('photo')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              type === 'photo' ? 'border-violet-400 bg-violet-500/15 text-violet-600' : 'border-ink/12 text-ink-soft/60 hover:bg-ink/5'
            }`}
          >
            <ImageIcon size={14} strokeWidth={2.25} />
            Photo
          </button>
          <button
            type="button"
            onClick={() => setType('text')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              type === 'text' ? 'border-violet-400 bg-violet-500/15 text-violet-600' : 'border-ink/12 text-ink-soft/60 hover:bg-ink/5'
            }`}
          >
            <Type size={14} strokeWidth={2.25} />
            Texte
          </button>
        </div>

        <div className="mt-4">
          {type === 'photo' ? (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="" className="max-h-80 w-full rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                    }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
                    aria-label="Retirer la photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 py-10 text-sm font-medium text-ink-soft/60 transition hover:border-violet-400 hover:text-violet-600"
                >
                  <ImageIcon size={22} strokeWidth={1.75} />
                  Choisir une photo
                </button>
              )}
            </div>
          ) : (
            <div>
              <div
                className="flex h-48 w-full items-center justify-center rounded-xl p-4"
                style={{ background }}
              >
                <textarea
                  rows={3}
                  maxLength={MAX_TEXT_LENGTH}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Écrivez votre story…"
                  className="w-full resize-none bg-transparent text-center text-lg font-semibold text-white placeholder-white/70 outline-none"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setBackground(bg)}
                    className={`h-7 w-7 shrink-0 rounded-full transition ${background === bg ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-surface-soft dark:ring-offset-surface' : ''}`}
                    style={{ background: bg }}
                    aria-label="Choisir ce fond"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Publication…' : 'Publier la story'}
        </button>
      </motion.div>
    </div>
  )
}

export default StoryComposer
