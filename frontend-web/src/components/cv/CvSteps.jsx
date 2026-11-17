import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, CheckCircle2, ChevronDown, CircleAlert, GraduationCap, Plus, Sparkles, X } from 'lucide-react'
import { inputClass } from '../../lib/formStyles.js'
import { isCertificate, skillSuggestions, sortSkills, splitSkills, splitTasks, startsWithVerb, tidySkill, toTask } from '../../lib/cvAssistant.js'
import { AddButton, Chip, ChipRow, Field, LevelPills, MonthYear, RemoveButton, StepCard, Toggle } from './CvUi.jsx'
import { ACTION_VERBS, DIPLOMAS, JOB_TITLES, LANGUES_GABON, LANGUES_MONDE, PERMIS, SCHOOLS, YEARS, textareaClass } from './cvShared.js'

// The CV PNPE form, one screen per PNPE section (see pages/CvBuilder.jsx).
// Every step shows at once what will be on the CV.

const digits = (text) => String(text || '').replace(/\D/g, '').length
const looksLikeEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(text || '').trim())

const emptyExperience = () => ({ poste: '', entreprise: '', ville: '', debut: '', fin: '', enCours: false, description: '' })
const emptyFormation = () => ({ intitule: '', etablissement: '', annee: '' })

// ---- 1. Identity ---------------------------------------------------------------

export function IdentityStep({ form, setForm, errors }) {
  const id = form.identite
  const set = (key) => (e) => {
    const value = key === 'numeroPnpe' ? e.target.value.toUpperCase() : e.target.value
    setForm((f) => ({ ...f, identite: { ...f.identite, [key]: value } }))
  }
  return (
    <StepCard title="Qui êtes-vous ? 👋" subtitle="L’en-tête de votre CV : c’est ce que le recruteur lit en premier.">
      <Field label="Nom et prénoms" required valid={id.nom.trim().length > 2} error={errors.nom}>
        <input className={inputClass} value={id.nom} onChange={set('nom')} placeholder="ex. NDONG Awa Marie" autoComplete="name" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Téléphone (WhatsApp)" required valid={digits(id.telephones) >= 8} error={errors.telephones}>
          <input className={inputClass} value={id.telephones} onChange={set('telephones')} placeholder="ex. +241 77 12 34 56" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="E-mail professionnel" valid={looksLikeEmail(id.email)} hint="Plutôt prenom.nom@… qu’un surnom.">
          <input className={inputClass} value={id.email} onChange={set('email')} placeholder="ex. awa.ndong@gmail.com" inputMode="email" autoComplete="email" />
        </Field>
        <Field label="Ville" valid={id.ville.trim().length > 1}>
          <input className={inputClass} value={id.ville} onChange={set('ville')} placeholder="ex. Libreville" />
        </Field>
        <Field label="Quartier" valid={id.quartier.trim().length > 1}>
          <input className={inputClass} value={id.quartier} onChange={set('quartier')} placeholder="ex. Akébé" />
        </Field>
      </div>
      <Field label="N° d’identification PNPE" valid={id.numeroPnpe.trim().length > 5} hint="Si vous êtes inscrit(e) sur pnpe.ga.">
        <input className={inputClass} value={id.numeroPnpe} onChange={set('numeroPnpe')} placeholder="ex. D18401-2023-G1" autoCapitalize="characters" />
      </Field>
      <ChipRow label="Permis de conduire">
        {PERMIS.map((p) => (
          <Chip key={p} small selected={id.permis === p} onClick={() => setForm((f) => ({ ...f, identite: { ...f.identite, permis: f.identite.permis === p ? '' : p } }))}>
            {p}
          </Chip>
        ))}
      </ChipRow>
    </StepCard>
  )
}

// ---- 2. Job sought -------------------------------------------------------------

export function JobStep({ form, setForm, errors, gender, aiMode }) {
  const [showOffer, setShowOffer] = useState(!!form.offre)
  const titles = JOB_TITLES.map(([man, woman]) => (gender === 'FEMME' ? woman : gender === 'HOMME' ? man : man === woman ? man : `${man}`))
  const setTitle = (value) => setForm((f) => ({ ...f, posteRecherche: value }))
  return (
    <StepCard title="Quel poste visez-vous ? 🎯" subtitle="Un titre précis, comme sur l’annonce : « Opératrice de production (pétrole) » plutôt que « Opératrice ».">
      <Field label="Poste recherché" required valid={form.posteRecherche.trim().split(/\s+/).length >= 2} error={errors.posteRecherche}>
        <input className={`${inputClass} text-base`} value={form.posteRecherche} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Assistante comptable" />
      </Field>
      <ChipRow label="Idées (touchez pour choisir, puis précisez)">
        {titles.map((t) => (
          <Chip key={t} small selected={form.posteRecherche === t} onClick={() => setTitle(t)}>
            {t}
          </Chip>
        ))}
      </ChipRow>
      {aiMode &&
        (showOffer ? (
          <Field label="L’offre d’emploi (l’IA adaptera le titre)">
            <textarea className={textareaClass} value={form.offre} onChange={(e) => setForm((f) => ({ ...f, offre: e.target.value }))} placeholder="Collez ici le texte de l’annonce" />
          </Field>
        ) : (
          <button type="button" onClick={() => setShowOffer(true)} className="flex items-center gap-1.5 text-sm font-semibold text-violet-600">
            <Sparkles size={15} /> J’ai une offre d’emploi à coller
          </button>
        ))}
    </StepCard>
  )
}

// ---- 3. Experience ---------------------------------------------------------------

function TaskPreview({ description }) {
  const tasks = useMemo(() => splitTasks(description).map(toTask).filter(Boolean), [description])
  if (!tasks.length) return null
  return (
    <div className="rounded-2xl bg-violet-500/[0.06] p-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">Sur votre CV</p>
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {tasks.map((t) => {
            const strong = startsWithVerb(t)
            return (
              <motion.li key={t} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 text-sm text-ink">
                {strong ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint-600" /> : <CircleAlert size={16} className="mt-0.5 shrink-0 text-gold" />}
                <span>
                  {t}
                  {!strong && <span className="block text-xs text-ink-soft/70">Commencez par un verbe (touchez-en un plus haut).</span>}
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function ExperienceCard({ experience: e, index, open, onToggle, onChange, onRemove }) {
  const textareaRef = useRef(null)
  const set = (key) => (value) => onChange({ ...e, [key]: value })
  const heading = [e.poste, e.entreprise].filter(Boolean).join(' · ') || `Expérience ${index + 1}`
  const when = [e.debut, e.enCours ? 'Aujourd’hui' : e.fin].filter(Boolean).join(' – ')

  // A tapped verb starts a new task line, ready to be finished.
  function addVerb(verb) {
    const current = e.description.replace(/\s+$/, '')
    const next = current ? `${current}\n${verb} ` : `${verb} `
    onChange({ ...e, description: next })
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.length, next.length)
    })
  }

  return (
    <motion.div layout className="overflow-hidden rounded-2xl border border-ink/10 bg-white/50 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-sm font-bold text-violet-600">{index + 1}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{heading}</span>
            <span className="block truncate text-xs text-ink-soft/70">{when || 'Dates à préciser'}</span>
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="ml-auto text-ink-soft/50">
            <ChevronDown size={18} />
          </motion.span>
        </button>
        <RemoveButton onClick={onRemove} label={`Retirer l’expérience ${index + 1}`} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="space-y-4 border-t border-ink/8 p-3 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Poste occupé" valid={e.poste.trim().length > 2}>
                  <input className={inputClass} value={e.poste} onChange={(ev) => set('poste')(ev.target.value)} placeholder="ex. Caissière" />
                </Field>
                <Field label="Entreprise" valid={e.entreprise.trim().length > 1}>
                  <input className={inputClass} value={e.entreprise} onChange={(ev) => set('entreprise')(ev.target.value)} placeholder="ex. Mbolo" />
                </Field>
              </div>
              <Field label="Ville">
                <input className={inputClass} value={e.ville} onChange={(ev) => set('ville')(ev.target.value)} placeholder="ex. Port-Gentil" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink/80">Début</p>
                  <MonthYear label="Début" value={e.debut} onChange={set('debut')} />
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink/80">Fin</p>
                  {e.enCours ? (
                    <p className="flex h-[42px] items-center rounded-xl bg-mint-500/10 px-3.5 text-sm font-medium text-mint-600">Aujourd’hui</p>
                  ) : (
                    <MonthYear label="Fin" value={e.fin} onChange={set('fin')} />
                  )}
                </div>
              </div>
              <Toggle checked={e.enCours} onChange={set('enCours')} label="J’y travaille encore" />
              <div>
                <p className="mb-2 text-sm font-medium text-ink/80">Ce que vous faisiez</p>
                <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {ACTION_VERBS.map((verb) => (
                    <Chip key={verb} small icon={Plus} onClick={() => addVerb(verb)}>
                      {verb}
                    </Chip>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  className={textareaClass}
                  value={e.description}
                  onChange={(ev) => set('description')(ev.target.value)}
                  placeholder={'Une tâche par ligne, ou écrivez simplement :\nje recevais les clients, je faisais la caisse…'}
                  aria-label="Ce que vous faisiez"
                />
              </div>
              <TaskPreview description={e.description} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ExperienceStep({ form, setForm }) {
  const [openIndex, setOpenIndex] = useState(() => (form.experiences.length ? 0 : -1))
  const update = (i, next) => setForm((f) => ({ ...f, experiences: f.experiences.map((x, j) => (j === i ? next : x)) }))
  function add() {
    setForm((f) => ({ ...f, experiences: [...f.experiences, emptyExperience()] }))
    setOpenIndex(form.experiences.length)
  }
  function remove(i) {
    setForm((f) => ({ ...f, experiences: f.experiences.filter((_, j) => j !== i) }))
    setOpenIndex(-1)
  }
  return (
    <StepCard title="Vos expériences 💼" subtitle="Emplois, stages, petits boulots, bénévolat : tout compte. La plus récente sera placée en premier.">
      {form.experiences.map((e, i) => (
        <ExperienceCard key={i} experience={e} index={i} open={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? -1 : i)} onChange={(next) => update(i, next)} onRemove={() => remove(i)} />
      ))}
      <AddButton onClick={add}>{form.experiences.length ? 'Ajouter une autre expérience' : 'Ajouter une expérience'}</AddButton>
    </StepCard>
  )
}

// ---- 4. Training -------------------------------------------------------------------

// The diploma chip already in the title: « BTS comptabilité » lights « BTS », not « BT ».
const chipIsIn = (title, chip) => title === chip || title.startsWith(`${chip} `)

function TrainingCard({ formation: f, index: i, update, remove }) {
  const inputRef = useRef(null)
  const certificate = isCertificate(f.intitule)
  // A tapped diploma fills the title, the caret ready after it (« BTS ▮ »).
  function pick(chip) {
    const value = `${chip} `
    update(i, 'intitule', value)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(value.length, value.length)
    })
  }
  return (
    <motion.div layout className="space-y-3 rounded-2xl border border-ink/10 bg-white/50 p-3 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {f.intitule.trim() ? (
            <motion.span key={certificate ? 'c' : 'd'} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${certificate ? 'bg-gold/15 text-gold' : 'bg-violet-500/12 text-violet-700'}`}>
              {certificate ? <Award size={13} /> : <GraduationCap size={13} />}
              {certificate ? 'Certificat / formation' : 'Diplôme'}
            </motion.span>
          ) : (
            <span className="text-xs text-ink-soft/60">Formation {i + 1}</span>
          )}
        </AnimatePresence>
        <span className="ml-auto">
          <RemoveButton onClick={() => remove(i)} label={`Retirer la formation ${i + 1}`} />
        </span>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {DIPLOMAS.map((d) => (
          <Chip key={d} small selected={chipIsIn(f.intitule, d)} onClick={() => pick(d)}>
            {d}
          </Chip>
        ))}
      </div>
      <Field label="Diplôme ou formation" valid={f.intitule.trim().length > 3}>
        <input ref={inputRef} className={inputClass} value={f.intitule} onChange={(ev) => update(i, 'intitule', ev.target.value)} placeholder="ex. BTS Comptabilité" />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Établissement">
          <input className={inputClass} value={f.etablissement} onChange={(ev) => update(i, 'etablissement', ev.target.value)} placeholder="ex. Université Omar Bongo" list="cv-schools" />
        </Field>
        <Field label="Année">
          <select className={inputClass} value={f.annee} onChange={(ev) => update(i, 'annee', ev.target.value)}>
            <option value="">Année</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            {f.annee && !/^\d{4}$/.test(f.annee) && <option value={f.annee}>{f.annee}</option>}
          </select>
        </Field>
      </div>
    </motion.div>
  )
}

export function TrainingStep({ form, setForm }) {
  const update = (i, key, value) => setForm((f) => ({ ...f, formations: f.formations.map((x, j) => (j === i ? { ...x, [key]: value } : x)) }))
  const remove = (i) => setForm((f) => ({ ...f, formations: f.formations.filter((_, j) => j !== i) }))
  const add = () => setForm((f) => ({ ...f, formations: [...f.formations, emptyFormation()] }))
  return (
    <StepCard title="Vos formations et diplômes 🎓" subtitle="Diplômes, certificats, formations qualifiantes (ex. CFMP Libreville).">
      {form.formations.map((f, i) => (
        <TrainingCard key={i} formation={f} index={i} update={update} remove={remove} />
      ))}
      <AddButton onClick={add}>{form.formations.length ? 'Ajouter une autre formation' : 'Ajouter une formation'}</AddButton>
      <datalist id="cv-schools">
        {SCHOOLS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </StepCard>
  )
}

// ---- 5. Skills -----------------------------------------------------------------------

export function SkillsStep({ form, setForm }) {
  const [draft, setDraft] = useState('')
  const items = useMemo(() => splitSkills(form.competences), [form.competences])
  const sorted = useMemo(() => sortSkills(form.competences), [form.competences])
  const ideas = useMemo(() => {
    const taken = new Set(items.map((s) => s.toLowerCase()))
    return skillSuggestions(form.posteRecherche).filter((s) => !taken.has(s.toLowerCase()))
  }, [form.posteRecherche, items])
  const save = (list) => setForm((f) => ({ ...f, competences: list.join(', ') }))
  function add(value) {
    const v = tidySkill(value.trim().replace(/,+$/, ''))
    if (!v || items.some((s) => s.toLowerCase() === v.toLowerCase())) return
    save([...items, v])
  }

  return (
    <StepCard title="Vos compétences 🛠️" subtitle="Logiciels, outils, savoir-faire. Touchez une idée ou écrivez la vôtre.">
      <div className="flex min-h-12 flex-wrap gap-2 rounded-2xl border border-ink/12 bg-ink/[0.03] p-2">
        <AnimatePresence initial={false}>
          {items.map((s) => (
            <motion.span key={s} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 py-1 pl-3 pr-1 text-sm font-medium text-white">
              {s}
              <button type="button" onClick={() => save(items.filter((x) => x !== s))} aria-label={`Retirer ${s}`} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/20">
                <X size={13} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          className="min-w-[10rem] flex-1 bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-soft/50"
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            if (v.endsWith(',')) {
              add(v)
              setDraft('')
            } else setDraft(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
              setDraft('')
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              add(draft)
              setDraft('')
            }
          }}
          placeholder={items.length ? 'Ajouter…' : 'ex. Excel, gestion de stock…'}
          aria-label="Ajouter une compétence"
        />
      </div>
      {ideas.length > 0 && (
        <ChipRow label="Idées pour votre métier">
          {ideas.slice(0, 12).map((s) => (
            <Chip key={s} small icon={Plus} onClick={() => add(s)}>
              {s}
            </Chip>
          ))}
        </ChipRow>
      )}
      {(sorted.techniques.length > 0 || sorted.savoirFaire.length > 0) && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl bg-violet-500/[0.06] p-3 sm:grid-cols-2">
          {[
            ['Compétences techniques', sorted.techniques],
            ['Savoir-faire', sorted.savoirFaire],
          ].map(([label, list]) => (
            <div key={label}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700">{label}</p>
              {list.length ? (
                <ul className="space-y-0.5 text-sm text-ink">
                  {list.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-soft/60">—</p>
              )}
            </div>
          ))}
        </div>
      )}
    </StepCard>
  )
}

// ---- 6. Languages ----------------------------------------------------------------------

export function LanguagesStep({ form, setForm }) {
  const [other, setOther] = useState('')
  const taken = new Set(form.langues.map((l) => l.langue.trim().toLowerCase()))
  const add = (langue, niveau = 'moyen') => {
    if (!langue.trim() || taken.has(langue.trim().toLowerCase())) return
    setForm((f) => ({ ...f, langues: [...f.langues, { langue: langue.trim(), niveau }] }))
  }
  const update = (i, niveau) => setForm((f) => ({ ...f, langues: f.langues.map((l, j) => (j === i ? { ...l, niveau } : l)) }))
  const remove = (i) => setForm((f) => ({ ...f, langues: f.langues.filter((_, j) => j !== i) }))
  return (
    <StepCard title="Vos langues 🌍" subtitle="Les langues gabonaises comptent aussi. Choisissez votre niveau pour chacune.">
      <AnimatePresence initial={false}>
        {form.langues
          .map((l, i) => [l, i])
          .filter(([l]) => l.langue.trim())
          .map(([l, i]) => (
            <motion.div key={`${l.langue}-${i}`} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 rounded-2xl border border-ink/10 bg-white/50 p-3 dark:bg-white/[0.03]">
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-ink">{l.langue}</p>
                <LevelPills value={l.niveau} onChange={(n) => update(i, n)} />
              </div>
              <RemoveButton onClick={() => remove(i)} label={`Retirer ${l.langue}`} />
            </motion.div>
          ))}
      </AnimatePresence>
      {[
        ['Langues gabonaises', LANGUES_GABON],
        ['Autres langues', LANGUES_MONDE],
      ].map(([label, names]) => (
        <ChipRow key={label} label={label}>
          {names
            .filter((l) => !taken.has(l.toLowerCase()))
            .map((l) => (
              <Chip key={l} small icon={Plus} onClick={() => add(l, taken.size === 0 ? 'maternel' : 'moyen')}>
                {l}
              </Chip>
            ))}
        </ChipRow>
      ))}
      <div className="flex gap-2">
        <input className={inputClass} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Une autre langue…" aria-label="Autre langue" />
        <button
          type="button"
          onClick={() => {
            add(other)
            setOther('')
          }}
          className="shrink-0 rounded-xl bg-violet-500/12 px-4 text-sm font-semibold text-violet-700"
        >
          Ajouter
        </button>
      </div>
    </StepCard>
  )
}
