import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ArrowLeft, BarChart3, CalendarDays, ClipboardList, FileText, GraduationCap, Lock, Moon, Settings2, Sun, Users } from 'lucide-react'
import { fetchCampus, fetchCampusMe } from '../firebase/campus.js'
import { ROLE_LABELS, academicYears } from '../lib/campus.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { CampusContext } from '../components/campus/campusContext.js'
import { ErrorNote, Loading } from '../components/campus/campusUi.jsx'
import Dashboard from '../components/campus/Dashboard.jsx'
import Timetable from '../components/campus/Timetable.jsx'
import SessionsList from '../components/campus/SessionsList.jsx'
import SessionSheet from '../components/campus/SessionSheet.jsx'
import Students from '../components/campus/Students.jsx'
import StudentSheet from '../components/campus/StudentSheet.jsx'
import Reports from '../components/campus/Reports.jsx'
import AdminPanel from '../components/campus/AdminPanel.jsx'

// BomaVibes Campus — attendance of an institution (backend/src/campus/). For
// its staff only, with its own screen: no part of the social app around it.

const TABS = [
  { to: '/campus', end: true, label: 'Tableau de bord', short: 'Accueil', icon: BarChart3 },
  { to: '/campus/planning', label: 'Planning', short: 'Planning', icon: CalendarDays },
  { to: '/campus/seances', label: 'Séances', short: 'Séances', icon: ClipboardList },
  { to: '/campus/etudiants', label: 'Étudiants', short: 'Étudiants', icon: Users },
  { to: '/campus/rapports', label: 'Rapports', short: 'Rapports', icon: FileText },
  { to: '/campus/administration', label: 'Administration', short: 'Admin', icon: Settings2, admin: true },
]

function Campus() {
  const { theme, toggleTheme } = useTheme()
  const [boot, setBoot] = useState(null)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')
  const [chosenClass, setClassId] = useState(null)
  const [chosenYear, setYear] = useState(null)

  const reload = useCallback(async () => {
    setBoot(await fetchCampus())
  }, [])

  const start = useCallback(async () => {
    setError('')
    try {
      const { allowed } = await fetchCampusMe()
      if (allowed) await reload()
      else setDenied(true)
    } catch (err) {
      setError(err.message)
    }
  }, [reload])
  useEffect(() => {
    start()
  }, [start])

  const ctx = useMemo(() => {
    if (!boot) return null
    const cls = boot.classes.find((c) => c.id === chosenClass) || boot.classes[0] || null
    return { boot, reload, cls, classId: cls?.id || null, setClassId, year: chosenYear || boot.year, setYear }
  }, [boot, reload, chosenClass, chosenYear])

  return (
    <div className="min-h-svh bg-surface-soft text-ink">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/events" aria-label="Retour à BomaVibes" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5">
            <ArrowLeft size={18} />
          </Link>
          <GraduationCap size={22} className="hidden shrink-0 text-violet-600 sm:block" aria-hidden="true" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-display text-base font-semibold">
              <span className="hidden sm:inline">BomaVibes </span>Campus{boot ? <span className="text-ink-soft"> · {boot.org}</span> : ''}
            </p>
            {boot && (
              <p className="truncate text-xs text-ink-soft">
                {boot.me.name}, {ROLE_LABELS[boot.me.role]}
              </p>
            )}
          </div>
          {ctx?.cls && (
            <>
              {boot.classes.length > 1 ? (
                <select aria-label="Classe" value={ctx.classId} onChange={(e) => setClassId(e.target.value)} className="h-9 rounded-lg border border-ink/12 bg-surface px-2 text-sm font-semibold">
                  {boot.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-lg bg-violet-500/12 px-2.5 py-1 text-sm font-bold text-violet-600">{ctx.cls.code}</span>
              )}
              <select aria-label="Année universitaire" value={ctx.year} onChange={(e) => setYear(e.target.value)} className="h-9 w-[6.5rem] rounded-lg border border-ink/12 bg-surface px-1.5 text-xs font-semibold sm:w-auto sm:px-2">
                {academicYears(boot.year).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
                <option value="all">Toutes</option>
              </select>
            </>
          )}
          <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Thème clair' : 'Thème sombre'} className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 sm:flex">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
        {boot && (
          <nav aria-label="Campus" className="mx-auto flex max-w-6xl overflow-x-auto px-1 sm:gap-1 sm:px-4">
            {TABS.filter((t) => !t.admin || boot.me.admin).map((t) => {
              const Icon = t.icon
              return (
                <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex h-11 shrink-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-1.5 text-xs font-semibold transition sm:flex-none sm:px-3 sm:text-[13px] ${isActive ? 'border-violet-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}>
                  <Icon size={16} aria-hidden="true" className="hidden sm:block" />
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </NavLink>
              )
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {error && <ErrorNote onRetry={start}>{error}</ErrorNote>}
        {denied && (
          <div className="mx-auto mt-10 max-w-md rounded-3xl border border-ink/8 bg-surface p-6 text-center">
            <Lock size={30} className="mx-auto text-violet-600" />
            <h1 className="mt-3 font-display text-lg font-bold">Réservé au personnel</h1>
            <p className="mt-2 text-sm text-ink-soft">BomaVibes Campus gère les présences d’un établissement. L’accès est accordé par son administrateur, sur l’adresse e-mail de votre compte.</p>
          </div>
        )}
        {!boot && !denied && !error && <Loading />}
        {ctx && (
          <CampusContext.Provider value={ctx}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="planning" element={<Timetable />} />
              <Route path="seances" element={<SessionsList />} />
              <Route path="seances/:id" element={<SessionSheet />} />
              <Route path="etudiants" element={<Students />} />
              <Route path="etudiants/:id" element={<StudentSheet />} />
              <Route path="rapports" element={<Reports />} />
              <Route path="administration" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/campus" replace />} />
            </Routes>
          </CampusContext.Provider>
        )}
      </main>
    </div>
  )
}

export default Campus
