import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileText,
  Flag,
  Hand,
  Info,
  Mic,
  MessageCircle,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Reply,
  Search,
  Send,
  Share2,
  Smile,
  Sticker,
  Trash2,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { uploadVoiceNote } from '../firebase/voiceNotes.js'
import { uploadChatAttachment, formatFileSize } from '../firebase/chatAttachments.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { fallbackToFullPhoto } from '../lib/photoVariants.js'
import { messagePreviewText } from '../lib/messagePreview.js'
import { matchPercent } from '../lib/interests.js'
import { STICKERS, stickerSrc } from '../lib/stickers.js'
import ReportModal from '../components/ReportModal.jsx'
import ProfileDetailModal from '../components/ProfileDetailModal.jsx'

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024

const TYPING_STOP_DELAY_MS = 2500
const MAX_RECORDING_SECONDS = 120
const LONG_PRESS_MS = 450
const LONG_PRESS_MOVE_TOLERANCE = 10
const TEXTAREA_MAX_HEIGHT = 140
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

function autoResizeTextarea(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
}

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

function VoiceMessage({ url, duration, fromMe }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0

  return (
    <div className="flex min-w-0 w-full max-w-48 items-center gap-2.5">
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          fromMe ? 'bg-white/25 text-ink-on-brand' : 'bg-violet-500/15 text-violet-600'
        }`}
        aria-label={isPlaying ? 'Pause' : 'Lecture'}
      >
        {isPlaying ? <Pause size={14} strokeWidth={2.5} /> : <Play size={14} strokeWidth={2.5} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`h-1.5 w-full overflow-hidden rounded-full ${fromMe ? 'bg-white/30' : 'bg-ink/10'}`}>
          <div
            className={`h-full rounded-full ${fromMe ? 'bg-ink-on-brand' : 'bg-violet-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`mt-1 block text-[10px] ${fromMe ? 'text-white/70' : 'text-ink-soft/50'}`}>
          {formatDuration(isPlaying || progress > 0 ? progress : duration)}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setProgress(0)
        }}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
      />
    </div>
  )
}

function FileMessage({ url, fileName, fileSize, fromMe }) {
  return (
    <a
      href={url}
      download={fileName}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex min-w-0 w-full max-w-56 items-center gap-2.5"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          fromMe ? 'bg-white/25 text-ink-on-brand' : 'bg-violet-500/15 text-violet-600'
        }`}
      >
        <FileText size={16} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fileName}</p>
        <span className={`text-[10px] ${fromMe ? 'text-white/70' : 'text-ink-soft/50'}`}>
          {formatFileSize(fileSize)}
        </span>
      </div>
      <Download size={15} strokeWidth={2.25} className="shrink-0 opacity-70" />
    </a>
  )
}

function ImageLightbox({ url, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        aria-label="Fermer"
      >
        <X size={20} strokeWidth={2.25} />
      </button>
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  )
}

function DeleteMessageModal({ onCancel, onConfirm, isDeleting }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-sm rounded-2xl p-6 text-center"
      >
        <TriangleAlert size={32} strokeWidth={1.5} className="mx-auto text-coral-500" />
        <h2 className="mt-2 font-display text-lg font-semibold text-ink">Supprimer ce message ?</h2>
        <p className="mt-1 text-sm text-ink-soft/70">Cette action est définitive et ne peut pas être annulée.</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-xl bg-coral-500 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Builds a ProfileDetailModal-shaped object straight from the already-loaded
// conversation data — no Firestore round-trip — so tapping a chat header
// opens the profile instantly instead of waiting on a fetch. Only the fields
// ConversationsContext already carries are available (no bio/personality
// traits/other photos); that's a real subset of the profile, not fake data.
function buildChatProfile(c) {
  return {
    id: c.otherUid,
    firstName: c.profile.firstName,
    age: c.profile.age,
    city: c.profile.city,
    verified: c.profile.verified,
    interests: c.profile.interests,
    photos: [c.profile.photoFull],
  }
}

function formatListTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function isSameDay(a, b) {
  return !!a && !!b && a.toDateString() === b.toDateString()
}

function formatDayLabel(date) {
  if (!date) return ''
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(date, now)) return "Aujourd'hui"
  if (isSameDay(date, yesterday)) return 'Hier'
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function groupReactions(reactions) {
  const counts = {}
  for (const emoji of Object.values(reactions || {})) {
    counts[emoji] = (counts[emoji] || 0) + 1
  }
  return counts
}

function MessageInfoModal({ message, otherName, onClose }) {
  const fullDate = message.date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-sm rounded-2xl p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Informations</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/10"
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-soft/60">Envoyé</span>
            <span className="text-ink">{fullDate}</span>
          </div>
          {message.edited && (
            <div className="flex items-center justify-between">
              <span className="text-ink-soft/60">Modifié</span>
              <span className="text-ink">Oui</span>
            </div>
          )}
          {message.fromMe ? (
            <div className="flex items-center justify-between">
              <span className="text-ink-soft/60">Statut</span>
              <span className="flex items-center gap-1.5 text-ink">
                {message.status === 'sending' && (
                  <>
                    <Clock size={13} strokeWidth={2.5} /> Envoi en cours
                  </>
                )}
                {message.status === 'sent' && (
                  <>
                    <Check size={14} strokeWidth={2.5} /> Envoyé, non lu
                  </>
                )}
                {message.status === 'read' && (
                  <>
                    <CheckCheck size={14} strokeWidth={2.5} className="text-violet-500" /> Lu par {otherName}
                  </>
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-ink-soft/60">De</span>
              <span className="text-ink">{otherName}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function Chat() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const {
    conversations,
    typingId,
    sendMessage,
    sendVoiceMessage,
    sendAttachmentMessage,
    sendStickerMessage,
    editMessage,
    deleteMessage,
    toggleMessageReaction,
    openConversation,
    closeConversation,
    setTyping,
    refreshBlockedIds,
  } = useConversations()
  const { user, publicProfile } = useAuth()
  const { showToast } = useToast()
  const { theme } = useTheme()
  const [draft, setDraft] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [expandedProfile, setExpandedProfile] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [infoMessage, setInfoMessage] = useState(null)
  const [replyTarget, setReplyTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [isSubmittingSafety, setIsSubmittingSafety] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isSendingVoice, setIsSendingVoice] = useState(false)
  const [isSendingAttachment, setIsSendingAttachment] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const listScrollRef = useRef(null)
  const [showScrollUp, setShowScrollUp] = useState(false)
  const isNearBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const recordingSecondsRef = useRef(0)
  const textareaRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const pointerStartRef = useRef({ x: 0, y: 0 })

  const activeId = conversationId || conversations[0]?.id
  const active = conversations.find((c) => c.id === activeId)

  const prevActiveIdRef = useRef(null)

  function scrollToBottom(behavior) {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }

  function handleThreadScroll(e) {
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    isNearBottomRef.current = nearBottom
    if (nearBottom) setShowNewMessagesPill(false)
  }

  useEffect(() => {
    const isConversationSwitch = prevActiveIdRef.current !== activeId
    prevActiveIdRef.current = activeId
    const messages = active?.messages || []
    const grew = messages.length > prevMessageCountRef.current
    const lastMine = messages[messages.length - 1]?.fromMe
    prevMessageCountRef.current = messages.length

    if (isConversationSwitch) {
      isNearBottomRef.current = true
      setShowNewMessagesPill(false)
      setSelectedMessage(null)
      setReplyTarget(null)
      const frame = requestAnimationFrame(() => scrollToBottom('auto'))
      return () => cancelAnimationFrame(frame)
    }

    // Never yank the view away while someone is reading older messages —
    // unless it's their own message, which should always come into view.
    if (grew && (lastMine || isNearBottomRef.current)) {
      const frame = requestAnimationFrame(() => scrollToBottom('smooth'))
      return () => cancelAnimationFrame(frame)
    }
    if (grew && !lastMine && !isNearBottomRef.current) {
      setShowNewMessagesPill(true)
      return undefined
    }

    if (typingId === activeId && isNearBottomRef.current) {
      const frame = requestAnimationFrame(() => scrollToBottom('smooth'))
      return () => cancelAnimationFrame(frame)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active?.messages.length, typingId])

  useEffect(() => {
    if (conversationId) openConversation(conversationId)
    // openConversation is a fresh reference on every ConversationsProvider
    // re-render (heartbeat tick, any match update...) — depending on it here
    // would re-fire the Firestore write on every one of those, not just on
    // an actual conversation switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    return () => clearTimeout(typingTimeoutRef.current)
  }, [activeId])

  useEffect(() => {
    // Stop listening to this conversation's messages once the Chat page is
    // actually left (not on every re-render — see closeConversation).
    return () => closeConversation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    autoResizeTextarea(textareaRef.current)
  }, [draft])

  function handleEmojiClick(emojiData) {
    handleDraftChange(draft + emojiData.emoji)
  }

  function handleStickerClick(stickerId) {
    if (!active) return
    setShowStickerPicker(false)
    sendStickerMessage(active.id, stickerId)
  }

  function handleDraftChange(value) {
    setDraft(value)
    if (!active) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      setTyping(active.id, true)
    }
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      setTyping(active.id, false)
    }, TYPING_STOP_DELAY_MS)
  }

  function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !active) return
    clearTimeout(typingTimeoutRef.current)
    isTypingRef.current = false
    setTyping(active.id, false)
    if (editingMessageId) {
      editMessage(active.id, editingMessageId, text)
      setEditingMessageId(null)
    } else {
      sendMessage(active.id, text, replyTarget)
      setReplyTarget(null)
    }
    setDraft('')
  }

  function handleTextareaKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  async function handleAttachmentSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !active) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      showToast('Fichier trop volumineux (15 Mo maximum).', 'error')
      return
    }
    setIsSendingAttachment(true)
    try {
      const attachment = await uploadChatAttachment(file)
      await sendAttachmentMessage(active.id, attachment)
    } catch {
      showToast("Impossible d'envoyer le fichier, réessayez.", 'error')
    } finally {
      setIsSendingAttachment(false)
    }
  }

  function clearLongPressTimer() {
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  function handleMessagePointerDown(m) {
    return (e) => {
      if (e.pointerType === 'mouse') return
      pointerStartRef.current = { x: e.clientX, y: e.clientY }
      clearLongPressTimer()
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        setSelectedMessage(m)
        if (navigator.vibrate) navigator.vibrate(15)
      }, LONG_PRESS_MS)
    }
  }

  function handleMessagePointerMove(e) {
    if (!longPressTimerRef.current) return
    const dx = Math.abs(e.clientX - pointerStartRef.current.x)
    const dy = Math.abs(e.clientY - pointerStartRef.current.y)
    if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) clearLongPressTimer()
  }

  function handleMessageContextMenu(m) {
    return (e) => {
      e.preventDefault()
      setSelectedMessage(m)
    }
  }

  function handleReply(m) {
    setSelectedMessage(null)
    if (editingMessageId) cancelEdit()
    setReplyTarget(m)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  async function handleCopy(m) {
    setSelectedMessage(null)
    try {
      await navigator.clipboard.writeText(m.text || '')
      showToast('Message copié.', 'success')
    } catch {
      showToast('Impossible de copier le message.', 'error')
    }
  }

  function handleReact(m, emoji) {
    if (!active) return
    toggleMessageReaction(active.id, m.id, emoji)
    setSelectedMessage(null)
  }

  async function handleShare(m) {
    setSelectedMessage(null)
    try {
      await navigator.share({ text: m.text })
    } catch {
      // User cancelled the native share sheet, or the browser blocked it —
      // either way there's nothing useful to show the user here.
    }
  }

  function handleShowInfo(m) {
    setSelectedMessage(null)
    setInfoMessage(m)
  }

  function stopRecordingTimer() {
    clearInterval(recordingTimerRef.current)
    recordingTimerRef.current = null
  }

  function teardownStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  async function startRecording() {
    if (!active || isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()

      recordingSecondsRef.current = 0
      setRecordingSeconds(0)
      setIsRecording(true)
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1
        setRecordingSeconds(recordingSecondsRef.current)
        if (recordingSecondsRef.current >= MAX_RECORDING_SECONDS) {
          stopRecording(true)
        }
      }, 1000)
    } catch {
      showToast('Autorisez le micro pour envoyer une note vocale.', 'error')
    }
  }

  function stopRecording(send) {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    stopRecordingTimer()
    setIsRecording(false)

    recorder.onstop = async () => {
      const chunks = chunksRef.current
      const duration = recordingSecondsRef.current
      teardownStream()

      if (!send || chunks.length === 0 || duration < 1) return

      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      setIsSendingVoice(true)
      try {
        const url = await uploadVoiceNote(blob)
        await sendVoiceMessage(active.id, url, duration)
      } catch {
        showToast("Impossible d'envoyer la note vocale, réessayez.", 'error')
      } finally {
        setIsSendingVoice(false)
      }
    }
    recorder.stop()
  }

  useEffect(() => {
    return () => {
      stopRecordingTimer()
      teardownStream()
    }
  }, [activeId])

  function startEdit(m) {
    setEditingMessageId(m.id)
    setDraft(m.text)
    setSelectedMessage(null)
    setReplyTarget(null)
  }

  function cancelEdit() {
    setEditingMessageId(null)
    setDraft('')
  }

  function handleDelete(m) {
    setSelectedMessage(null)
    setDeleteTarget(m)
  }

  async function confirmDelete() {
    if (!active || !deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteMessage(active.id, deleteTarget.id)
      if (editingMessageId === deleteTarget.id) cancelEdit()
      setDeleteTarget(null)
    } catch (err) {
      console.error('Échec de la suppression du message:', err)
      showToast('Impossible de supprimer ce message, réessayez.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleReportUser(reason, description, alsoBlock) {
    if (!active) return
    setIsSubmittingSafety(true)
    try {
      await reportUser(user.id, active.otherUid, reason, description)
      if (alsoBlock) {
        await blockUser(user.id, active.otherUid)
        await refreshBlockedIds()
        navigate('/chat')
      }
      showToast('Signalement envoyé. Merci de nous aider à garder BomaVibes sûr.', 'success')
      setShowReport(false)
    } catch {
      showToast("Impossible d'envoyer le signalement, réessayez.", 'error')
    } finally {
      setIsSubmittingSafety(false)
    }
  }

  // ProfileDetailModal already performs the actual block write itself before
  // calling this — just handle the chat-specific fallout (refresh the
  // blocked-ids cache, leave a conversation that no longer applies).
  async function handleProfileBlocked() {
    await refreshBlockedIds()
    setExpandedProfile(null)
    navigate('/chat')
  }

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-surface-soft p-6 text-center desktop:min-h-full">
        <MessageCircle size={40} strokeWidth={1.5} className="text-ink-soft/40" />
        <h1 className="font-display text-2xl font-semibold text-ink">Messages 💬</h1>
        <p className="max-w-xs text-sm text-ink-soft/70">
          Vos conversations avec vos matchs apparaîtront ici.
        </p>
      </div>
    )
  }

  const newMatches = conversations.filter((c) => c.isNewMatch)
  const query = listSearch.trim().toLowerCase()
  const visibleConversations = query
    ? conversations.filter((c) => c.profile.firstName.toLowerCase().includes(query))
    : conversations

  return (
    <div className="flex h-[calc(100dvh_-_5rem_-_3.5rem_-_env(safe-area-inset-bottom))] overflow-hidden bg-surface-soft desktop:h-[calc(100svh_-_3.5rem)]">
      {/* Conversation list */}
      <div
        className={`relative w-full flex-col border-r border-ink/8 desktop:flex desktop:w-80 ${
          conversationId ? 'hidden' : 'flex'
        }`}
      >
        <div className="border-b border-ink/8 px-5 pb-4 pt-5">
          <h1 className="font-display text-xl font-semibold text-ink">Messages</h1>
          <div className="relative mt-3">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-full border border-ink/12 bg-ink/[0.04] py-2.5 pl-9 pr-3.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15 dark:focus:bg-ink/[0.06]"
            />
          </div>
        </div>
        <div
          ref={listScrollRef}
          onScroll={(e) => setShowScrollUp(e.currentTarget.scrollTop > 300)}
          className="flex-1 overflow-y-auto px-3 py-3"
        >
          {newMatches.length > 0 && !query && (
            <div className="mb-4">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/50">
                Nouveaux matchs
              </p>
              <div className="mt-2 flex gap-3 overflow-x-auto px-1 pb-1">
                {newMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/chat/${c.id}`)}
                    className="flex shrink-0 flex-col items-center gap-1"
                  >
                    <span className="relative block rounded-full bg-gradient-to-br from-pink-500 to-violet-500 p-[2px]">
                      <img
                        src={c.profile.photo}
                        onError={fallbackToFullPhoto(c.profile.photoFull)}
                        alt={c.profile.firstName}
                        className="h-14 w-14 rounded-full border-2 border-surface-soft object-cover"
                      />
                      {c.online && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface-soft bg-mint-500" />
                      )}
                    </span>
                    <span className="max-w-[4rem] truncate text-xs font-medium text-ink">{c.profile.firstName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {visibleConversations.map((c) => {
              const last = c.messages[c.messages.length - 1]
              const isActive = c.id === activeId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/chat/${c.id}`)}
                  className={`relative flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:border-violet-400/30 dark:bg-surface-tint ${
                    isActive ? 'border-violet-400/60 ring-2 ring-violet-400/30' : 'border-ink/8'
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0">
                    <img
                      src={c.profile.photoFull || c.profile.photo}
                      onError={fallbackToFullPhoto(c.profile.photo)}
                      alt=""
                      className="h-full w-full object-cover opacity-[0.08] grayscale dark:opacity-[0.12]"
                    />
                    <div className="absolute inset-0 bg-white/85 dark:bg-surface-tint/85" />
                  </div>
                  <div className="relative shrink-0">
                    <img
                      src={c.profile.photo}
                      onError={fallbackToFullPhoto(c.profile.photoFull)}
                      alt={c.profile.firstName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    {c.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-mint-500 dark:border-surface-tint" />
                    )}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold text-ink">
                      <span className="truncate">
                        {c.profile.firstName}
                        {c.profile.age ? `, ${c.profile.age}` : ''}
                      </span>
                      {c.profile.verified && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
                          <Check size={9} strokeWidth={3} />
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-soft/60">
                      {typingId === c.id ? (
                        <span className="text-violet-600">écrit…</span>
                      ) : (
                        (last ? messagePreviewText(last) : c.lastMessage) || 'Dites bonjour 👋'
                      )}
                    </p>
                  </div>
                  <div className="relative flex shrink-0 flex-col items-end gap-1">
                    {c.lastActivityAt && (
                      <span className="text-[11px] text-ink-soft/50">{formatListTime(c.lastActivityAt)}</span>
                    )}
                    {!!c.unreadCount && typingId !== c.id && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-1 text-[10px] font-bold text-ink-on-brand">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            {visibleConversations.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-ink-soft/50">Aucune conversation trouvée.</p>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showScrollUp && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => listScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-lg shadow-violet-500/25"
              aria-label="Remonter en haut"
            >
              <ChevronUp size={18} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Thread */}
      <div className={`min-w-0 flex-1 flex-col desktop:flex ${conversationId ? 'flex' : 'hidden'}`}>
        {active && (
          <>
            {selectedMessage ? (
              <div className="flex shrink-0 flex-col gap-1.5 border-b border-ink/8 bg-violet-500/8 px-2 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/10"
                    aria-label="Annuler la sélection"
                  >
                    <X size={18} strokeWidth={2.25} />
                  </button>
                  <div className="flex flex-1 items-center justify-end gap-0.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => handleReply(selectedMessage)}
                      title="Répondre"
                      aria-label="Répondre"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/10"
                    >
                      <Reply size={18} strokeWidth={2.25} />
                    </button>
                    {selectedMessage.type === 'text' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedMessage)}
                        title="Copier"
                        aria-label="Copier le texte"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/10"
                      >
                        <Copy size={17} strokeWidth={2.25} />
                      </button>
                    )}
                    {selectedMessage.fromMe && selectedMessage.type === 'text' && (
                      <button
                        type="button"
                        onClick={() => startEdit(selectedMessage)}
                        title="Modifier"
                        aria-label="Modifier"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/10"
                      >
                        <Pencil size={17} strokeWidth={2.25} />
                      </button>
                    )}
                    {canShare && selectedMessage.type === 'text' && (
                      <button
                        type="button"
                        onClick={() => handleShare(selectedMessage)}
                        title="Partager"
                        aria-label="Partager"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/10"
                      >
                        <Share2 size={17} strokeWidth={2.25} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleShowInfo(selectedMessage)}
                      title="Informations"
                      aria-label="Informations"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/10"
                    >
                      <Info size={17} strokeWidth={2.25} />
                    </button>
                    {selectedMessage.fromMe && (
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedMessage)}
                        title="Supprimer"
                        aria-label="Supprimer"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-coral-500 transition hover:bg-coral-500/10"
                      >
                        <Trash2 size={17} strokeWidth={2.25} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto px-1 pb-0.5">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReact(selectedMessage, emoji)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg transition hover:scale-110 hover:bg-ink/10 ${
                        selectedMessage.reactions?.[user.id] === emoji ? 'bg-violet-500/15' : ''
                      }`}
                      aria-label={`Réagir avec ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-3 border-b border-ink/8 px-4 py-3">
                <button
                  type="button"
                  onClick={() => navigate('/chat')}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5 desktop:hidden"
                  aria-label="Retour"
                >
                  <ArrowLeft size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedProfile(buildChatProfile(active))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <img
                    src={active.profile.photo}
                    onError={fallbackToFullPhoto(active.profile.photoFull)}
                    alt={active.profile.firstName}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{active.profile.firstName}</p>
                    <p className="truncate text-xs">
                      {active.online ? (
                        <span className="text-mint-500">En ligne</span>
                      ) : (
                        <span className="text-ink-soft/50">{active.lastSeenLabel || active.profile.city}</span>
                      )}
                    </p>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => showToast('Bientôt disponible.', 'info')}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/12 text-ink-soft/70 transition hover:bg-ink/5"
                    aria-label="Télécharger la conversation"
                  >
                    <Download size={16} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReport(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/12 text-ink-soft/70 transition hover:bg-ink/5"
                    aria-label="Signaler"
                  >
                    <Flag size={16} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast('Bientôt disponible.', 'info')}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/12 text-ink-soft/70 transition hover:bg-ink/5"
                    aria-label="Appel vidéo"
                  >
                    <Video size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}

            <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <img
                src={active.profile.photoFull || active.profile.photo}
                onError={fallbackToFullPhoto(active.profile.photo)}
                alt=""
                className="h-full w-full object-cover opacity-[0.07] blur-[1px] grayscale dark:opacity-[0.1]"
              />
              <div className="absolute inset-0 bg-surface-soft/85" />
            </div>
            <div ref={scrollRef} onScroll={handleThreadScroll} className="relative h-full space-y-2 overflow-y-auto px-4 py-4">
              {active.messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Hand size={32} strokeWidth={1.5} className="text-ink-soft/40" />
                  <p className="text-sm text-ink-soft/60">
                    🎉 C'est un match avec {active.profile.firstName} ! Envoyez le premier message.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {active.messages.map((m, i) => {
                  const showDaySeparator = !isSameDay(m.date, active.messages[i - 1]?.date)
                  const isSticker = m.type === 'sticker'
                  const isPost = m.type === 'post'
                  const bubbleClass = isSticker || isPost
                    ? 'cursor-pointer select-none'
                    : `min-w-0 max-w-full cursor-pointer select-none rounded-2xl px-3.5 py-2 text-sm transition ${
                        m.fromMe
                          ? 'rounded-br-sm bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand'
                          : 'rounded-bl-sm bg-ink/6 text-ink'
                      }`
                  return (
                    <Fragment key={m.id}>
                      {showDaySeparator && (
                        <div className="flex justify-center py-2">
                          <span className="rounded-full bg-ink/8 px-3 py-1 text-[11px] font-medium text-ink-soft/60">
                            {formatDayLabel(m.date)}
                          </span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className={`flex items-center gap-1 ${m.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex min-w-0 max-w-[min(75%,32rem)] flex-col gap-0.5 ${m.fromMe ? 'items-end' : 'items-start'}`}>
                        <div
                          onPointerDown={handleMessagePointerDown(m)}
                          onPointerMove={handleMessagePointerMove}
                          onPointerUp={clearLongPressTimer}
                          onPointerLeave={clearLongPressTimer}
                          onPointerCancel={clearLongPressTimer}
                          onContextMenu={handleMessageContextMenu(m)}
                          style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
                          className={`${bubbleClass} min-w-0 max-w-full ${
                            selectedMessage?.id === m.id ? 'rounded-2xl ring-2 ring-violet-400' : ''
                          }`}
                        >
                          {m.replyTo && (
                            <div
                              className={`mb-1 rounded-lg border-l-2 px-2 py-1 text-xs ${
                                m.fromMe ? 'border-white/60 bg-black/10' : 'border-violet-400 bg-ink/5'
                              }`}
                            >
                              <p className={`font-semibold ${m.fromMe ? 'text-white/90' : 'text-violet-600'}`}>
                                {m.replyTo.senderId === user.id ? 'Vous' : active.profile.firstName}
                              </p>
                              <p className={`truncate ${m.fromMe ? 'text-white/70' : 'text-ink-soft/60'}`}>
                                {m.replyTo.text}
                              </p>
                            </div>
                          )}
                          {m.type === 'voice' ? (
                            <VoiceMessage url={m.audioUrl} duration={m.duration} fromMe={m.fromMe} />
                          ) : m.type === 'image' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setLightboxUrl(m.fileUrl)
                              }}
                              className="block"
                            >
                              <img
                                src={m.fileUrl}
                                alt=""
                                className="max-h-64 max-w-full rounded-lg object-cover"
                              />
                            </button>
                          ) : m.type === 'file' ? (
                            <FileMessage url={m.fileUrl} fileName={m.fileName} fileSize={m.fileSize} fromMe={m.fromMe} />
                          ) : isSticker ? (
                            <img src={stickerSrc(m.stickerId)} alt="" className="h-28 w-28 object-contain" />
                          ) : isPost ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/feed/${m.post.postId}`)
                              }}
                              className="block min-w-0 max-w-full overflow-hidden rounded-xl border border-ink/10 bg-white text-left shadow-sm dark:bg-surface-tint"
                              style={{ maxWidth: 'clamp(200px, 100%, 224px)' }}
                            >
                              {m.post.photoUrl && (
                                <img src={m.post.photoUrl} alt="" className="h-32 w-full object-cover" />
                              )}
                              <div className="p-2.5">
                                <p className="flex items-center gap-1 text-[11px] font-semibold text-violet-600">
                                  <Send size={11} strokeWidth={2.5} />
                                  Publication de {m.post.authorName || 'quelqu’un'}
                                </p>
                                {m.post.text && (
                                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft/70">{m.post.text}</p>
                                )}
                              </div>
                            </button>
                          ) : (
                            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>
                          )}
                          <p
                            className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                              isSticker || isPost ? 'text-ink-soft/50' : m.fromMe ? 'text-white/70' : 'text-ink-soft/50'
                            }`}
                          >
                            {m.time}
                            {m.edited && ' · modifié'}
                            {m.fromMe && (
                              <span className="inline-flex items-center" aria-label={`Statut : ${m.status}`}>
                                {m.status === 'sending' && <Clock size={11} strokeWidth={2.5} />}
                                {m.status === 'sent' && <Check size={12} strokeWidth={2.5} />}
                                {m.status === 'read' && <CheckCheck size={12} strokeWidth={2.5} className="text-sky-300" />}
                              </span>
                            )}
                          </p>
                        </div>
                        {m.reactions && Object.keys(m.reactions).length > 0 && (
                          <div className="flex min-w-0 max-w-full flex-wrap gap-1">
                            {Object.entries(groupReactions(m.reactions)).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReact(m, emoji)}
                                className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition ${
                                  m.reactions[user.id] === emoji
                                    ? 'border-violet-400 bg-violet-500/15'
                                    : 'border-ink/10 bg-surface-soft hover:bg-ink/5'
                                }`}
                              >
                                <span>{emoji}</span>
                                {count > 1 && <span className="text-[10px] text-ink-soft/60">{count}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        </div>
                      </motion.div>
                    </Fragment>
                  )
                })}
              </AnimatePresence>

              {typingId === active.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-ink/6 px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-ink-soft/40"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            <AnimatePresence>
              {showNewMessagesPill && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.9 }}
                  onClick={() => {
                    scrollToBottom('smooth')
                    setShowNewMessagesPill(false)
                  }}
                  className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-xs font-semibold text-ink-on-brand shadow-lg shadow-violet-500/30"
                >
                  Nouveaux messages
                  <ChevronDown size={14} strokeWidth={2.5} />
                </motion.button>
              )}
            </AnimatePresence>
            </div>


            {replyTarget && !editingMessageId && (
              <div className="flex min-w-0 max-w-full shrink-0 items-center justify-between gap-2 border-t border-ink/8 bg-ink/[0.03] px-4 py-2">
                <div className="min-w-0 max-w-full flex-1 border-l-2 border-violet-400 pl-2.5">
                  <p className="truncate text-xs font-semibold text-violet-600">
                    {replyTarget.fromMe ? 'Vous' : active.profile.firstName}
                  </p>
                  <p className="max-w-full truncate text-xs text-ink-soft/60">{messagePreviewText(replyTarget)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/10"
                  aria-label="Annuler la réponse"
                >
                  <X size={14} strokeWidth={2.25} />
                </button>
              </div>
            )}
            {editingMessageId && (
              <div className="flex shrink-0 items-center justify-between border-t border-ink/8 bg-violet-500/5 px-4 py-2">
                <span className="text-xs font-medium text-violet-600">Modification du message</span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/10"
                  aria-label="Annuler la modification"
                >
                  <X size={14} strokeWidth={2.25} />
                </button>
              </div>
            )}
            {isRecording ? (
              <div className={`flex shrink-0 items-center gap-3 p-3 ${editingMessageId ? '' : 'border-t border-ink/8'}`}>
                <button
                  type="button"
                  onClick={() => stopRecording(false)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-ink/5"
                  aria-label="Annuler l'enregistrement"
                >
                  <X size={18} strokeWidth={2.25} />
                </button>
                <div className="flex flex-1 items-center gap-2.5 rounded-full border border-coral-500/30 bg-coral-500/5 px-4 py-3.5">
                  <motion.span
                    className="h-2.5 w-2.5 rounded-full bg-coral-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                  />
                  <span className="text-sm font-medium text-ink">{formatDuration(recordingSeconds)}</span>
                  <span className="text-xs text-ink-soft/50">Enregistrement…</span>
                </div>
                <motion.button
                  type="button"
                  onClick={() => stopRecording(true)}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-lg shadow-violet-500/25"
                  aria-label="Envoyer la note vocale"
                >
                  <Send size={18} strokeWidth={2.25} />
                </motion.button>
              </div>
            ) : (
              <form
                onSubmit={handleSend}
                className={`flex shrink-0 items-end gap-2 p-3 ${editingMessageId ? '' : 'border-t border-ink/8'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  onChange={handleAttachmentSelect}
                  className="hidden"
                />
                {/* WhatsApp-style pill: emoji/attach/sticker sit inside the
                    input itself instead of as separate round buttons beside
                    it. The textarea provides the pill's own border/background;
                    the icon buttons are absolutely positioned on top of it. */}
                <div className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Écrivez un message…"
                    disabled={isSendingVoice}
                    className="max-h-[140px] min-h-[48px] w-full resize-none overflow-y-auto rounded-2xl border border-ink/12 bg-ink/[0.03] py-3.5 pl-11 pr-20 text-sm leading-normal text-ink placeholder-ink-soft/40 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15 disabled:opacity-60"
                  />

                  <div className="absolute bottom-1.5 left-1.5">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                        showEmojiPicker ? 'bg-violet-500/15 text-violet-600' : 'text-ink-soft/60 hover:bg-ink/10'
                      }`}
                      aria-label="Choisir un emoji"
                    >
                      <Smile size={19} strokeWidth={2} />
                    </button>
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowEmojiPicker(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.97 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full left-0 z-20 mb-2 max-w-[calc(100vw_-_2rem)]"
                          >
                            <EmojiPicker
                              onEmojiClick={handleEmojiClick}
                              theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                              searchDisabled={false}
                              skinTonesDisabled
                              width="min(320px, calc(100vw - 2rem))"
                              height="min(380px, 60vh)"
                            />
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                      onChange={handleAttachmentSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSendingAttachment || isSendingVoice || !!editingMessageId}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Joindre un fichier"
                    >
                      {isSendingAttachment ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-soft/30 border-t-ink-soft" />
                      ) : (
                        <Paperclip size={18} strokeWidth={2} />
                      )}
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowStickerPicker((v) => !v)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                          showStickerPicker ? 'bg-violet-500/15 text-violet-600' : 'text-ink-soft/60 hover:bg-ink/10'
                        }`}
                        aria-label="Choisir un sticker"
                      >
                        <Sticker size={18} strokeWidth={2} />
                      </button>
                      <AnimatePresence>
                        {showStickerPicker && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowStickerPicker(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.97 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full right-0 z-20 mb-2 grid w-[min(18rem,calc(100vw_-_2rem))] grid-cols-4 gap-1.5 rounded-2xl border border-ink/10 bg-white p-3 shadow-xl dark:bg-surface-tint"
                              style={{ maxHeight: 'min(320px, 50vh)', overflowY: 'auto' }}
                            >
                              {STICKERS.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleStickerClick(s.id)}
                                  className="flex items-center justify-center rounded-xl p-1 transition hover:bg-ink/5"
                                >
                                  <img src={s.src} alt="" className="h-14 w-14 object-contain" />
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
                {draft.trim() ? (
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.9 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-lg shadow-violet-500/25"
                    aria-label={editingMessageId ? 'Enregistrer' : 'Envoyer'}
                  >
                    <Send size={18} strokeWidth={2.25} />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={startRecording}
                    disabled={isSendingVoice || !!editingMessageId}
                    whileTap={{ scale: 0.9 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-ink-on-brand shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Enregistrer une note vocale"
                  >
                    {isSendingVoice ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-on-brand/30 border-t-ink-on-brand" />
                    ) : (
                      <Mic size={18} strokeWidth={2.25} />
                    )}
                  </motion.button>
                )}
              </form>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteMessageModal
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>

      {showReport && active && (
        <ReportModal
          firstName={active.profile.firstName}
          onClose={() => setShowReport(false)}
          onSubmit={handleReportUser}
          isSubmitting={isSubmittingSafety}
        />
      )}

      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      <AnimatePresence>
        {expandedProfile && (
          <ProfileDetailModal
            profile={expandedProfile}
            matchPercent={matchPercent(publicProfile?.interests, expandedProfile.interests)}
            onClose={() => setExpandedProfile(null)}
            onBlocked={handleProfileBlocked}
            matchId={active?.id || null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {infoMessage && active && (
          <MessageInfoModal
            message={infoMessage}
            otherName={active.profile.firstName}
            onClose={() => setInfoMessage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Chat
