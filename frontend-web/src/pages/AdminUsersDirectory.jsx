import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ShieldAlert, Trash2, UserCheck, UserX, X } from 'lucide-react'
import {
  deleteDirectoryUser,
  fetchUserDirectory,
  fetchUserDirectoryDetail,
  setAdminUserBanned,
} from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import Modal from '../components/ui/Modal.jsx'
import Button from '../components/ui/Button.jsx'

const FILTER_TABS = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'verified', label: 'Vérifiés' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'deleted', label: 'Supprimés' },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadges({ user }) {
  if (user.deleted) return <span className="rounded-full bg-ink/8 px-2.5 py-1 text-[10px] font-bold text-ink-soft/60">Supprimé</span>
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {user.banned && <span className="rounded-full bg-coral-500/15 px-2.5 py-1 text-[10px] font-bold text-coral-600">Suspendu</span>}
      {user.verified && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-bold text-sky-600">Vérifié</span>}
      {user.isActive && <span className="rounded-full bg-mint-500/15 px-2.5 py-1 text-[10px] font-bold text-mint-600">Actif</span>}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/6 py-2 text-sm last:border-0">
      <span className="text-ink-soft/50">{label}</span>
      <span className="truncate text-right font-medium text-ink">{value}</span>
    </div>
  )
}

function AdminUsersDirectory() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUid, setSelectedUid] = useState(null)
  const [detail, setDetail] = useState(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [updatingUid, setUpdatingUid] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchUserDirectory(filter, search)
      .then((data) => setUsers(data.users))
      .catch(() => showToast('Impossible de charger les utilisateurs.', 'error'))
      .finally(() => setIsLoading(false))
  }, [filter, search, showToast])

  useEffect(() => {
    const timeout = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timeout)
  }, [load, search])

  useEffect(() => {
    if (!selectedUid) {
      setDetail(null)
      return
    }
    setIsDetailLoading(true)
    fetchUserDirectoryDetail(selectedUid)
      .then((data) => setDetail(data.user))
      .catch(() => showToast('Impossible de charger cette fiche.', 'error'))
      .finally(() => setIsDetailLoading(false))
  }, [selectedUid, showToast])

  const emptyMessage = useMemo(() => {
    if (search) return 'Aucun utilisateur ne correspond à cette recherche.'
    return 'Aucun utilisateur dans cette catégorie.'
  }, [search])

  async function handleToggleBan(user) {
    setUpdatingUid(user.uid)
    try {
      await setAdminUserBanned(user.uid, !user.banned)
      showToast(!user.banned ? 'Utilisateur suspendu.' : 'Utilisateur réactivé.', 'success')
      setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, banned: !u.banned } : u)))
      setDetail((prev) => (prev?.uid === user.uid ? { ...prev, banned: !prev.banned } : prev))
    } catch {
      showToast('Impossible de mettre à jour ce compte.', 'error')
    } finally {
      setUpdatingUid(null)
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return
    setIsDeleting(true)
    try {
      await deleteDirectoryUser(confirmDelete.uid)
      showToast('Compte supprimé.', 'success')
      setUsers((prev) => prev.filter((u) => u.uid !== confirmDelete.uid))
      setConfirmDelete(null)
      setSelectedUid(null)
    } catch (err) {
      showToast(err.message || 'Impossible de supprimer ce compte.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">Utilisateurs</h2>

      <div className="relative mb-4">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par email ou prénom"
          className="w-full rounded-xl border border-ink/12 bg-ink/[0.04] py-2.5 pl-9 pr-3.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
        />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === tab.value ? 'bg-ink text-surface' : 'bg-ink/6 text-ink-soft/60 hover:bg-ink/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}
      {!isLoading && users.length === 0 && <p className="py-8 text-center text-sm text-ink-soft/50">{emptyMessage}</p>}

      <div className="space-y-2">
        {users.map((user) => (
          <button
            key={user.uid}
            type="button"
            onClick={() => setSelectedUid(user.uid)}
            className="glass-panel flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:bg-ink/[0.03]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user.firstName || 'Sans nom'}</p>
              <p className="truncate text-xs text-ink-soft/50">{user.email || user.uid}</p>
            </div>
            <StatusBadges user={user} />
          </button>
        ))}
      </div>

      {selectedUid && (
        <Modal onClose={() => setSelectedUid(null)} className="max-w-md text-left">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">Fiche utilisateur</h2>
            <button type="button" onClick={() => setSelectedUid(null)} className="text-ink-soft/50 hover:text-ink" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>

          {isDetailLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}

          {!isDetailLoading && detail && (
            <>
              <div className="rounded-xl bg-ink/[0.03] px-3.5 py-1">
                <DetailRow label="Nom" value={detail.firstName || 'Sans nom'} />
                <DetailRow label="Email" value={detail.email || '—'} />
                <DetailRow label="UID" value={<span className="font-mono text-xs">{detail.uid}</span>} />
                <DetailRow label="Inscrit le" value={formatDate(detail.createdAt)} />
                <DetailRow label="Email vérifié" value={detail.emailVerified ? 'Oui' : 'Non'} />
                <DetailRow label="Profil complété" value={detail.onboarded ? 'Oui' : 'Non'} />
                <DetailRow label="Profil vérifié" value={detail.verified ? 'Oui' : 'Non'} />
                <DetailRow label="Dernière activité" value={formatDateTime(detail.lastActive)} />
                <DetailRow label="Matchs" value={detail.matchesCount} />
                <DetailRow label="Signalements reçus" value={detail.reportsCount} />
                {detail.deleted && <DetailRow label="Supprimé le" value={formatDateTime(detail.deletedAt)} />}
              </div>

              {!detail.deleted && (
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex flex-1 items-center justify-center gap-1.5"
                    onClick={() => handleToggleBan(detail)}
                    disabled={updatingUid === detail.uid}
                  >
                    {detail.banned ? <UserCheck size={15} /> : <UserX size={15} />}
                    {detail.banned ? 'Réactiver' : 'Suspendre'}
                  </Button>
                  <Button
                    variant="danger"
                    className="flex flex-1 items-center justify-center gap-1.5"
                    onClick={() => setConfirmDelete(detail)}
                  >
                    <Trash2 size={15} />
                    Supprimer
                  </Button>
                </div>
              )}
              {detail.reportsCount > 0 && !detail.deleted && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
                  <ShieldAlert size={13} strokeWidth={2.25} />
                  Voir aussi l'onglet Signalements pour traiter les plaintes le concernant.
                </p>
              )}
            </>
          )}
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer ce compte ?"
          description={`${confirmDelete.email || confirmDelete.uid} et toutes ses données (profil, matchs, messages) seront définitivement supprimés. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          confirmingLabel="Suppression…"
          isConfirming={isDeleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default AdminUsersDirectory
