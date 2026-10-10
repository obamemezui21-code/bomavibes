import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Clapperboard, HelpCircle, Image as ImageIcon, MessageSquareText, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useFeed } from '../../context/FeedContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { uploadFeedPhoto, uploadFeedVideo } from '../../firebase/feed.js'
import { readVideoFile } from '../../lib/videoFile.js'
import { canTrimVideo, trimVideo } from '../../lib/videoTrim.js'
import VideoTrimmer from './VideoTrimmer.jsx'
import ProfileLaunchOverlay from '../ProfileLaunchOverlay.jsx'
import { MAX_BACKGROUND_TEXT, POST_BACKGROUNDS, POST_FONTS, loadPostFonts, postBackground, postFont } from '../../lib/postStyles.js'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
// Feed videos: 60 s and 50 MB max (backend POST /api/feed-videos). A video
// that already fits and isn't cut is sent as is; otherwise the member picks
// the part to keep and it's cut in the browser (lib/videoTrim.js).
const MAX_VIDEO_SECONDS = 60
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_TEXT_LENGTH = 1000

// Rotating lines on the publishing animation (ProfileLaunchOverlay).
const PUBLISH_MESSAGES = ['On prépare ta publication…', 'On partage tes vibes…', 'Presque en ligne…']
const VIDEO_MESSAGES = ['Envoi de ta vidéo…', 'On prépare la lecture…', 'Encore un instant…']

const TYPES = [
  { id: 'text', label: 'Texte', icon: MessageSquareText },
  { id: 'photo', label: 'Photo', icon: ImageIcon },
  { id: 'video', label: 'Vidéo', icon: Clapperboard },
  { id: 'question', label: 'Question', icon: HelpCircle },
]

function PostComposer({ onClose, initialType = 'text' }) {
  const { createPost } = useFeed()
  const { publicProfile } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef(null)
  const [type, setType] = useState(initialType)
  const [text, setText] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  // { file, previewUrl, duration, posterBlob, start, end }
  const [video, setVideo] = useState(null)
  const [isReadingVideo, setIsReadingVideo] = useState(false)
  // 0…1 while the chosen part is being cut (null otherwise)
  const [trimProgress, setTrimProgress] = useState(null)
  const videoInputRef = useRef(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
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

  async function handleVideoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('video/')) {
      showToast('Ce fichier n’est pas une vidéo.', 'error')
      return
    }
    setIsReadingVideo(true)
    try {
      const { duration, posterBlob } = await readVideoFile(file)
      const fitsAsIs = VIDEO_TYPES.includes(file.type) && file.size <= MAX_VIDEO_BYTES && duration <= MAX_VIDEO_SECONDS + 0.5
      if (!fitsAsIs && !canTrimVideo()) {
        showToast(`Choisissez une vidéo MP4 de ${MAX_VIDEO_SECONDS} secondes et 50 Mo maximum.`, 'error')
        return
      }
      if (video) URL.revokeObjectURL(video.previewUrl)
      setVideo({
        file,
        previewUrl: URL.createObjectURL(file),
        duration,
        posterBlob,
        fitsAsIs,
        start: 0,
        end: Math.min(duration, MAX_VIDEO_SECONDS),
      })
    } catch {
      showToast('Impossible de lire cette vidéo.', 'error')
    } finally {
      setIsReadingVideo(false)
    }
  }

  const canSubmit =
    type === 'photo' ? !!photoFile : type === 'video' ? !!video && !isReadingVideo : text.trim().length > 0

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
      let videoFields = {}
      if (type === 'video' && video) {
        const isCut = video.start > 0.05 || video.end < video.duration - 0.05
        let toSend = { file: video.file, posterBlob: video.posterBlob, duration: video.duration }
        if (!video.fitsAsIs || isCut) {
          setTrimProgress(0)
          toSend = await trimVideo(video.file, video.start, video.end, {
            maxBytes: MAX_VIDEO_BYTES,
            onProgress: setTrimProgress,
          })
          setTrimProgress(null)
          if (toSend.file.size > MAX_VIDEO_BYTES) throw new Error('Vidéo trop lourde, choisissez un passage plus court.')
        }
        const uploaded = await uploadFeedVideo(toSend.file, toSend.posterBlob)
        videoFields = {
          videoUrl: uploaded.videoUrl,
          posterUrl: uploaded.posterUrl,
          duration: Math.min(MAX_VIDEO_SECONDS, Math.round(toSend.duration * 10) / 10),
        }
      }
      await createPost({
        type,
        text: text.trim() || null,
        photoUrl,
        photoThumbUrl,
        background: activeBackground ? activeBackground.id : null,
        font: activeFont && activeFont.id !== 'normal' ? activeFont.id : null,
        ...videoFields,
      })
      // A short celebration on the animation, then back to the feed.
      setIsPublished(true)
      setTimeout(() => {
        showToast('Publication envoyée.', 'success')
        onClose()
      }, 1100)
    } catch (err) {
      showToast(type === 'video' && err?.message ? err.message : 'Impossible de publier, réessayez.', 'error')
      setIsSubmitting(false)
    } finally {
      setTrimProgress(null)
    }
  }

  // Not while publishing: the post is on its way.
  function close() {
    if (!isSubmitting) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={close}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92svh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 text-ink shadow-2xl dark:bg-surface-tint sm:rounded-3xl sm:pt-5"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15 sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink">Créer une publication</h2>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 transition hover:bg-ink/5"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-surface-soft p-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              aria-pressed={type === t.id}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition ${
                type === t.id
                  ? 'bg-white text-violet-600 shadow-sm dark:bg-ink/10 dark:text-violet-300'
                  : 'text-ink-soft/60 hover:text-ink'
              }`}
            >
              <t.icon size={18} strokeWidth={2.25} />
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
                : type === 'photo' || type === 'video'
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
                : `w-full resize-none rounded-2xl border border-ink/12 bg-ink/[0.03] px-4 py-3 text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15 dark:focus:bg-ink/[0.06] ${
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
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-400/40 bg-violet-500/[0.04] py-8 text-sm font-semibold text-violet-600 transition hover:border-violet-400 hover:bg-violet-500/[0.08] dark:text-violet-300"
                >
                  <ImageIcon size={24} strokeWidth={1.75} />
                  Choisir une photo
                </button>
              )}
            </div>
          )}

          {type === 'video' && (
            <div>
              <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
              {video ? (
                <div className="relative">
                  {canTrimVideo() ? (
                    <div className={isSubmitting ? 'pointer-events-none opacity-60' : ''}>
                      <VideoTrimmer
                        src={video.previewUrl}
                        duration={video.duration}
                        maxLength={MAX_VIDEO_SECONDS}
                        start={video.start}
                        end={video.end}
                        onChange={(start, end) => setVideo((v) => ({ ...v, start, end }))}
                      />
                    </div>
                  ) : (
                    <video src={video.previewUrl} controls playsInline className="max-h-72 w-full rounded-xl bg-black" />
                  )}
                  {video.duration > MAX_VIDEO_SECONDS + 0.5 && (
                    <p className="mt-2 text-[11px] text-ink-soft/60">
                      Votre vidéo dure {Math.round(video.duration)} s : déplacez les poignées pour choisir les{' '}
                      {MAX_VIDEO_SECONDS} secondes à publier.
                    </p>
                  )}
                  {trimProgress !== null && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-[width]"
                          style={{ width: `${Math.round(trimProgress * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-soft/60">
                        Découpage de la vidéo… {Math.round(trimProgress * 100)} % — gardez cette page ouverte.
                      </p>
                    </div>
                  )}
                  <button
                    disabled={isSubmitting}
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(video.previewUrl)
                      setVideo(null)
                    }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
                    aria-label="Retirer la vidéo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isReadingVideo}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-400/40 bg-violet-500/[0.04] py-8 text-sm font-semibold text-violet-600 transition hover:border-violet-400 hover:bg-violet-500/[0.08] disabled:opacity-60 dark:text-violet-300"
                >
                  <Clapperboard size={24} strokeWidth={1.75} />
                  {isReadingVideo ? 'Lecture de la vidéo…' : 'Choisir une vidéo'}
                  <span className="text-[11px] font-normal text-ink-soft/60">Plus longue ? Vous choisirez les 60 secondes à publier.</span>
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {isSubmitting
              ? type === 'video'
                ? trimProgress !== null
                  ? 'Découpage de la vidéo…'
                  : 'Envoi de la vidéo…'
                : 'Publication…'
              : 'Publier'}
          </button>
        </form>
      </motion.div>
      {createPortal(
        <AnimatePresence>
          {isSubmitting && (
            <div key="publishing" className="relative z-[120]">
              <ProfileLaunchOverlay
                photoUrl={photoPreview || publicProfile?.photos?.[0]}
                done={isPublished}
                messages={type === 'video' ? VIDEO_MESSAGES : PUBLISH_MESSAGES}
                status={trimProgress !== null ? `Découpage de la vidéo… ${Math.round(trimProgress * 100)} %` : null}
                doneTitle="C’est publié ! 🎉"
                doneSubtitle="Ta publication est en ligne"
              />
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

export default PostComposer
