import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, FileText, HelpCircle, Image as ImageIcon, LayoutDashboard, Music, Newspaper, ShieldAlert, Users, UsersRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLES, hasContentAccess, hasFullAdminAccess, hasModerationAccess, isSuperAdmin } from '../lib/roles.js'

const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MODERATOR]: 'Modérateur',
  [ROLES.EDITOR]: 'Éditeur',
}

function buildTabs(role) {
  const tabs = []
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard, end: true })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/directory', label: 'Utilisateurs', icon: UsersRound })
  if (hasModerationAccess(role)) tabs.push({ to: '/admin/reports', label: 'Signalements', icon: ShieldAlert })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/music', label: 'Musique', icon: Music })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/pages', label: 'Pages', icon: FileText })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/articles', label: 'Articles', icon: Newspaper })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/faqs', label: 'FAQ', icon: HelpCircle })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/banners', label: 'Bannières', icon: ImageIcon })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/logs', label: "Journal d'activité", icon: ClipboardList })
  if (isSuperAdmin(role)) tabs.push({ to: '/admin/users', label: 'Administrateurs', icon: Users })
  return tabs
}

function AdminLayout() {
  const { profile } = useAuth()
  const tabs = buildTabs(profile?.role)

  return (
    <div className="min-h-full">
      <div className="sticky top-14 z-10 border-b border-ink/8 bg-surface/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25'
                      : 'text-ink-soft/60 hover:bg-ink/5 hover:text-ink'
                  }`
                }
              >
                <tab.icon size={14} strokeWidth={2.25} />
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <span className="shrink-0 rounded-full bg-ink/6 px-2.5 py-1 text-[10px] font-bold text-ink-soft/60">
            {ROLE_LABELS[profile?.role] || ''}
          </span>
        </div>
      </div>
      <Outlet />
    </div>
  )
}

export default AdminLayout
