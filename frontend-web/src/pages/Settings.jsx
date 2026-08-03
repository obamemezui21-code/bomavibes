import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import PasswordInput from '../components/PasswordInput.jsx'

const inputClass =
  'w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15'
const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-violet-500' : 'bg-ink/15'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function Row({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-ink-soft/60">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-violet-600">{title}</p>
      <div className="divide-y divide-ink/6">{children}</div>
    </div>
  )
}

function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-sm rounded-2xl p-6"
      >
        {children}
      </div>
    </div>
  )
}

function ChangeEmailModal({ onClose }) {
  const { changeEmail } = useAuth()
  const { showToast } = useToast()
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await changeEmail(newEmail, currentPassword)
      showToast('Vérifie ta nouvelle adresse pour confirmer le changement.', 'success')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-ink">Modifier ton email</h2>
      <p className="mt-1 text-sm text-ink-soft/70">
        Un lien de confirmation sera envoyé à ta nouvelle adresse.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-400">
            {error}
          </div>
        )}
        <div>
          <label className={labelClass}>Nouvel email</label>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="toi@exemple.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Mot de passe actuel</label>
          <PasswordInput
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Confirme ton mot de passe"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Envoi…' : 'Confirmer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth()
  const { showToast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setIsSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast('Mot de passe mis à jour avec succès.', 'success')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-ink">Modifier ton mot de passe</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-400">
            {error}
          </div>
        )}
        <div>
          <label className={labelClass}>Mot de passe actuel</label>
          <PasswordInput
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className={labelClass}>Nouveau mot de passe</label>
          <PasswordInput
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8 caractères minimum"
          />
        </div>
        <div>
          <label className={labelClass}>Confirme le nouveau mot de passe</label>
          <PasswordInput
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Mise à jour…' : 'Confirmer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Settings() {
  const navigate = useNavigate()
  const { user, logout, deleteAccount } = useAuth()
  const { showToast } = useToast()

  const [newMatches, setNewMatches] = useState(true)
  const [newMessages, setNewMessages] = useState(true)
  const [emailUpdates, setEmailUpdates] = useState(false)
  const [showDistance, setShowDistance] = useState(true)
  const [showAge, setShowAge] = useState(true)
  const [incognito, setIncognito] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  async function handleDeleteAccount() {
    setIsDeleting(true)
    try {
      await deleteAccount()
      setConfirmDelete(false)
      showToast('Compte supprimé. À bientôt sur BomaVibes 💔', 'info')
      navigate('/')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-svh bg-surface-soft p-6 pb-24 md:min-h-full md:pb-6">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
            aria-label="Retour"
          >
            ←
          </button>
          <h1 className="font-display text-2xl font-semibold text-ink">Paramètres</h1>
        </div>

        <div className="space-y-4">
          <Section title="Notifications">
            <Row title="Nouveaux matchs" subtitle="Reçois une alerte à chaque match">
              <Toggle checked={newMatches} onChange={setNewMatches} />
            </Row>
            <Row title="Nouveaux messages" subtitle="Reçois une alerte pour chaque message">
              <Toggle checked={newMessages} onChange={setNewMessages} />
            </Row>
            <Row title="Résumé par email" subtitle="Un récapitulatif hebdomadaire">
              <Toggle checked={emailUpdates} onChange={setEmailUpdates} />
            </Row>
          </Section>

          <Section title="Confidentialité">
            <Row title="Afficher ma distance" subtitle="Visible sur ton profil public">
              <Toggle checked={showDistance} onChange={setShowDistance} />
            </Row>
            <Row title="Afficher mon âge" subtitle="Visible sur ton profil public">
              <Toggle checked={showAge} onChange={setShowAge} />
            </Row>
            <Row title="Mode incognito" subtitle="Découvre sans apparaître dans les decks des autres">
              <Toggle checked={incognito} onChange={setIncognito} />
            </Row>
          </Section>

          <Section title="Compte">
            <Row title="Email" subtitle={user?.email}>
              {user?.hasPassword ? (
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  className="text-xs font-semibold text-violet-600 hover:underline"
                >
                  Modifier
                </button>
              ) : (
                <span className="text-xs text-ink-soft/50">Géré par Google</span>
              )}
            </Row>
            <Row title="Mot de passe" subtitle={user?.hasPassword ? '••••••••' : 'Aucun (compte Google)'}>
              {user?.hasPassword ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="text-xs font-semibold text-violet-600 hover:underline"
                >
                  Modifier
                </button>
              ) : (
                <span className="text-xs text-ink-soft/50">Géré par Google</span>
              )}
            </Row>
          </Section>

          <Section title="Zone de danger">
            <Row title="Supprimer mon compte" subtitle="Cette action est irréversible">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-semibold text-coral-500 hover:underline"
              >
                Supprimer
              </button>
            </Row>
          </Section>

          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="w-full rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink-soft/70 transition hover:bg-ink/5"
          >
            Déconnexion
          </button>
        </div>
      </div>

      {showEmailModal && <ChangeEmailModal onClose={() => setShowEmailModal(false)} />}
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)}>
          <div className="text-center">
            <TriangleAlert size={32} strokeWidth={1.5} className="mx-auto text-coral-500" />
            <h2 className="mt-2 font-display text-lg font-semibold text-ink">Supprimer ton compte ?</h2>
            <p className="mt-1 text-sm text-ink-soft/70">
              Toutes tes données, matchs et conversations seront définitivement perdus.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-coral-500 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Settings
