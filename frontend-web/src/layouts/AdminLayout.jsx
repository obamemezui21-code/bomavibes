import { NavLink, Outlet } from 'react-router-dom'
import { BadgeCheck, Bell, Calendar, ClipboardList, FileText, HelpCircle, Image as ImageIcon, Images, LayoutDashboard, MapPin, Music, Newspaper, Settings as SettingsIcon, ShieldAlert, Sparkles, Users, UsersRound, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLES, hasAdminAccess, hasContentAccess, hasFullAdminAccess, hasModerationAccess, isSuperAdmin } from '../lib/roles.js'

const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MODERATOR]: 'Modérateur',
  [ROLES.EDITOR]: 'Éditeur',
}

// One colour per tab (full class strings so Tailwind generates them):
//   tile   — solid circle behind the white icon
//   active — the whole pill once the tab is open
const tint = (tile, active) => ({ tile, active })
const C = {
  violet: tint('bg-violet-500', 'bg-violet-500 shadow-violet-500/30'),
  sky: tint('bg-sky-500', 'bg-sky-500 shadow-sky-500/30'),
  emerald: tint('bg-emerald-500', 'bg-emerald-500 shadow-emerald-500/30'),
  red: tint('bg-red-500', 'bg-red-500 shadow-red-500/30'),
  blue: tint('bg-blue-500', 'bg-blue-500 shadow-blue-500/30'),
  fuchsia: tint('bg-fuchsia-500', 'bg-fuchsia-500 shadow-fuchsia-500/30'),
  amber: tint('bg-amber-500', 'bg-amber-500 shadow-amber-500/30'),
  purple: tint('bg-purple-500', 'bg-purple-500 shadow-purple-500/30'),
  yellow: tint('bg-yellow-500', 'bg-yellow-500 shadow-yellow-500/30'),
  cyan: tint('bg-cyan-500', 'bg-cyan-500 shadow-cyan-500/30'),
  teal: tint('bg-teal-500', 'bg-teal-500 shadow-teal-500/30'),
  orange: tint('bg-orange-500', 'bg-orange-500 shadow-orange-500/30'),
  rose: tint('bg-rose-500', 'bg-rose-500 shadow-rose-500/30'),
  green: tint('bg-green-600', 'bg-green-600 shadow-green-600/30'),
  lime: tint('bg-lime-500', 'bg-lime-600 shadow-lime-500/30'),
  slate: tint('bg-slate-500', 'bg-slate-500 shadow-slate-500/30'),
  indigo: tint('bg-indigo-500', 'bg-indigo-500 shadow-indigo-500/30'),
  zinc: tint('bg-zinc-500', 'bg-zinc-600 shadow-zinc-500/30'),
}

function buildTabs(role) {
  const tabs = []
  if (hasAdminAccess(role)) tabs.push({ to: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard, end: true, color: C.violet })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/directory', label: 'Utilisateurs', icon: UsersRound, color: C.sky })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/payments', label: 'Paiements', icon: Wallet, color: C.emerald })
  if (hasModerationAccess(role)) tabs.push({ to: '/admin/reports', label: 'Signalements', icon: ShieldAlert, color: C.red })
  if (hasModerationAccess(role)) tabs.push({ to: '/admin/verifications', label: 'Vérifications', icon: BadgeCheck, color: C.blue })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/music', label: 'Musique', icon: Music, color: C.fuchsia })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/notifications', label: 'Notifications', icon: Bell, color: C.amber })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/ai-partners', label: 'Affiliation', icon: Sparkles, color: C.purple })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/pages', label: 'Pages', icon: FileText, color: C.yellow })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/articles', label: 'Articles', icon: Newspaper, color: C.cyan })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/faqs', label: 'FAQ', icon: HelpCircle, color: C.teal })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/banners', label: 'Bannières', icon: ImageIcon, color: C.orange })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/events', label: 'Événements', icon: Calendar, color: C.rose })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/content/venues', label: 'Coins Chics', icon: MapPin, color: C.green })
  if (hasContentAccess(role)) tabs.push({ to: '/admin/media', label: 'Médiathèque', icon: Images, color: C.lime })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/logs', label: "Journal d'activité", icon: ClipboardList, color: C.slate })
  if (isSuperAdmin(role)) tabs.push({ to: '/admin/users', label: 'Administrateurs', icon: Users, color: C.indigo })
  if (hasFullAdminAccess(role)) tabs.push({ to: '/admin/settings', label: 'Paramètres', icon: SettingsIcon, color: C.zinc })
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
                  `group flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[13px] font-semibold transition active:scale-[0.97] ${
                    isActive ? `${tab.color.active} text-white shadow-md` : 'text-ink-soft/70 hover:bg-ink/5 hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                        isActive ? 'bg-white/25 text-white' : `${tab.color.tile} text-white shadow-sm group-hover:scale-110`
                      }`}
                    >
                      <tab.icon size={16} strokeWidth={2.25} />
                    </span>
                    {tab.label}
                  </>
                )}
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
