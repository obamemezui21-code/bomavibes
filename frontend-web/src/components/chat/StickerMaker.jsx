import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ImagePlus, X } from 'lucide-react'
import { uploadSticker } from '../../firebase/stickers.js'
import { useToast } from '../../context/ToastContext.jsx'

const SIZE = 512 // exported sticker, px
const PREVIEW = 280 // on-screen preview, CSS px
const SHAPES = [
  { id: 'circle', label: 'Rond' },
  { id: 'rounded', label: 'Arrondi' },
  { id: 'square', label: 'Carré' },
]
const EMOJIS = ['', '😂', '😍', '🔥', '❤️', '😎', '🙏', '👀', '🎉', '💯', '😭', '🥰']
const MAX_PHOTO_BYTES = 15 * 1024 * 1024

function shapePath(ctx, shape, inset) {
  const s = SIZE - inset * 2
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(SIZE / 2, SIZE / 2, s / 2, 0, Math.PI * 2)
  else if (shape === 'rounded') ctx.roundRect(inset, inset, s, s, s * 0.18)
  else ctx.rect(inset, inset, s, s)
}

// Draws the sticker at SIZE × SIZE on a transparent background.
function drawSticker(ctx, img, { offsetX, offsetY, zoom, shape, outline, text, emoji }) {
  ctx.clearRect(0, 0, SIZE, SIZE)
  const border = outline ? SIZE * 0.035 : 0
  const inset = border + SIZE * 0.02

  ctx.save()
  shapePath(ctx, shape, inset)
  ctx.clip()
  if (img) {
    // Cover the shape, then zoom and pan.
    const cover = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight) * zoom
    const w = img.naturalWidth * cover
    const h = img.naturalHeight * cover
    ctx.drawImage(img, (SIZE - w) / 2 + offsetX * SIZE, (SIZE - h) / 2 + offsetY * SIZE, w, h)
  }
  ctx.restore()

  if (outline) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = SIZE * 0.02
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = border * 2
    shapePath(ctx, shape, inset)
    ctx.stroke()
    ctx.restore()
  }

  if (text.trim()) {
    const words = text.trim().toUpperCase()
    let fontSize = SIZE * 0.13
    ctx.font = `900 ${fontSize}px Impact, "Arial Black", system-ui, sans-serif`
    while (ctx.measureText(words).width > SIZE * 0.86 && fontSize > SIZE * 0.06) {
      fontSize -= 2
      ctx.font = `900 ${fontSize}px Impact, "Arial Black", system-ui, sans-serif`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.lineJoin = 'round'
    ctx.lineWidth = fontSize * 0.18
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#fff'
    const y = SIZE - inset - SIZE * 0.06
    ctx.strokeText(words, SIZE / 2, y, SIZE * 0.86)
    ctx.fillText(words, SIZE / 2, y, SIZE * 0.86)
  }

  if (emoji) {
    ctx.font = `${SIZE * 0.22}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, SIZE * 0.8, SIZE * 0.2)
  }
}

// "Créer un sticker", WhatsApp-style: pick a photo, frame it (drag + zoom),
// choose a shape and the white outline, add a caption and an emoji, save.
function StickerMaker({ onClose, onCreated }) {
  const { showToast } = useToast()
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragRef = useRef(null)
  const [img, setImg] = useState(null)
  const [opts, setOpts] = useState({ offsetX: 0, offsetY: 0, zoom: 1, shape: 'circle', outline: true, text: '', emoji: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawSticker(ctx, img, opts)
  }, [img, opts])

  const set = (patch) => setOpts((o) => ({ ...o, ...patch }))

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_BYTES) {
      showToast('Choisissez une photo (15 Mo maximum).', 'error')
      return
    }
    const image = new Image()
    image.onload = () => {
      setImg(image)
      set({ offsetX: 0, offsetY: 0, zoom: 1 })
    }
    image.onerror = () => showToast('Impossible de lire cette photo.', 'error')
    image.src = URL.createObjectURL(file)
  }

  function onPointerDown(e) {
    if (!img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, startX: opts.offsetX, startY: opts.offsetY }
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    set({ offsetX: d.startX + (e.clientX - d.x) / PREVIEW, offsetY: d.startY + (e.clientY - d.y) / PREVIEW })
  }

  function onPointerUp() {
    dragRef.current = null
  }

  async function handleSave() {
    if (!img || isSaving) return
    setIsSaving(true)
    try {
      const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'))
      const sticker = await uploadSticker(blob)
      showToast('Sticker ajouté à « Mes stickers ».', 'success')
      onCreated?.(sticker)
    } catch (err) {
      showToast(err.message === 'request failed' ? 'Impossible de créer le sticker, réessayez.' : err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const chip = (active) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-white text-violet-950' : 'bg-white/12 text-white hover:bg-white/20'}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[#111] text-white"
    >
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Fermer">
          <X size={20} />
        </button>
        <p className="font-display text-base font-semibold">Créer un sticker</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={!img || isSaving}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 disabled:opacity-40"
          aria-label="Enregistrer le sticker"
        >
          {isSaving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Check size={20} strokeWidth={2.5} />
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Checkerboard behind = transparent areas of the sticker */}
        <div
          className="relative shrink-0 touch-none rounded-2xl"
          style={{
            width: PREVIEW,
            height: PREVIEW,
            backgroundImage: 'conic-gradient(#2a2a2a 25%, #1c1c1c 0 50%, #2a2a2a 0 75%, #1c1c1c 0)',
            backgroundSize: '24px 24px',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: PREVIEW, height: PREVIEW }} />
          {!img && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-white/80"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
                <ImagePlus size={28} />
              </span>
              Choisir une photo
            </button>
          )}
        </div>

        {img && (
          <>
            <p className="-mt-2 text-xs text-white/50">Faites glisser la photo pour la cadrer</p>
            <label className="flex w-full max-w-xs items-center gap-3 text-xs text-white/70">
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={opts.zoom}
                onChange={(e) => set({ zoom: Number(e.target.value) })}
                className="flex-1 accent-pink-500"
              />
            </label>

            <div className="flex flex-wrap justify-center gap-2">
              {SHAPES.map((s) => (
                <button key={s.id} type="button" onClick={() => set({ shape: s.id })} className={chip(opts.shape === s.id)}>
                  {s.label}
                </button>
              ))}
              <button type="button" onClick={() => set({ outline: !opts.outline })} className={chip(opts.outline)}>
                Contour blanc
              </button>
            </div>

            <input
              type="text"
              maxLength={30}
              value={opts.text}
              onChange={(e) => set({ text: e.target.value })}
              placeholder="Ajouter un texte (facultatif)"
              className="w-full max-w-xs rounded-full bg-white/10 px-4 py-2.5 text-center text-sm text-white placeholder-white/45 outline-none focus:bg-white/15"
            />

            <div className="flex max-w-xs flex-wrap justify-center gap-1.5">
              {EMOJIS.map((em) => (
                <button
                  key={em || 'none'}
                  type="button"
                  onClick={() => set({ emoji: em })}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${
                    opts.emoji === em ? 'bg-white/25 ring-2 ring-pink-400' : 'bg-white/8 hover:bg-white/15'
                  }`}
                  aria-label={em ? `Ajouter ${em}` : 'Sans emoji'}
                >
                  {em || <X size={16} className="text-white/60" />}
                </button>
              ))}
            </div>

            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-white/60 underline">
              Changer de photo
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default StickerMaker
