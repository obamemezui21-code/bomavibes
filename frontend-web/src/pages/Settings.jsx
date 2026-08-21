import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ArrowLeft, Heart, Moon, ShieldOff, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { db } from '../firebase/config.js'
import { enablePushForUser } from '../firebase/push.js'
import { fetchMyBlockedIds, unblockUser } from '../firebase/safety.js'
import PasswordInput from '../components/PasswordInput.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import Modal from '../components/ui/Modal.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import Button from '../components/ui/Button.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-violet-500' : 'bg-ink/15'}`}
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

function BlockedUsersModal({ onClose }) {
  const { user } = useAuth()
  const { refreshBlockedIds } = useConversations()
  const { showToast } = useToast()
  const [profiles, setProfiles] = useState(null)
  const [unblockingId, setUnblockingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const ids = await fetchMyBlockedIds(user.id)
      const results = await Promise.all(
        ids.map(async (id) => {
          const snap = await getDoc(doc(db, 'profiles', id))
          return snap.exists() ? { id, ...snap.data() } : { id, firstName: 'Profil supprimé' }
        }),
      )
      if (!cancelled) setProfiles(results)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleUnblock(id) {
    setUnblockingId(id)
    try {
      await unblockUser(user.id, id)
      await refreshBlockedIds()
      setProfiles((prev) => prev.filter((p) => p.id !== id))
      showToast('Utilisateur débloqué.', 'success')
    } catch {
      showToast('Impossible de débloquer, réessayez.', 'error')
    } finally {
      setUnblockingId(null)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-ink">Utilisateurs bloqués</h2>
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {profiles === null && <p className="text-sm text-ink-soft/60">Chargement…</p>}
        {profiles?.length === 0 && <p className="text-sm text-ink-soft/60">Vous n'avez bloqué personne.</p>}
        {profiles?.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 px-3 py-2.5">
            <span className="text-sm font-medium text-ink">{p.firstName}</span>
            <button
              type="button"
              onClick={() => handleUnblock(p.id)}
              disabled={unblockingId === p.id}
              className="text-xs font-semibold text-violet-600 hover:underline disabled:opacity-50"
            >
              {unblockingId === p.id ? 'Déblocage…' : 'Débloquer'}
            </button>
          </div>
        ))}
      </div>
      <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
        Fermer
      </Button>
    </Modal>
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
      showToast('Vérifiez votre nouvelle adresse pour confirmer le changement.', 'success')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-ink">Modifier votre email</h2>
      <p className="mt-1 text-sm text-ink-soft/70">
        Un lien de confirmation sera envoyé à votre nouvelle adresse.
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
            placeholder="vous@exemple.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Mot de passe actuel</label>
          <PasswordInput
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Confirmez votre mot de passe"
          />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" className="flex-1" disabled={isSaving}>
            {isSaving ? 'Envoi…' : 'Confirmer'}
          </Button>
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
      <h2 className="font-display text-lg font-semibold text-ink">Modifier votre mot de passe</h2>
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
          <label className={labelClass}>Confirmez le nouveau mot de passe</label>
          <PasswordInput
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" className="flex-1" disabled={isSaving}>
            {isSaving ? 'Mise à jour…' : 'Confirmer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Settings() {
  const navigate = useNavigate()
  const { user, profile, logout, deleteAccount } = useAuth()
  const { showToast } = useToast()
  const { theme, toggleTheme } = useTheme()

  const [isTogglingPush, setIsTogglingPush] = useState(false)
  const newMatches = profile?.notifyMatches ?? true
  const newMessages = profile?.notifyMessages ?? true
  const newFeed = profile?.notifyFeed ?? true
  const [emailUpdates, setEmailUpdates] = useState(false)
  const [showDistance, setShowDistance] = useState(true)
  const [showAge, setShowAge] = useState(true)
  const [incognito, setIncognito] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showBlockedModal, setShowBlockedModal] = useState(false)

  async function handleNotifyToggle(field, value) {
    setIsTogglingPush(true)
    try {
      if (value && !profile?.fcmTokens?.length) {
        await enablePushForUser(user.id)
      }
      await updateDoc(doc(db, 'users', user.id), { [field]: value })
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsTogglingPush(false)
    }
  }

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
    <div className="min-h-svh bg-surface-soft p-6 pb-24 desktop:min-h-full desktop:pb-6">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-2xl font-semibold text-ink">Paramètres</h1>
        </div>

        <div className="space-y-4">
          <Section title="Apparence">
            <Row title="Thème sombre" subtitle={theme === 'dark' ? 'Activé' : 'Désactivé'}>
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon size={15} className="text-ink-soft/60" />
                ) : (
                  <Sun size={15} className="text-ink-soft/60" />
                )}
                <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
              </div>
            </Row>
          </Section>

          <Section title="Langue">
            <div className="px-1 py-3">
              <LanguageSwitcher />
            </div>
          </Section>

          <Section title="Notifications">
            <Row title="Nouveaux matchs" subtitle="Reçois une alerte à chaque match">
              <Toggle
                checked={newMatches}
                onChange={(v) => handleNotifyToggle('notifyMatches', v)}
                disabled={isTogglingPush}
              />
            </Row>
            <Row title="Nouveaux messages" subtitle="Reçois une alerte pour chaque message">
              <Toggle
                checked={newMessages}
                onChange={(v) => handleNotifyToggle('notifyMessages', v)}
                disabled={isTogglingPush}
              />
            </Row>
            <Row title="Activité du Feed" subtitle="J'aime, commentaires et réponses sur vos publications">
              <Toggle
                checked={newFeed}
                onChange={(v) => handleNotifyToggle('notifyFeed', v)}
                disabled={isTogglingPush}
              />
            </Row>
            <Row title="Résumé par email" subtitle="Un récapitulatif hebdomadaire">
              <Toggle checked={emailUpdates} onChange={setEmailUpdates} />
            </Row>
          </Section>

          <Section title="Confidentialité">
            <Row title="Afficher ma distance" subtitle="Visible sur votre profil public">
              <Toggle checked={showDistance} onChange={setShowDistance} />
            </Row>
            <Row title="Afficher mon âge" subtitle="Visible sur votre profil public">
              <Toggle checked={showAge} onChange={setShowAge} />
            </Row>
            <Row title="Mode incognito" subtitle="Découvre sans apparaître dans les decks des autres">
              <Toggle checked={incognito} onChange={setIncognito} />
            </Row>
            <Row title="Utilisateurs bloqués" subtitle="Gérer les profils que vous avez bloqués">
              <button
                type="button"
                onClick={() => setShowBlockedModal(true)}
                className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
              >
                <ShieldOff size={13} strokeWidth={2.25} />
                Gérer
              </button>
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

          <Section title="Le projet">
            <Row title="Soutenir BomaVibes" subtitle="Construisons BomaVibes ensemble">
              <button
                type="button"
                onClick={() => navigate('/soutenir')}
                className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
              >
                <Heart size={13} strokeWidth={2.25} />
                Découvrir
              </button>
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
      {showBlockedModal && <BlockedUsersModal onClose={() => setShowBlockedModal(false)} />}

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer votre compte ?"
          description="Toutes vos données, matchs et conversations seront définitivement perdus."
          confirmLabel="Supprimer"
          confirmingLabel="Suppression…"
          isConfirming={isDeleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  )
}

export default Settings
