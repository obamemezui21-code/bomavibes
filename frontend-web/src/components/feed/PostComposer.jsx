import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Ban, HelpCircle, Image as ImageIcon, MessageSquareText, X } from 'lucide-react'
import { useFeed } from '../../context/FeedContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { uploadFeedPhoto } from '../../firebase/feed.js'
import { MAX_BACKGROUND_TEXT, POST_BACKGROUNDS, POST_FONTS, loadPostFonts, postBackground, postFont } from '../../lib/postStyles.js'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_TEXT_LENGTH = 1000

const TYPES = [
  { id: 'text', label: 'Texte', icon: MessageSquareText },
  { id: 'photo', label: 'Photo', icon: ImageIcon },
  { id: 'question', label: 'Question', icon: HelpCircle },
]

function PostComposer({ onClose, initialType = 'text' }) {
  const { createPost } = useFeed()
  const { showToast } = useToast()
  const fileInputRef = useRef(null)
  const [type, setType] = useState(initialType)
  const [text, setText] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Text posts only: coloured background + font (preset ids, see postStyles.js)
  const [background, setBackground] = useState(null)
  const [font, setFont] = useState('normal')

  const isTextPost = type === 'text'
  const tooLongForBackground = text.length > MAX_BACKGROUND_TEXT
  const activeBackground = isTextPost && !tooLongForBackground ? postBackground(background) : null
  const activeFont = isTextPost ? postFont(font) : null

  useEffect(() => {
    if (isTextPost) loadPostFonts()
  }, [isTextPost])

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      let photoUrl = null
      let photoThumbUrl = null
      if (type === 'photo' && photoFile) {
        const uploaded = await uploadFeedPhoto(photoFile)
        photoUrl = uploaded.url
        photoThumbUrl = uploaded.thumbUrl
      }
      await createPost({
        type,
        text: text.trim() || null,
        photoUrl,
        photoThumbUrl,
        background: activeBackground ? activeBackground.id : null,
        font: activeFont && activeFont.id !== 'normal' ? activeFont.id : null,
      })
      showToast('Publication envoyée.', 'success')
      onClose()
    } catch {
      showToast("Impossible de publier, réessayez.", 'error')
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
          <h2 className="font-display text-lg font-semibold text-ink">Créer une publication</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/10"
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>

        <div className="mt-4 flex gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                type === t.id ? 'border-violet-400 bg-violet-500/15 text-violet-600' : 'border-ink/12 text-ink-soft/60 hover:bg-ink/5'
              }`}
            >
              <t.icon size={14} strokeWidth={2.25} />
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <textarea
            rows={4}
            maxLength={MAX_TEXT_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              type === 'question'
                ? 'Quelle question voulez-vous poser à la communauté ?'
                : type === 'photo'
                  ? 'Ajoutez une légende (facultatif)…'
                  : 'Partagez quelque chose avec la communauté…'
            }
            style={
              activeBackground
                ? {
                    background: activeBackground.css,
                    color: activeBackground.text,
                    fontFamily: activeFont?.family,
                    fontWeight: activeFont?.weight ?? 700,
                  }
                : activeFont
                  ? { fontFamily: activeFont.family, fontWeight: activeFont.weight }
                  : undefined
            }
            className={
              activeBackground
                ? `min-h-[200px] w-full resize-none rounded-2xl border-0 px-6 py-8 text-center outline-none placeholder:text-current placeholder:opacity-60 focus:ring-4 focus:ring-violet-400/25 ${
                    text.length <= 60 ? 'text-[26px] leading-tight' : text.length <= 120 ? 'text-[22px] leading-snug' : 'text-lg leading-snug'
                  }`
                : `w-full resize-none rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15 dark:focus:bg-ink/[0.06] ${
                    activeFont && activeFont.id !== 'normal' ? 'text-[17px]' : 'text-sm'
                  }`
            }
          />

          {isTextPost && (
            <div className="space-y-2.5">
              <div>
                <p className="text-xs font-semibold text-ink-soft/70">Fond</p>
                <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setBackground(null)}
                    aria-label="Sans fond"
                    aria-pressed={!background}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white text-ink-soft/60 transition dark:bg-surface-tint ${
                      !background ? 'border-violet-600 ring-2 ring-violet-400/50' : 'border-ink/15'
                    }`}
                  >
                    <Ban size={16} strokeWidth={2} />
                  </button>
                  {POST_BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBackground(b.id)}
                      disabled={tooLongForBackground}
                      aria-label={`Fond ${b.label}`}
                      aria-pressed={background === b.id}
                      title={b.label}
                      style={{ background: b.css }}
                      className={`h-9 w-9 shrink-0 rounded-full border border-black/10 transition disabled:cursor-not-allowed disabled:opacity-35 ${
                        background === b.id && !tooLongForBackground ? 'ring-2 ring-violet-600 ring-offset-2 ring-offset-surface' : ''
                      }`}
                    />
                  ))}
                </div>
                {tooLongForBackground && (
                  <p className="mt-1 text-[11px] text-ink-soft/60">
                    Les fonds de couleur sont disponibles jusqu'à {MAX_BACKGROUND_TEXT} caractères.
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-soft/70">Police</p>
                <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
                  {POST_FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFont(f.id)}
                      aria-pressed={font === f.id}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
                        font === f.id
                          ? 'border-violet-600 bg-violet-950 text-white'
                          : 'border-ink/12 text-ink hover:bg-ink/5'
                      }`}
                      style={{ fontFamily: f.family, fontWeight: f.weight }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {type === 'photo' && (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="" className="max-h-72 w-full rounded-xl object-cover" />
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
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 py-8 text-sm font-medium text-ink-soft/60 transition hover:border-violet-400 hover:text-violet-600"
                >
                  <ImageIcon size={22} strokeWidth={1.75} />
                  Choisir une photo
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Publication…' : 'Publier'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

export default PostComposer
