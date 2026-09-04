import { useEffect, useRef, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { Music, Pause, Play, Trash2, Upload } from 'lucide-react'
import { db } from '../firebase/config.js'
import { deleteMusicFile, uploadMusicFile } from '../firebase/music.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { formatFileSize } from '../firebase/chatAttachments.js'

const MAX_TRACK_BYTES = 30 * 1024 * 1024

function AdminMusic() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [tracks, setTracks] = useState([])
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [nowPlaying, setNowPlaying] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const q = query(collection(db, 'musicTracks'), orderBy('uploadedAt', 'desc'))
    return onSnapshot(q, (snap) => setTracks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (picked.size > MAX_TRACK_BYTES) {
      showToast('Fichier trop volumineux (30 Mo maximum).', 'error')
      e.target.value = ''
      return
    }
    setFile(picked)
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ''))
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file || !title.trim()) return
    setIsUploading(true)
    try {
      const uploaded = await uploadMusicFile(file)
      await addDoc(collection(db, 'musicTracks'), {
        title: title.trim(),
        url: uploaded.url,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        uploadedBy: user.id,
        uploadedAt: serverTimestamp(),
      })
      setTitle('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      showToast('Piste ajoutée.', 'success')
    } catch {
      showToast("Impossible d'envoyer la piste, réessayez.", 'error')
    } finally {
      setIsUploading(false)
    }
  }

  function togglePlay(track) {
    const audio = audioRef.current
    if (!audio) return
    if (nowPlaying?.id === track.id) {
      if (isPlaying) audio.pause()
      else audio.play()
      return
    }
    setNowPlaying(track)
    audio.src = track.url
    audio.play()
  }

  async function handleDelete(track) {
    setDeletingId(track.id)
    try {
      if (nowPlaying?.id === track.id) {
        audioRef.current?.pause()
        setNowPlaying(null)
      }
      await deleteDoc(doc(db, 'musicTracks', track.id))
      await deleteMusicFile(track.url)
    } catch {
      showToast('Impossible de supprimer cette piste, réessayez.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 desktop:py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
          <Music size={20} strokeWidth={2} />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Musique</h1>
          <p className="text-xs text-ink-soft/60">Module admin — téléversement et lecture</p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="glass-panel space-y-3 rounded-2xl p-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la piste"
          className="w-full rounded-xl border border-ink/12 bg-ink/[0.04] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="w-full text-sm text-ink-soft/70 file:mr-3 file:rounded-full file:border-0 file:bg-ink/8 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-ink"
        />
        <button
          type="submit"
          disabled={!file || !title.trim() || isUploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-md shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Upload size={16} strokeWidth={2.25} />
          )}
          {isUploading ? 'Envoi…' : 'Téléverser'}
        </button>
      </form>

      <audio
        ref={audioRef}
        controls
        className={`mt-4 w-full ${nowPlaying ? '' : 'hidden'}`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      {nowPlaying && (
        <p className="mt-1.5 truncate text-xs text-ink-soft/60">Lecture : {nowPlaying.title}</p>
      )}

      <div className="mt-6 space-y-2">
        {tracks.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-soft/50">Aucune piste téléversée pour le moment.</p>
        )}
        {tracks.map((track) => {
          const isActive = nowPlaying?.id === track.id
          return (
            <div
              key={track.id}
              className={`flex items-center gap-3 rounded-2xl border bg-white p-3 dark:bg-surface-tint ${
                isActive ? 'border-violet-400/60 ring-2 ring-violet-400/20' : 'border-ink/8'
              }`}
            >
              <button
                type="button"
                onClick={() => togglePlay(track)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600"
                aria-label={isActive && isPlaying ? 'Pause' : 'Lecture'}
              >
                {isActive && isPlaying ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{track.title}</p>
                <p className="truncate text-xs text-ink-soft/50">{formatFileSize(track.fileSize)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(track)}
                disabled={deletingId === track.id}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-coral-500 transition hover:bg-coral-500/10 disabled:opacity-50"
                aria-label="Supprimer"
              >
                {deletingId === track.id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-coral-500/30 border-t-coral-500" />
                ) : (
                  <Trash2 size={16} strokeWidth={2.25} />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AdminMusic
