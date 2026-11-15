import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Briefcase, Check, Download, Eye, FileText, GraduationCap, Languages, Lightbulb, Pencil, RotateCcw, ShieldCheck, Sparkles, Target, User, Wrench, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { fetchCv, generateCv, saveCv } from '../firebase/cv.js'
import { downloadCvPdf } from '../lib/cvPdf.js'
import { cvCompleteness, splitSkills, writeCvLocally } from '../lib/cvAssistant.js'
import Button from '../components/ui/Button.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { CvEditor, CvPaper } from '../components/cv/CvPaper.jsx'
import { ScoreRing } from '../components/cv/CvUi.jsx'
import { ExperienceStep, IdentityStep, JobStep, LanguagesStep, SkillsStep, TrainingStep } from '../components/cv/CvSteps.jsx'

// CV PNPE, step by step: one screen per PNPE section, the CV drawn live as
// the member types (lib/cvAssistant.js: free, on the phone, no AI), then
// hand corrections and the PDF.
//
// When an AI key is set on the server (ANTHROPIC_API_KEY, paid), the last
// step also offers to have Claude write it (backend/src/services/cvWriter.js).

const POLL_MS = 3000
const DRAFT_KEY = (uid) => `bv.cvDraft.${uid}`

const STEPS = [
  { label: 'Identité', icon: User },
  { label: 'Poste', icon: Target },
  { label: 'Expériences', icon: Briefcase },
  { label: 'Formations', icon: GraduationCap },
  { label: 'Compétences', icon: Wrench },
  { label: 'Langues', icon: Languages },
  { label: 'Mon CV', icon: FileText },
]
const LAST = STEPS.length - 1

function initialForm(user, profile) {
  return {
    identite: {
      nom: profile?.firstName || '',
      telephones: '',
      email: user?.email || '',
      numeroPnpe: '',
      permis: '',
      ville: profile?.city || '',
      quartier: profile?.neighborhood || '',
    },
    posteRecherche: '',
    offre: '',
    experiences: [{ poste: '', entreprise: '', ville: '', debut: '', fin: '', enCours: false, description: '' }],
    formations: [{ intitule: '', etablissement: '', annee: '' }],
    competences: '',
    langues: [{ langue: 'Français', niveau: 'maternel' }],
    texteLibre: '',
  }
}

function readDraft(uid) {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY(uid)) || 'null')
  } catch {
    return null
  }
}

function writeDraft(uid, form) {
  try {
    localStorage.setItem(DRAFT_KEY(uid), JSON.stringify(form))
  } catch {
    // Private window / full storage: the server copy is saved at each step.
  }
}

// A step shows a tick once its section has something.
function stepDone(i, form) {
  switch (i) {
    case 0:
      return !!(form.identite.nom.trim() && form.identite.telephones.trim())
    case 1:
      return !!form.posteRecherche.trim()
    case 2:
      return form.experiences.some((e) => e.poste.trim() || e.entreprise.trim())
    case 3:
      return form.formations.some((f) => f.intitule.trim())
    case 4:
      return splitSkills(form.competences).length > 0
    case 5:
      return form.langues.some((l) => l.langue.trim())
    default:
      return false
  }
}

const slide = {
  enter: (dir) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
}

function CvBuilder() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const reduce = useReducedMotion()
  const uid = user?.id
  const [isLoading, setIsLoading] = useState(true)
  const [server, setServer] = useState(null)
  const [form, setForm] = useState(null)
  // Corrected by hand or written by the AI; null = drawn live from the form.
  const [cv, setCv] = useState(null)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [editing, setEditing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const wasPending = useRef(false)
  const topRef = useRef(null)
  const pillRefs = useRef([])

  const liveCv = useMemo(() => (form ? writeCvLocally(form) : null), [form])
  const shownCv = cv || liveCv
  const score = useMemo(() => (form ? cvCompleteness(form) : 0), [form])

  const onServerState = useCallback(
    (state) => {
      setServer(state)
      if (wasPending.current && state.status === 'ready' && state.cv) {
        setCv(state.cv)
        setEditing(false)
        showToast('L’IA a rédigé votre CV !', 'success')
      }
      if (wasPending.current && state.status === 'error' && state.error) showToast(state.error, 'error')
      wasPending.current = state.status === 'pending'
    },
    [showToast],
  )

  // Draft on this phone first, then the copy on the server, then the profile.
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    fetchCv()
      .then((state) => {
        if (cancelled) return
        const draft = readDraft(uid)
        const start = draft || state.form || initialForm(user, profile)
        setForm(start)
        setCv(state.cv || null)
        if (state.cv || cvCompleteness(start) >= 60) setStep(LAST)
        wasPending.current = state.status === 'pending'
        setServer(state)
      })
      .catch((err) => {
        if (cancelled) return
        setForm(readDraft(uid) || initialForm(user, profile))
        showToast(err.message, 'error')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
    // Loaded once per member; profile/user only seed an empty form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  useEffect(() => {
    if (uid && form) writeDraft(uid, form)
  }, [uid, form])

  // While the AI writes: asks every 3 s, and at once on return to the app.
  const pending = server?.status === 'pending'
  useEffect(() => {
    if (!pending) return undefined
    const check = () => fetchCv().then(onServerState).catch(() => {})
    const timer = setInterval(check, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pending, onServerState])

  // The current step's pill stays in view in the scrolling bar.
  useEffect(() => {
    pillRefs.current[step]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [step, reduce])

  function requiredErrors(f) {
    const next = {}
    if (!f.identite.nom.trim()) next.nom = 'Indiquez vos nom et prénoms.'
    if (!f.identite.telephones.trim()) next.telephones = 'Indiquez au moins un numéro.'
    if (!f.posteRecherche.trim()) next.posteRecherche = 'Indiquez le poste recherché.'
    return next
  }

  function goTo(i) {
    if (i === step) return
    setDirection(i > step ? 1 : -1)
    setStep(i)
    setEditing(false)
    setErrors({})
    topRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    // Kept on the server as they go, to find it on another phone.
    if (form) saveCv({ form }).then(setServer).catch(() => {})
  }

  function next() {
    const all = requiredErrors(form)
    const mine = Object.fromEntries(Object.entries(all).filter(([key]) => (step === 0 ? key !== 'posteRecherche' : step === 1 ? key === 'posteRecherche' : false)))
    if (Object.keys(mine).length) {
      setErrors(mine)
      showToast('Complétez les champs obligatoires (*).', 'error')
      return
    }
    goTo(Math.min(step + 1, LAST))
  }

  // Header fields missing: back to the step that has them.
  function ensureHeader() {
    const missing = requiredErrors(form)
    if (!Object.keys(missing).length) return true
    goTo(missing.nom || missing.telephones ? 0 : 1)
    setErrors(missing)
    showToast('Complétez d’abord votre nom, votre téléphone et le poste recherché.', 'error')
    return false
  }

  async function handleDownload() {
    if (!ensureHeader()) return
    setBusy(true)
    try {
      await downloadCvPdf({ identite: form.identite, cv: shownCv })
      saveCv({ form }).then(setServer).catch(() => {})
    } catch {
      showToast('Le PDF n’a pas pu être créé. Réessayez.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdits(edited) {
    setBusy(true)
    try {
      setServer(await saveCv({ cv: edited }))
      setCv(edited)
      setEditing(false)
      showToast('Modifications enregistrées.', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function backToLive() {
    if (!window.confirm('Revenir au texte fait à partir du formulaire ? Vos corrections à la main seront remplacées.')) return
    setCv(null)
    saveCv({ cv: null }).then(setServer).catch(() => {})
  }

  async function handleAi() {
    if (!ensureHeader()) return
    if (cv && !window.confirm('L’IA va réécrire votre CV : vos corrections à la main seront remplacées. Continuer ?')) return
    setBusy(true)
    try {
      wasPending.current = true
      onServerState(await generateCv(form))
    } catch (err) {
      wasPending.current = false
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  const remaining = server?.remainingToday ?? 0
  const aiReady = !!server?.available && remaining > 0
  const stepProps = { form, setForm, errors }
  const steps = [
    <IdentityStep key="0" {...stepProps} />,
    <JobStep key="1" {...stepProps} gender={profile?.gender} aiMode={aiReady} />,
    <ExperienceStep key="2" {...stepProps} />,
    <TrainingStep key="3" {...stepProps} />,
    <SkillsStep key="4" {...stepProps} />,
    <LanguagesStep key="5" {...stepProps} />,
  ]

  return (
    <div ref={topRef} className="mx-auto max-w-5xl scroll-mt-20 px-4 py-5 pb-10">
      {/* Header: where they are, and how complete the CV is. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-1 via-brand-2 to-brand-3 p-5 text-white shadow-lg shadow-violet-500/25">
        <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">CV aux normes du PNPE · gratuit</p>
            <h1 className="font-display text-2xl font-bold leading-tight">Mon CV PNPE</h1>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-1 text-sm text-white/90">
                Étape {step + 1} sur {STEPS.length} · {STEPS[step].label}
              </motion.p>
            </AnimatePresence>
          </div>
          <ScoreRing value={score} />
        </div>
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/25">
          <motion.div className="h-full rounded-full bg-white" initial={false} animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <nav aria-label="Étapes du CV" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {STEPS.map((s, i) => {
          const active = i === step
          const done = stepDone(i, form)
          const Icon = done && !active ? Check : s.icon
          return (
            <button
              key={s.label}
              ref={(el) => (pillRefs.current[i] = el)}
              type="button"
              onClick={() => goTo(i)}
              aria-current={active ? 'step' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30' : done ? 'bg-mint-500/15 text-mint-600' : 'bg-ink/[0.05] text-ink-soft hover:bg-ink/10'
              }`}
            >
              <Icon size={13} strokeWidth={2.5} />
              {s.label}
            </button>
          )
        })}
      </nav>

      <div className={`mt-4 grid grid-cols-1 gap-6 ${step < LAST ? 'desktop:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
        <div className="min-w-0">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div key={step} custom={direction} variants={reduce ? undefined : slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22, ease: 'easeOut' }}>
              {step < LAST ? (
                steps[step]
              ) : (
                <div className="space-y-4">
                  {pending && (
                    <div className="glass-panel flex items-center gap-3 rounded-2xl p-4" role="status">
                      <Spinner />
                      <div>
                        <p className="text-sm font-semibold text-ink">L’IA rédige votre CV…</p>
                        <p className="text-xs text-ink-soft/80">20 à 60 secondes. Vous pouvez quitter l’application, il sera là à votre retour.</p>
                      </div>
                    </div>
                  )}

                  {!editing && (
                    <>
                      <div className="glass-panel rounded-3xl p-5">
                        <p className="font-display text-xl font-semibold text-ink">{score >= 70 ? 'Votre CV est prêt 🎉' : 'Encore un petit effort 💪'}</p>
                        <p className="mt-1 text-sm text-ink-soft/80">
                          {score >= 70 ? 'Relisez-le, corrigez si besoin, puis téléchargez le PDF.' : 'Il manque encore des informations : suivez les conseils ci-dessous.'}
                        </p>
                        {shownCv.conseils?.length > 0 && (
                          <ul className="mt-3 space-y-1.5">
                            {shownCv.conseils.map((c) => (
                              <li key={c} className="flex items-start gap-2 text-sm text-ink-soft">
                                <Lightbulb size={15} className="mt-0.5 shrink-0 text-gold" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {cv && (
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gold/10 p-3 text-sm text-ink">
                          <span className="min-w-0 flex-1">Ce CV a été corrigé à la main ou rédigé par l’IA : les changements du formulaire n’y sont plus repris.</span>
                          <button type="button" onClick={backToLive} className="flex items-center gap-1 font-semibold text-violet-700">
                            <RotateCcw size={14} /> Revenir au formulaire
                          </button>
                        </div>
                      )}

                      <CvPaper identite={form.identite} cv={shownCv} />

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button variant="secondary" className="flex items-center justify-center gap-2" onClick={() => setEditing(true)} disabled={busy || pending}>
                          <Pencil size={16} /> Corriger le texte
                        </Button>
                        {aiReady ? (
                          <Button variant="secondary" className="flex items-center justify-center gap-2" onClick={handleAi} disabled={busy || pending}>
                            <Sparkles size={16} /> Rédiger avec l’IA ({remaining})
                          </Button>
                        ) : (
                          <Button variant="secondary" className="flex items-center justify-center gap-2" onClick={() => goTo(0)} disabled={busy}>
                            <ArrowLeft size={16} /> Revoir mes informations
                          </Button>
                        )}
                      </div>
                      <p className="flex items-start gap-2 rounded-xl bg-ink/[0.03] p-3 text-[11px] leading-relaxed text-ink-soft/80">
                        <ShieldCheck size={15} className="mt-px shrink-0 text-mint-600" />
                        {aiReady
                          ? 'Votre CV est préparé sur votre téléphone. Si vous choisissez l’IA, seuls votre poste, vos expériences, formations, compétences et langues sont envoyés à Claude (Anthropic) ; votre nom et vos coordonnées restent chez BomaVibes.'
                          : 'Votre CV est préparé directement sur votre téléphone : rien n’est envoyé à une IA. Relisez-le avant de l’envoyer.'}
                      </p>
                    </>
                  )}

                  {editing && <CvEditor cv={shownCv} onSave={handleSaveEdits} onCancel={() => setEditing(false)} isSaving={busy} />}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Computers: the CV drawn live beside the form. */}
        {step < LAST && (
          <aside className="hidden desktop:block">
            <div className="sticky top-4 max-h-[calc(100svh-2rem)] overflow-y-auto">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft/70">
                <span className="h-2 w-2 animate-pulse rounded-full bg-mint-500" /> Aperçu en direct
              </p>
              <CvPaper identite={form.identite} cv={shownCv} compact />
            </div>
          </aside>
        )}
      </div>

      {/* Back / preview / next, always at hand above the app's bottom bar. */}
      {!editing && (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mt-5 desktop:bottom-4">
          <div className="glass-panel mx-auto flex max-w-xl items-center gap-2 rounded-full p-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => goTo(Math.max(step - 1, 0))}
              disabled={step === 0}
              aria-label="Étape précédente"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5 disabled:opacity-30"
            >
              <ArrowLeft size={18} />
            </button>
            {step < LAST && (
              <button type="button" onClick={() => setPreviewOpen(true)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-500/10 desktop:hidden">
                <Eye size={17} /> Aperçu
              </button>
            )}
            {step < LAST ? (
              <Button className="flex h-11 flex-1 items-center justify-center gap-2" onClick={next}>
                {step === LAST - 1 ? 'Voir mon CV' : 'Suivant'} <ArrowRight size={17} />
              </Button>
            ) : (
              <Button className="flex h-11 flex-1 items-center justify-center gap-2" onClick={handleDownload} disabled={busy || pending}>
                <Download size={17} /> Télécharger le PDF
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Phones: the live CV in a sheet. */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div key="preview" className="fixed inset-0 z-[70] flex items-end desktop:hidden">
            {/* The dimmed page fades; the sheet itself stays opaque as it slides up. */}
            <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewOpen(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={reduce ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
              role="dialog"
              aria-label="Aperçu du CV"
              className="relative max-h-[88svh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-mint-500" /> Aperçu en direct
                </p>
                <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Fermer l’aperçu" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink/5">
                  <X size={18} />
                </button>
              </div>
              <CvPaper identite={form.identite} cv={shownCv} compact />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CvBuilder
