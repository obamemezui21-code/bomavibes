import { describe, expect, it } from 'vitest'
import { academicYears, countMarks, describeAudit, matchesSearch, mondayOf, monthBounds, percent, statusLabel } from './campus.js'
import { blankBundle, blankSheetReport, classReport, filledSheetReport, monthlyReport, officialListReport, studentReport, subjectReport, timetableReport } from './campusReports.js'
import { buildExcel, buildPdf, reportSheets } from './campusExport.js'
import { buildXlsx, columnName, crc32, sheetName } from './xlsx.js'

// Made-up names only: this repository is public.
const roster = Array.from({ length: 119 }, (_, i) => ({ id: `ETU-${String(i).padStart(8, '0')}`, no: i + 1, name: `NOMDÉ FAMILLE${i + 1} Éloïse L'orée` }))
const marks = { [roster[0].id]: { s: 'P', n: '' }, [roster[1].id]: { s: 'R', n: 'Transport' }, [roster[2].id]: { s: 'A', n: '' }, [roster[3].id]: { s: null, n: 'à vérifier' } }
const session = { id: 's', org: 'INASS', classCode: 'L1', date: '2026-11-23', start: '08:00', end: '10:00', subjectName: 'Droit social', teacherName: 'M. Enseignant', agentName: 'Agent Un', status: 'validated', validatedAt: '2026-11-23T10:00:00Z', validatedBy: 'Agent Un', roster, marks, counts: countMarks(roster, marks) }
const rates = (x) => ({ sessions: 2, p: 1, r: 0, a: 1, n: 0, presenceRate: 0.5, absenceRate: 0.5, ...x })
const stats = {
  class: { org: 'INASS', code: 'L1', label: 'Licence 1', active: 119 },
  year: '2026-2027',
  sessions: 2,
  totals: rates(),
  students: roster.map((s, i) => rates({ id: s.id, name: s.name, no: s.no, a: i < 5 ? 1 : 0, presenceRate: i === 118 ? null : 0.5 })),
  subjects: [rates({ id: 'm', name: 'Droit social' })],
  months: [rates({ month: '2026-11' })],
  weeks: [rates({ week: '2026-11-23' })],
  events: [{ date: '2026-11-23', subjectName: 'Droit social', name: roster[2].name, status: 'A', note: '' }],
}
const page = { org: 'INASS', className: 'L1', classLabel: 'Licence 1', student: { id: roster[2].id, name: roster[2].name }, record: { ...rates(), history: [{ date: '2026-11-23', start: '08:00', end: '10:00', subjectName: 'Droit social', teacherName: 'M. E', status: 'A', note: 'malade' }, { date: '2026-11-20', start: '08:00', end: '10:00', subjectName: 'Droit social', teacherName: 'M. E', status: null, note: '' }] } }

const all = {
  list: officialListReport({ cls: stats.class, students: roster, today: '2026-11-24' }),
  blank: blankSheetReport({ session, classLabel: 'Licence 1' }),
  filled: filledSheetReport({ session, classLabel: 'Licence 1' }),
  monthly: monthlyReport({ stats, month: '2026-11' }),
  student: studentReport({ page, filters: { year: '2026-2027' } }),
  subject: subjectReport({ stats, subject: { name: 'Droit social' } }),
  class: classReport({ stats }),
}

describe('words and formats', () => {
  it('an empty mark is « Non renseigné »', () => {
    expect(statusLabel(undefined)).toBe('Non renseigné')
    expect(statusLabel(null)).toBe('Non renseigné')
    expect(countMarks(roster, marks)).toEqual({ p: 1, r: 1, a: 1, n: 116 })
  })
  it('finds a student by any part of the name, or the number', () => {
    const s = { name: "NKEME L'héo Élise", no: 42 }
    for (const q of ['nkem', 'elise', 'ÉLI nke', 'heo', '42', '']) expect(matchesSearch(q, s)).toBe(true)
    for (const q of ['4', '421', 'zoe', 'lise']) expect(matchesSearch(q, s)).toBe(false)
  })
  it('rates and periods', () => {
    expect(percent(null)).toBe('—')
    expect(percent(0.5)).toBe('50 %')
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(academicYears('2026-2027', 2)).toEqual(['2026-2027', '2025-2026'])
  })
  it('a correction shows the old value and the new one', () => {
    const { title, lines } = describeAudit({ action: 'marks.correct', studentName: 'X', from: { s: 'A', n: '' }, to: { s: 'P', n: '' } })
    expect([title, ...lines]).toEqual(['Correction après validation', 'X : Absent → Présent'])
  })
})

describe('reports', () => {
  it('the sheet has the institution, class, date, subject, teacher and three statuses', () => {
    for (const r of [all.blank, all.filled]) {
      expect(r.org).toBe('INASS')
      expect(r.className).toContain('L1')
      const meta = Object.fromEntries(r.meta)
      expect(meta.Date).toBe('lundi 23 novembre 2026')
      expect(meta['Matière']).toBe('Droit social')
      expect(meta.Enseignant).toBe('M. Enseignant')
      expect(r.tables[0].columns.map((c) => c.label)).toEqual(expect.arrayContaining(['Présent', 'Retard', 'Absent']))
      expect(r.tables[0].rows).toHaveLength(119)
    }
  })
  it('nothing is ticked on a blank sheet; on a filled one, only what was entered', () => {
    expect(all.blank.tables[0].rows.flat().includes(true)).toBe(false)
    const rows = all.filled.tables[0].rows
    expect(rows[0].slice(2, 5)).toEqual([true, false, false])
    expect(rows[1].slice(2)).toEqual([false, true, false, 'Transport'])
    expect(rows[3].slice(2)).toEqual([false, false, false, 'Non renseigné – à vérifier'])
  })
  it('a sheet not validated says so', () => {
    expect(filledSheetReport({ session: { ...session, status: 'draft' } }).subtitle).toContain('NON VALIDÉE')
  })
  it('every report makes a PDF, with its pages numbered', async () => {
    for (const [name, r] of Object.entries(all)) {
      const doc = await buildPdf(r)
      const bytes = new Uint8Array(doc.output('arraybuffer'))
      expect(String.fromCharCode(...bytes.slice(0, 5)), name).toBe('%PDF-')
      expect(doc.getNumberOfPages(), name).toBeGreaterThan(0)
      expect(r.fileName, name).toMatch(/^[A-Za-z0-9_-]+$/)
    }
    expect((await buildPdf(all.list)).getNumberOfPages()).toBeGreaterThan(2)
  }, 30000)
  it('every report makes an Excel file', () => {
    for (const [name, r] of Object.entries(all)) {
      const bytes = buildExcel(r)
      expect([...bytes.slice(0, 4)], name).toEqual([0x50, 0x4b, 3, 4])
    }
    const [sheet] = reportSheets(all.filled)
    expect(sheet.rows.slice(sheet.freeze)).toHaveLength(119)
    expect(sheet.rows[sheet.freeze][2]).toEqual({ v: 'X', style: 'center' })
  })
})

const timetable = {
  week: '2026-11-23', title: 'Licence 1', note: 'Tenue obligatoire', status: 'published',
  periods: [{ id: 'p1', label: '1ère période', start: '08:00', end: '11:00' }, { id: 'p2', label: '2ème période', start: '11:30', end: '13:30' }],
  slots: [{ day: 1, periodId: 'p1', subjectName: 'Éthique', teacherName: null, kind: 'evaluation' }, { day: 5, periodId: 'p2', subjectName: 'Anglais', teacherName: 'M. X', kind: 'course' }],
}

describe('timetable', () => {
  it('a Monday, whatever the day', () => {
    expect(['2026-11-23', '2026-11-29', '2026-11-25'].map(mondayOf)).toEqual(['2026-11-23', '2026-11-23', '2026-11-23'])
    expect(mondayOf('demain')).toBe(null)
  })
  it('prints periods, pauses, days and evaluations', async () => {
    const r = timetableReport({ org: 'INASS', cls: stats.class, timetable })
    expect(r.orgName).toContain('Sciences de la Santé')
    expect(r.subtitle).toBe('Semaine du 23 nov. au 27/11/2026')
    expect(r.tables[0].columns).toHaveLength(6)
    const [p1, pause, p2] = r.tables[0].rows
    expect(p1[1]).toBe('ÉVALUATION\nÉthique')
    expect(pause).toEqual(['11:00 – 11:30', ...Array(5).fill('Pause')])
    expect(p2[5]).toBe('Anglais\nM. X')
    expect((await buildPdf(r)).getNumberOfPages()).toBe(1)
    expect(buildExcel(r).length).toBeGreaterThan(1000)
  })
  it('a day of blank sheets in one document, each with its own page numbers', async () => {
    const data = { classLabel: 'Licence 1', roster, sessions: [{ ...session, teacherName: '', kind: 'evaluation' }, { ...session, start: '11:30', end: '13:30' }] }
    const bundle = blankBundle({ data, name: 'L1 2026-11-23' })
    expect(bundle.reports.map((r) => r.title)).toEqual(['Feuille de présence – Évaluation', 'Feuille de présence'])
    const one = (await buildPdf(bundle.reports[1])).getNumberOfPages()
    expect((await buildPdf(bundle)).getNumberOfPages()).toBe(one * 2)
    expect(() => blankBundle({ data: { ...data, sessions: [] }, name: 'x' })).toThrow()
  }, 30000)
})

describe('xlsx', () => {
  it('checksum and column names', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect([0, 25, 26, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA'])
  })
  it('text stays text: no formula, no broken XML', () => {
    const out = new TextDecoder().decode(buildXlsx([{ name: 'A', rows: [['=1+1', 'a & <b>', 3, { v: 0.5, style: 'pct' }]] }]))
    expect(out).toContain('t="inlineStr"><is><t xml:space="preserve">=1+1</t>')
    expect(out).toContain('a &amp; &lt;b&gt;')
    expect(out).toContain('<c r="C1" s="4"><v>3</v></c>')
    expect(out).not.toContain('<f>')
  })
  it('sheet names Excel accepts', () => {
    const taken = new Set()
    expect(sheetName('Étudiants – a/b:c*?[x]', taken)).toBe('Étudiants – a b c   x')
    expect(sheetName('x'.repeat(40), taken)).toHaveLength(31)
    expect(sheetName('X'.repeat(40), taken)).toBe(`${'X'.repeat(27)} (2)`)
  })
})
