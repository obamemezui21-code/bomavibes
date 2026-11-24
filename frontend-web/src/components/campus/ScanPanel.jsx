import { useEffect, useRef, useState } from 'react'
import { Camera, ExternalLink, FileUp, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { addScan, fetchScan, removeScan } from '../../firebase/campus.js'
import { compressImage } from '../../lib/compressImage.js'
import { useToast } from '../../context/ToastContext.jsx'
import ConfirmModal from '../ui/ConfirmModal.jsx'
import Spinner from '../ui/Spinner.jsx'
import { Btn, Empty } from './campusUi.jsx'

// The paper sheet, photographed or scanned, kept beside the entry. It is only
// shown: nothing is read from it automatically.

function Viewer({ sessionId, scan }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [turn, setTurn] = useState(0)

  useEffect(() => {
    let live = true
    let made = null
    fetchScan(sessionId, scan.id)
      .then((blob) => {
        if (!live) return
        made = URL.createObjectURL(blob)
        setUrl(made)
      })
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [sessionId, scan.id])

  if (error) return <p className="p-6 text-center text-sm text-coral-500">{error}</p>
  if (!url) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    )
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 pb-2">
        {scan.kind === 'jpg' && (
          <>
            <Btn variant="ghost" icon={ZoomOut} aria-label="Réduire" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} />
            <span className="w-12 text-center text-xs tabular-nums text-ink-soft">{Math.round(zoom * 100)} %</span>
            <Btn variant="ghost" icon={ZoomIn} aria-label="Agrandir" disabled={zoom >= 4} onClick={() => setZoom((z) => Math.min(4, z + 0.5))} />
            <Btn variant="ghost" icon={RotateCw} aria-label="Tourner" onClick={() => setTurn((t) => (t + 90) % 360)} />
          </>
        )}
        <a href={url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 px-2 text-xs font-semibold text-violet-600">
          <ExternalLink size={14} /> Ouvrir en grand
        </a>
      </div>
      <div className="max-h-[42svh] overflow-auto rounded-xl border border-ink/10 bg-ink/5 lg:max-h-[calc(100svh-22rem)]">
        {scan.kind === 'pdf' ? (
          <iframe title={scan.name} src={url} className="h-[60svh] w-full" />
        ) : (
          <img src={url} alt={`Feuille papier : ${scan.name}`} style={{ width: `${zoom * 100}%`, maxWidth: 'none', transform: `rotate(${turn}deg)` }} className="block" />
        )}
      </div>
    </div>
  )
}

function ScanPanel({ session, canEdit, onChanged }) {
  const { showToast } = useToast()
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState(null)
  const [removing, setRemoving] = useState(null)
  const scans = session.scans
  const shown = scans.find((s) => s.id === current) || scans.at(-1)

  async function send(files) {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of files) {
        // Phone photos are several MB: lighter on a mobile connection.
        const scan = await addScan(session.id, file.type.startsWith('image/') ? await compressImage(file) : file)
        setCurrent(scan.id)
      }
      showToast('Feuille papier ajoutée.', 'success')
      await onChanged()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
      for (const ref of [fileRef, cameraRef]) if (ref.current) ref.current.value = ''
    }
  }

  async function remove() {
    const scan = removing
    setBusy(true)
    try {
      await removeScan(session.id, scan.id)
      await onChanged()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Btn icon={Camera} busy={busy} onClick={() => cameraRef.current?.click()}>
            Photographier
          </Btn>
          <Btn icon={FileUp} busy={busy} onClick={() => fileRef.current?.click()}>
            Importer (image, PDF)
          </Btn>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => send(e.target.files)} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => send(e.target.files)} />
        </div>
      )}
      {scans.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {scans.map((s, i) => (
            <button key={s.id} type="button" aria-pressed={shown?.id === s.id} onClick={() => setCurrent(s.id)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${shown?.id === s.id ? 'bg-violet-950 text-white dark:bg-violet-600' : 'bg-ink/8 text-ink-soft'}`}>
              Feuille {i + 1}
            </button>
          ))}
          {canEdit && shown && (
            <button type="button" onClick={() => setRemoving(shown)} aria-label="Retirer cette image" className="rounded-lg px-2 py-1 text-ink-soft hover:bg-coral-500/10 hover:text-coral-500">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      {shown ? <Viewer key={shown.id} sessionId={session.id} scan={shown} /> : <Empty>Aucune feuille papier importée.</Empty>}
      <p className="mt-2 text-xs text-ink-soft">La feuille sert de modèle à la saisie : aucun statut n’en est tiré automatiquement.</p>
      {removing && <ConfirmModal title="Retirer cette image ?" description="Le retrait est noté dans l’historique de la séance." confirmLabel="Retirer" isConfirming={busy} onCancel={() => setRemoving(null)} onConfirm={remove} />}
    </div>
  )
}

export default ScanPanel
