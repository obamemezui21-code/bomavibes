import { useEffect, useRef, useState } from 'react'
import { Settings as SettingsIcon, Upload } from 'lucide-react'
import { fetchAdminSettings, updateAdminSettings, uploadCmsMedia } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import Button from '../components/ui/Button.jsx'

function ImageField({ label, value, onChange, onUpload, isUploading }) {
  const inputRef = useRef(null)
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-ink/10 object-contain" />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-lg bg-ink/6" />
        )}
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder="URL" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink/6 text-ink-soft/70 transition hover:bg-ink/10 disabled:opacity-50"
          aria-label={`Téléverser — ${label}`}
        >
          <Upload size={15} strokeWidth={2.25} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onUpload(file)
          }}
        />
      </div>
    </div>
  )
}

function AdminSettings() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState(null)
  const [confirmMaintenance, setConfirmMaintenance] = useState(null) // true/false pending confirmation

  useEffect(() => {
    fetchAdminSettings()
      .then((data) => setSettings(data.settings))
      .catch(() => showToast('Impossible de charger les paramètres.', 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  function setField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleUpload(field, file) {
    setUploadingField(field)
    try {
      const { file: uploaded } = await uploadCmsMedia(file)
      setField(field, uploaded.url)
      showToast('Image envoyée.', 'success')
    } catch (err) {
      showToast(err.message || "Impossible d'envoyer cette image.", 'error')
    } finally {
      setUploadingField(null)
    }
  }

  async function persist(payload) {
    setIsSaving(true)
    try {
      const { settings: updated } = await updateAdminSettings(payload)
      setSettings(updated)
      showToast('Paramètres enregistrés.', 'success')
    } catch (err) {
      showToast(err.message || 'Impossible d’enregistrer.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    // maintenanceMode is saved separately via its own confirm step below,
    // not by this form's Enregistrer button.
    const rest = { ...settings }
    delete rest.maintenanceMode
    persist(rest)
  }

  function handleToggleMaintenance() {
    setConfirmMaintenance(!settings.maintenanceMode)
  }

  async function handleConfirmMaintenance() {
    await persist({ maintenanceMode: confirmMaintenance })
    setConfirmMaintenance(null)
  }

  if (isLoading || !settings) {
    return <p className="py-16 text-center text-sm text-ink-soft/50">Chargement…</p>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 desktop:py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25">
          <SettingsIcon size={20} strokeWidth={2} />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Paramètres</h1>
          <p className="text-xs text-ink-soft/60">Configuration générale — aucune clé secrète n'apparaît ici</p>
        </div>
      </div>

      <div className="glass-panel mb-4 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Mode maintenance</p>
            <p className="text-xs text-ink-soft/60">
              {settings.maintenanceMode
                ? "Actif — l'application est bloquée pour tout le monde sauf les administrateurs."
                : "Inactif — l'application est accessible normalement."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleMaintenance}
            disabled={isSaving}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
              settings.maintenanceMode ? 'bg-coral-500' : 'bg-ink/15'
            }`}
            aria-label="Basculer le mode maintenance"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                settings.maintenanceMode ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel space-y-3 rounded-2xl p-4">
        <div>
          <label className={labelClass} htmlFor="appName">
            Nom de l'application
          </label>
          <input id="appName" type="text" value={settings.appName} onChange={(e) => setField('appName', e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="supportEmail">
              Email support
            </label>
            <input
              id="supportEmail"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setField('supportEmail', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="supportPhone">
              Téléphone support
            </label>
            <input
              id="supportPhone"
              type="text"
              value={settings.supportPhone}
              onChange={(e) => setField('supportPhone', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <ImageField
          label="Logo"
          value={settings.logoUrl}
          onChange={(v) => setField('logoUrl', v)}
          onUpload={(file) => handleUpload('logoUrl', file)}
          isUploading={uploadingField === 'logoUrl'}
        />
        <ImageField
          label="Favicon"
          value={settings.faviconUrl}
          onChange={(v) => setField('faviconUrl', v)}
          onUpload={(file) => handleUpload('faviconUrl', file)}
          isUploading={uploadingField === 'faviconUrl'}
        />

        <div>
          <label className={labelClass} htmlFor="minAge">
            Âge minimum
          </label>
          <input
            id="minAge"
            type="number"
            min="18"
            value={settings.minAge}
            onChange={(e) => setField('minAge', Number(e.target.value) || 18)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ink-soft/50">
            Informatif — l'inscription est déjà bloquée sous 18 ans dans les règles Firestore, quelle que soit cette
            valeur. La changer ici ne modifie pas cette limite technique.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="generalNotes">
            Notes générales
          </label>
          <textarea
            id="generalNotes"
            rows={3}
            value={settings.generalNotes}
            onChange={(e) => setField('generalNotes', e.target.value)}
            className={inputClass}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSaving}>
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>

      {confirmMaintenance !== null && (
        <ConfirmModal
          title={confirmMaintenance ? 'Activer le mode maintenance ?' : 'Désactiver le mode maintenance ?'}
          description={
            confirmMaintenance
              ? 'Tous les visiteurs et utilisateurs (sauf les administrateurs) verront une page de maintenance à la place de l’application, immédiatement.'
              : "L'application redevient accessible à tout le monde immédiatement."
          }
          confirmLabel={confirmMaintenance ? 'Activer' : 'Désactiver'}
          confirmingLabel="Un instant…"
          danger={!!confirmMaintenance}
          isConfirming={isSaving}
          onCancel={() => setConfirmMaintenance(null)}
          onConfirm={handleConfirmMaintenance}
        />
      )}
    </div>
  )
}

export default AdminSettings
