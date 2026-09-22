import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, UserCheck, UserX } from 'lucide-react'
import { fetchAdminUsers, setAdminUserBanned, updateAdminUserRole } from '../firebase/admin.js'
import { useToast } from '../context/ToastContext.jsx'
import { ROLES } from '../lib/roles.js'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'

const ROLE_BADGES = {
  [ROLES.SUPER_ADMIN]: 'bg-gradient-to-r from-violet-500 to-pink-500 text-white',
  [ROLES.ADMIN]: 'bg-sky-500/15 text-sky-600',
  [ROLES.MODERATOR]: 'bg-amber-500/15 text-amber-600',
  [ROLES.EDITOR]: 'bg-mint-500/15 text-mint-600',
  [ROLES.USER]: 'bg-ink/8 text-ink-soft/60',
}

const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MODERATOR]: 'Modérateur',
  [ROLES.EDITOR]: 'Éditeur',
  [ROLES.USER]: 'Utilisateur',
}

// Every role a Super Admin can hand out from this page — SUPER_ADMIN itself
// is deliberately absent, see scripts/setAdmin.js.
const ASSIGNABLE_ROLES = [ROLES.USER, ROLES.MODERATOR, ROLES.EDITOR, ROLES.ADMIN]

function AdminUsers() {
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingUid, setUpdatingUid] = useState(null)
  const [confirmBan, setConfirmBan] = useState(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchAdminUsers()
      .then((data) => setUsers(data.users))
      .catch(() => showToast('Impossible de charger les utilisateurs.', 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.email?.toLowerCase().includes(q) || u.firstName?.toLowerCase().includes(q))
  }, [users, search])

  async function handleRoleChange(user, role) {
    setUpdatingUid(user.uid)
    try {
      await updateAdminUserRole(user.uid, role)
      showToast('Rôle mis à jour.', 'success')
      setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, role } : u)))
    } catch {
      showToast('Impossible de mettre à jour ce rôle.', 'error')
    } finally {
      setUpdatingUid(null)
    }
  }

  async function handleConfirmBan() {
    if (!confirmBan) return
    const { user, banned } = confirmBan
    setIsConfirming(true)
    try {
      await setAdminUserBanned(user.uid, banned)
      showToast(banned ? 'Utilisateur banni.' : 'Utilisateur réactivé.', 'success')
      setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, banned } : u)))
      setConfirmBan(null)
    } catch {
      showToast('Impossible de mettre à jour ce compte.', 'error')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Administrateurs</h2>
      <p className="mb-4 text-xs text-ink-soft/60">
        Attribuer les rôles Admin, Modérateur et Éditeur. Réservé au Super Admin — le rôle Super Admin lui-même ne se
        change pas ici.
      </p>

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

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft/50">Aucun utilisateur trouvé.</p>
      )}

      <div className="space-y-2">
        {filtered.map((user) => {
          const role = user.role || ROLES.USER
          const isProtected = role === ROLES.SUPER_ADMIN
          return (
            <div key={user.uid} className="glass-panel flex items-center gap-3 rounded-2xl p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{user.firstName || 'Sans nom'}</p>
                <p className="truncate text-xs text-ink-soft/50">{user.email || user.uid}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${ROLE_BADGES[role]}`}>
                {ROLE_LABELS[role] || role}
              </span>
              {user.banned && (
                <span className="shrink-0 rounded-full bg-coral-500/15 px-2.5 py-1 text-[10px] font-bold text-coral-600">
                  Banni
                </span>
              )}
              {role === ROLES.USER && (
                <button
                  type="button"
                  onClick={() => setConfirmBan({ user, banned: !user.banned })}
                  disabled={updatingUid === user.uid}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    user.banned
                      ? 'bg-ink/6 text-ink-soft/70 hover:bg-ink/10'
                      : 'bg-coral-500/10 text-coral-600 hover:bg-coral-500/20'
                  }`}
                >
                  {user.banned ? (
                    <>
                      <UserCheck size={13} strokeWidth={2.25} />
                      Débannir
                    </>
                  ) : (
                    <>
                      <UserX size={13} strokeWidth={2.25} />
                      Bannir
                    </>
                  )}
                </button>
              )}
              {!isProtected && (
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(user, e.target.value)}
                  disabled={updatingUid === user.uid}
                  className="shrink-0 rounded-full border border-ink/12 bg-ink/[0.04] px-3 py-1.5 text-xs font-semibold text-ink outline-none transition focus:border-violet-400 disabled:opacity-50"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        })}
      </div>

      {confirmBan && (
        <ConfirmModal
          title={confirmBan.banned ? 'Bannir cet utilisateur ?' : 'Réactiver cet utilisateur ?'}
          description={
            confirmBan.banned
              ? `${confirmBan.user.email || confirmBan.user.uid} ne pourra plus se connecter à BomaVibes.`
              : `${confirmBan.user.email || confirmBan.user.uid} pourra de nouveau se connecter.`
          }
          confirmLabel={confirmBan.banned ? 'Bannir' : 'Réactiver'}
          confirmingLabel="Un instant…"
          danger={confirmBan.banned}
          isConfirming={isConfirming}
          onCancel={() => setConfirmBan(null)}
          onConfirm={handleConfirmBan}
        />
      )}
    </div>
  )
}

export default AdminUsers
