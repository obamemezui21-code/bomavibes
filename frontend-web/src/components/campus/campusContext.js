import { createContext, useContext } from 'react'

// { boot, reload, cls, classId, setClassId, year, setYear } — see pages/Campus.jsx
export const CampusContext = createContext(null)

export const useCampus = () => useContext(CampusContext)

// A Campus form control.
export const fieldClass = 'h-11 w-full rounded-xl border border-ink/12 bg-surface px-3 text-sm text-ink outline-none focus:border-violet-400'
