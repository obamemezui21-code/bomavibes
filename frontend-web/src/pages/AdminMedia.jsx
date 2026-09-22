import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Image as ImageIcon, Search, Trash2, Upload } from 'lucide-react'
import { deleteCmsMedia, fetchCmsMedia, uploadCmsMedia } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import { formatFileSize } from '../firebase/chatAttachments.js'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'

const MAX_FILE_BYTES = 10 * 1024 * 1024

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AdminMedia() {
  const { showToast } = useToast()
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [deletingFile, setDeletingFile] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchCmsMedia()
      .then((data) => setFiles(data.files))
      .catch(() => showToast('Impossible de charger la médiathèque.', 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  async function handleFileChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.size > MAX_FILE_BYTES) {
      showToast('Fichier trop volumineux (10 Mo maximum).', 'error')
      return
    }
    setIsUploading(true)
    try {
      const { file } = await uploadCmsMedia(picked)
      setFiles((prev) => [file, ...prev])
      showToast('Image envoyée.', 'success')
    } catch (err) {
      showToast(err.message || "Impossible d'envoyer cette image.", 'error')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete() {
    if (!deletingFile) return
    setIsDeleting(true)
    try {
      await deleteCmsMedia(deletingFile.name)
      setFiles((prev) => prev.filter((f) => f.name !== deletingFile.name))
      showToast('Fichier supprimé.', 'success')
      setDeletingFile(null)
    } catch {
      showToast('Impossible de supprimer ce fichier.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  function copyUrl(url) {
    navigator.clipboard?.writeText(url).then(
      () => showToast('URL copiée.', 'success'),
      () => showToast('Impossible de copier.', 'error'),
    )
  }

  const filtered = search.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()))
    : files

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
            <ImageIcon size={20} strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Médiathèque</h1>
            <p className="text-xs text-ink-soft/60">Images utilisées dans Pages, Articles, FAQ et Bannières</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition disabled:opacity-50"
        >
          {isUploading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Upload size={16} strokeWidth={2.25} />
          )}
          {isUploading ? 'Envoi…' : 'Téléverser'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>

      <div className="relative mb-4">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un fichier"
          className="w-full rounded-xl border border-ink/12 bg-ink/[0.04] py-2.5 pl-9 pr-3.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
        />
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft/50">Aucune image dans la médiathèque.</p>
      )}

      <div className="grid grid-cols-2 gap-3 desktop:grid-cols-3">
        {filtered.map((file) => (
          <div key={file.name} className="glass-panel overflow-hidden rounded-2xl">
            <img src={file.thumbUrl} alt="" className="h-32 w-full object-cover" loading="lazy" />
            <div className="p-3">
              <p className="truncate text-xs font-semibold text-ink">{file.name}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft/50">
                {formatFileSize(file.size)} · {formatDate(file.uploadedAt)}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => copyUrl(file.url)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-full bg-ink/6 py-1.5 text-[11px] font-semibold text-ink-soft/70 transition hover:bg-ink/10"
                >
                  <Copy size={12} strokeWidth={2.25} />
                  Copier l'URL
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingFile(file)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-coral-500 transition hover:bg-coral-500/10"
                  aria-label="Supprimer"
                >
                  <Trash2 size={13} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {deletingFile && (
        <ConfirmModal
          title="Supprimer ce fichier ?"
          description="Si cette image est encore utilisée dans un contenu publié, elle n'y apparaîtra plus."
          confirmLabel="Supprimer"
          confirmingLabel="Suppression…"
          isConfirming={isDeleting}
          onCancel={() => setDeletingFile(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

export default AdminMedia
