import { useCallback, useEffect, useRef, useState } from 'react'
import { Briefcase, Download, FileText, GraduationCap, Languages, Lightbulb, Pencil, Plus, ShieldCheck, Sparkles, Trash2, User, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { fetchCv, generateCv, saveCv } from '../firebase/cv.js'
import { downloadCvPdf, permisLabel } from '../lib/cvPdf.js'
import { writeCvLocally } from '../lib/cvAssistant.js'
import { inputClass, labelClass } from '../lib/formStyles.js'
import Button from '../components/ui/Button.jsx'
import Spinner from '../components/ui/Spinner.jsx'

// CV PNPE: the member fills in the PNPE's mandatory sections in their own
// words, the CV is written, the member checks it, corrects it by hand if
// needed, and downloads the PDF.
//
// Written for free on the phone (lib/cvAssistant.js: rules, no AI, nothing
// sent anywhere). When an AI key is set on the server (ANTHROPIC_API_KEY,
// paid), Claude writes it instead (backend/src/services/cvWriter.js), with
// the free way still offered.

const POLL_MS = 3000
const DRAFT_KEY = (uid) => `bv.cvDraft.${uid}`

const NIVEAUX = ['maternel', 'courant', 'bon', 'moyen', 'notions']
const LANGUES = ['Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe', 'Chinois', 'Fang', 'Punu', 'Myènè', 'Nzébi', 'Téké', 'Obamba', 'Kota', 'Vili', 'Lingala']
const PERMIS = ['Aucun', 'Permis A', 'Permis B', 'Permis C', 'Permis D', 'Permis E']

const emptyExperience = () => ({ poste: '', entreprise: '', ville: '', debut: '', fin: '', enCours: false, description: '' })
const emptyFormation = () => ({ intitule: '', etablissement: '', annee: '' })
const emptyLangue = () => ({ langue: '', niveau: 'moyen' })

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
    experiences: [emptyExperience()],
    formations: [emptyFormation()],
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
    // Private window / full storage: the server copy is saved with each CV.
  }
}

// ---- Small building blocks ---------------------------------------------------

function Section({ icon: Icon, step, title, hint, children }) {
  return (
    <section className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-ink">
            <span className="text-violet-600">{step}.</span> {title}
          </h2>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-ink-soft/80">{hint}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelClass}>
        {label}
        {required && <span className="text-pink-600"> *</span>}
      </span>
      {children}
    </label>
  )
}

function RowCard({ onRemove, removeLabel, children }) {
  return (
    <div className="relative rounded-xl border border-ink/10 bg-ink/[0.02] p-3 pt-9 sm:pt-3 sm:pr-11">
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/70 hover:bg-coral-500/10 hover:text-coral-600"
      >
        <Trash2 size={15} />
      </button>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-400/50 py-2.5 text-sm font-medium text-violet-600 hover:bg-violet-500/5"
    >
      <Plus size={16} /> {children}
    </button>
  )
}

const textareaClass = `${inputClass} min-h-24 resize-y leading-relaxed`
const lines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean)

// ---- Step 1: the member's information ------------------------------------------

function CvForm({ form, setForm, errors, aiMode }) {
  const setId = (key) => (e) => setForm((f) => ({ ...f, identite: { ...f.identite, [key]: e.target.value } }))
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setRow = (listKey, i, key, value) =>
    setForm((f) => ({ ...f, [listKey]: f[listKey].map((row, j) => (j === i ? { ...row, [key]: value } : row)) }))
  const addRow = (listKey, make) => setForm((f) => ({ ...f, [listKey]: [...f[listKey], make()] }))
  const removeRow = (listKey, i) => setForm((f) => ({ ...f, [listKey]: f[listKey].filter((_, j) => j !== i) }))
  const { identite } = form

  return (
    <div className="space-y-4">
      <Section icon={User} step={1} title="Votre identité" hint={aiMode ? 'L’en-tête du CV. Ces informations ne sont jamais envoyées à l’IA.' : 'L’en-tête du CV.'}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom et prénoms" required className="sm:col-span-2">
            <input className={inputClass} value={identite.nom} onChange={setId('nom')} placeholder="ex. NDONG Awa Marie" autoComplete="name" aria-invalid={!!errors.nom} />
            {errors.nom && <span className="mt-1 block text-xs text-pink-600">{errors.nom}</span>}
          </Field>
          <Field label="Téléphone(s), WhatsApp de préférence" required>
            <input className={inputClass} value={identite.telephones} onChange={setId('telephones')} placeholder="ex. +241 77 12 34 56" inputMode="tel" autoComplete="tel" aria-invalid={!!errors.telephones} />
            {errors.telephones && <span className="mt-1 block text-xs text-pink-600">{errors.telephones}</span>}
          </Field>
          <Field label="Adresse e-mail professionnelle">
            <input className={inputClass} value={identite.email} onChange={setId('email')} placeholder="ex. awa.ndong@gmail.com" inputMode="email" autoComplete="email" />
          </Field>
          <Field label="N° d’identification PNPE">
            <input className={inputClass} value={identite.numeroPnpe} onChange={setId('numeroPnpe')} placeholder="ex. D18401-2023-G1 (si inscrit sur pnpe.ga)" />
          </Field>
          <Field label="Permis de conduire">
            <input className={inputClass} value={identite.permis} onChange={setId('permis')} placeholder="ex. Permis B" list="cv-permis" />
          </Field>
          <Field label="Ville de résidence">
            <input className={inputClass} value={identite.ville} onChange={setId('ville')} placeholder="ex. Libreville" />
          </Field>
          <Field label="Quartier">
            <input className={inputClass} value={identite.quartier} onChange={setId('quartier')} placeholder="ex. Akébé" />
          </Field>
        </div>
      </Section>

      <Section
        icon={Briefcase}
        step={2}
        title="Le poste recherché"
        hint={aiMode ? 'Un titre précis. Collez l’offre d’emploi si vous en avez une : l’IA adaptera le titre.' : 'Un titre précis. Si vous répondez à une annonce, reprenez son intitulé exact.'}
      >
        <Field label="Poste recherché" required>
          <input className={inputClass} value={form.posteRecherche} onChange={set('posteRecherche')} placeholder="ex. Opérateur de production (pétrole)" aria-invalid={!!errors.posteRecherche} />
          {errors.posteRecherche && <span className="mt-1 block text-xs text-pink-600">{errors.posteRecherche}</span>}
        </Field>
        {aiMode && (
          <Field label="L’offre d’emploi (facultatif)">
            <textarea className={textareaClass} value={form.offre} onChange={set('offre')} placeholder="Collez ici le texte de l’annonce" />
          </Field>
        )}
      </Section>

      <Section
        icon={Briefcase}
        step={3}
        title="Vos expériences professionnelles"
        hint={
          aiMode
            ? 'Emplois, stages, petits boulots. Écrivez simplement ce que vous faisiez : l’IA le mettra en forme avec des verbes d’action.'
            : 'Emplois, stages, petits boulots. Une tâche par ligne ; écrivez simplement (« je recevais les clients »), elle sera mise en forme avec un verbe d’action (« Accueillir les clients »).'
        }
      >
        {form.experiences.map((e, i) => (
          <RowCard key={i} onRemove={() => removeRow('experiences', i)} removeLabel={`Retirer l’expérience ${i + 1}`}>
            <Field label="Poste occupé">
              <input className={inputClass} value={e.poste} onChange={(ev) => setRow('experiences', i, 'poste', ev.target.value)} placeholder="ex. Caissière" />
            </Field>
            <Field label="Entreprise">
              <input className={inputClass} value={e.entreprise} onChange={(ev) => setRow('experiences', i, 'entreprise', ev.target.value)} placeholder="ex. Mbolo" />
            </Field>
            <Field label="Début (mois et année)">
              <input className={inputClass} value={e.debut} onChange={(ev) => setRow('experiences', i, 'debut', ev.target.value)} placeholder="ex. mars 2021" />
            </Field>
            <div>
              <Field label="Fin (mois et année)">
                <input className={inputClass} value={e.enCours ? '' : e.fin} disabled={e.enCours} onChange={(ev) => setRow('experiences', i, 'fin', ev.target.value)} placeholder={e.enCours ? 'Aujourd’hui' : 'ex. juin 2023'} />
              </Field>
              {/* Its own label: inside the field's, a tap on the text went to the date input. */}
              <label className="mt-1.5 flex w-fit items-center gap-2 py-1 text-xs text-ink-soft">
                <input type="checkbox" checked={e.enCours} onChange={(ev) => setRow('experiences', i, 'enCours', ev.target.checked)} className="h-4 w-4 accent-violet-600" />
                J’y travaille encore
              </label>
            </div>
            <Field label="Ville">
              <input className={inputClass} value={e.ville} onChange={(ev) => setRow('experiences', i, 'ville', ev.target.value)} placeholder="ex. Port-Gentil" />
            </Field>
            <Field label="Ce que vous faisiez" className="sm:col-span-2">
              <textarea className={textareaClass} value={e.description} onChange={(ev) => setRow('experiences', i, 'description', ev.target.value)} placeholder="ex. je recevais les clients, je faisais la caisse, je rangeais le stock le soir" />
            </Field>
          </RowCard>
        ))}
        <AddButton onClick={() => addRow('experiences', emptyExperience)}>Ajouter une expérience</AddButton>
      </Section>

      <Section icon={GraduationCap} step={4} title="Formations et diplômes" hint="Diplômes, certificats et formations qualifiantes (ex. CFMP Libreville).">
        {form.formations.map((f, i) => (
          <RowCard key={i} onRemove={() => removeRow('formations', i)} removeLabel={`Retirer la formation ${i + 1}`}>
            <Field label="Diplôme ou formation" className="sm:col-span-2">
              <input className={inputClass} value={f.intitule} onChange={(ev) => setRow('formations', i, 'intitule', ev.target.value)} placeholder="ex. Master I en psychologie" />
            </Field>
            <Field label="Établissement">
              <input className={inputClass} value={f.etablissement} onChange={(ev) => setRow('formations', i, 'etablissement', ev.target.value)} placeholder="ex. Université Omar Bongo" />
            </Field>
            <Field label="Année d’obtention">
              <input className={inputClass} value={f.annee} onChange={(ev) => setRow('formations', i, 'annee', ev.target.value)} placeholder="ex. 2022" inputMode="numeric" />
            </Field>
          </RowCard>
        ))}
        <AddButton onClick={() => addRow('formations', emptyFormation)}>Ajouter une formation</AddButton>
      </Section>

      <Section icon={Wrench} step={5} title="Vos compétences" hint="Logiciels, outils, savoir-faire : tout ce que vous savez faire.">
        <textarea className={textareaClass} value={form.competences} onChange={set('competences')} placeholder="ex. Excel, Word, gestion de stock, conduite de chariot élévateur, rédaction de rapports" />
      </Section>

      <Section icon={Languages} step={6} title="Langues" hint="Les langues gabonaises comptent aussi.">
        {form.langues.map((l, i) => (
          <RowCard key={i} onRemove={() => removeRow('langues', i)} removeLabel={`Retirer la langue ${i + 1}`}>
            <Field label="Langue">
              <input className={inputClass} value={l.langue} onChange={(ev) => setRow('langues', i, 'langue', ev.target.value)} placeholder="ex. Anglais" list="cv-langues" />
            </Field>
            <Field label="Niveau">
              <select className={inputClass} value={l.niveau} onChange={(ev) => setRow('langues', i, 'niveau', ev.target.value)}>
                {NIVEAUX.map((n) => (
                  <option key={n} value={n}>
                    {n.charAt(0).toUpperCase() + n.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </RowCard>
        ))}
        <AddButton onClick={() => addRow('langues', emptyLangue)}>Ajouter une langue</AddButton>
      </Section>

      {/* Only the AI can read a pasted CV. */}
      {aiMode && (
        <Section icon={FileText} step={7} title="Vous avez déjà un CV ? (facultatif)" hint="Collez-le ici, ou écrivez en vrac ce que vous n’avez pas mis plus haut.">
          <textarea className={`${textareaClass} min-h-32`} value={form.texteLibre} onChange={set('texteLibre')} placeholder="Copiez-collez votre ancien CV" />
        </Section>
      )}

      <datalist id="cv-permis">
        {PERMIS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="cv-langues">
        {LANGUES.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  )
}

// ---- Step 2: the written CV ------------------------------------------------------

function PaperSection({ title, children }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-violet-700">{title}</h3>
      <div className="mb-2 mt-1 h-0.5 w-6 rounded bg-violet-600" />
      {children}
    </div>
  )
}

function period(e) {
  return [e.debut, e.fin].filter(Boolean).join(' – ')
}

// Looks like the PDF: white sheet, same sections, same order.
function CvPaper({ identite, cv }) {
  const contact = [identite.telephones && `Tél. / WhatsApp : ${identite.telephones}`, identite.email, [identite.ville, identite.quartier].filter(Boolean).join(', ')].filter(Boolean)
  const admin = [identite.numeroPnpe && `N° PNPE : ${identite.numeroPnpe}`, permisLabel(identite.permis)].filter(Boolean)
  const trainings = (items) =>
    items.map((f, i) => (
      <div key={i} className="mb-2 grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
        <span className="text-[#635a65]">{f.annee}</span>
        <div>
          <p className="font-semibold">{f.intitule}</p>
          {f.etablissement && <p className="italic text-[#635a65]">{f.etablissement}</p>}
        </div>
      </div>
    ))

  return (
    <article className="overflow-hidden rounded-xl bg-white text-[#261b28] shadow-xl ring-1 ring-black/5">
      <div className="h-1.5 bg-[#6a4693]" />
      <div className="p-5 sm:p-8">
        <h2 className="text-2xl font-bold leading-tight">{identite.nom || 'Nom et prénoms'}</h2>
        {cv.titrePoste && <p className="mt-1 text-base font-bold text-[#6a4693]">{cv.titrePoste}</p>}
        {contact.length > 0 && <p className="mt-2 text-xs text-[#635a65]">{contact.join('   |   ')}</p>}
        {admin.length > 0 && <p className="text-xs text-[#635a65]">{admin.join('   |   ')}</p>}
        <hr className="mt-3 border-[#ddd6e2]" />

        {cv.experiences?.length > 0 && (
          <PaperSection title="Expériences professionnelles">
            {cv.experiences.map((e, i) => (
              <div key={i} className="mb-3 grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
                <span className="text-[#635a65]">{period(e)}</span>
                <div>
                  <p className="font-semibold">{e.poste || e.entreprise}</p>
                  <p className="italic text-[#635a65]">{[e.entreprise, e.lieu].filter(Boolean).join(' – ')}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 marker:text-[#6a4693]">
                    {e.taches?.map((t, j) => (
                      <li key={j}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </PaperSection>
        )}

        {(cv.formations?.length > 0 || cv.certifications?.length > 0) && (
          <PaperSection title="Formations et diplômes">
            {trainings(cv.formations || [])}
            {cv.certifications?.length > 0 && (
              <>
                <p className="mb-1.5 mt-3 text-sm font-semibold text-[#635a65]">Certificats et formations qualifiantes</p>
                {trainings(cv.certifications)}
              </>
            )}
          </PaperSection>
        )}

        {(cv.competencesTechniques?.length > 0 || cv.savoirFaire?.length > 0) && (
          <PaperSection title="Compétences">
            {[
              ['Compétences techniques', cv.competencesTechniques],
              ['Savoir-faire', cv.savoirFaire],
            ].map(
              ([label, items]) =>
                items?.length > 0 && (
                  <div key={label} className="mb-2 text-sm">
                    <p className="font-semibold">{label}</p>
                    <ul className="mt-0.5 list-disc space-y-0.5 pl-4 marker:text-[#6a4693]">
                      {items.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </PaperSection>
        )}

        {cv.langues?.length > 0 && (
          <PaperSection title="Langues">
            <ul className="list-disc space-y-0.5 pl-4 text-sm marker:text-[#6a4693]">
              {cv.langues.map((l, i) => (
                <li key={i}>{l.niveau ? `${l.langue} (${l.niveau})` : l.langue}</li>
              ))}
            </ul>
          </PaperSection>
        )}
      </div>
    </article>
  )
}

// Hand corrections, no AI and no daily quota: one line per task/skill.
function CvEditor({ cv, onSave, onCancel, isSaving }) {
  const [draft, setDraft] = useState(() => ({
    ...cv,
    experiences: cv.experiences.map((e) => ({ ...e, tachesText: (e.taches || []).join('\n') })),
    competencesText: (cv.competencesTechniques || []).join('\n'),
    savoirFaireText: (cv.savoirFaire || []).join('\n'),
  }))
  const setExp = (i, key, value) => setDraft((d) => ({ ...d, experiences: d.experiences.map((e, j) => (j === i ? { ...e, [key]: value } : e)) }))
  const setList = (key, i, field, value) => setDraft((d) => ({ ...d, [key]: d[key].map((x, j) => (j === i ? { ...x, [field]: value } : x)) }))
  const removeFrom = (key, i) => setDraft((d) => ({ ...d, [key]: d[key].filter((_, j) => j !== i) }))

  function save() {
    const { competencesText, savoirFaireText, ...rest } = draft
    onSave({
      ...rest,
      experiences: draft.experiences.map(({ tachesText, ...e }) => ({ ...e, taches: lines(tachesText) })),
      competencesTechniques: lines(competencesText),
      savoirFaire: lines(savoirFaireText),
    })
  }

  const trainingRows = (key) =>
    draft[key].map((f, i) => (
      <RowCard key={i} onRemove={() => removeFrom(key, i)} removeLabel="Retirer">
        <Field label="Intitulé" className="sm:col-span-2">
          <input className={inputClass} value={f.intitule} onChange={(ev) => setList(key, i, 'intitule', ev.target.value)} />
        </Field>
        <Field label="Établissement">
          <input className={inputClass} value={f.etablissement} onChange={(ev) => setList(key, i, 'etablissement', ev.target.value)} />
        </Field>
        <Field label="Année">
          <input className={inputClass} value={f.annee} onChange={(ev) => setList(key, i, 'annee', ev.target.value)} />
        </Field>
      </RowCard>
    ))

  return (
    <div className="space-y-4">
      <Section icon={Briefcase} step={1} title="Titre du poste">
        <input className={inputClass} value={draft.titrePoste} onChange={(ev) => setDraft((d) => ({ ...d, titrePoste: ev.target.value }))} />
      </Section>
      <Section icon={Briefcase} step={2} title="Expériences" hint="Une tâche par ligne.">
        {draft.experiences.map((e, i) => (
          <RowCard key={i} onRemove={() => removeFrom('experiences', i)} removeLabel={`Retirer l’expérience ${i + 1}`}>
            <Field label="Poste">
              <input className={inputClass} value={e.poste} onChange={(ev) => setExp(i, 'poste', ev.target.value)} />
            </Field>
            <Field label="Entreprise">
              <input className={inputClass} value={e.entreprise} onChange={(ev) => setExp(i, 'entreprise', ev.target.value)} />
            </Field>
            <Field label="Début">
              <input className={inputClass} value={e.debut} onChange={(ev) => setExp(i, 'debut', ev.target.value)} />
            </Field>
            <Field label="Fin">
              <input className={inputClass} value={e.fin} onChange={(ev) => setExp(i, 'fin', ev.target.value)} />
            </Field>
            <Field label="Lieu" className="sm:col-span-2">
              <input className={inputClass} value={e.lieu} onChange={(ev) => setExp(i, 'lieu', ev.target.value)} />
            </Field>
            <Field label="Tâches" className="sm:col-span-2">
              <textarea className={textareaClass} value={e.tachesText} onChange={(ev) => setExp(i, 'tachesText', ev.target.value)} />
            </Field>
          </RowCard>
        ))}
      </Section>
      <Section icon={GraduationCap} step={3} title="Formations et diplômes">
        {trainingRows('formations')}
        {draft.certifications.length > 0 && <p className="text-sm font-medium text-ink-soft">Certificats et formations qualifiantes</p>}
        {trainingRows('certifications')}
      </Section>
      <Section icon={Wrench} step={4} title="Compétences" hint="Une par ligne.">
        <Field label="Compétences techniques">
          <textarea className={textareaClass} value={draft.competencesText} onChange={(ev) => setDraft((d) => ({ ...d, competencesText: ev.target.value }))} />
        </Field>
        <Field label="Savoir-faire">
          <textarea className={textareaClass} value={draft.savoirFaireText} onChange={(ev) => setDraft((d) => ({ ...d, savoirFaireText: ev.target.value }))} />
        </Field>
      </Section>
      <Section icon={Languages} step={5} title="Langues">
        {draft.langues.map((l, i) => (
          <RowCard key={i} onRemove={() => removeFrom('langues', i)} removeLabel={`Retirer la langue ${i + 1}`}>
            <Field label="Langue">
              <input className={inputClass} value={l.langue} onChange={(ev) => setList('langues', i, 'langue', ev.target.value)} />
            </Field>
            <Field label="Niveau">
              <select className={inputClass} value={l.niveau} onChange={(ev) => setList('langues', i, 'niveau', ev.target.value)}>
                {[...new Set([...NIVEAUX, l.niveau])].filter(Boolean).map((n) => (
                  <option key={n} value={n}>
                    {n.charAt(0).toUpperCase() + n.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </RowCard>
        ))}
      </Section>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={isSaving}>
          Annuler
        </Button>
        <Button className="flex-1" onClick={save} disabled={isSaving}>
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}

// ---- The page -----------------------------------------------------------------------

function CvBuilder() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const uid = user?.id
  const [isLoading, setIsLoading] = useState(true)
  const [server, setServer] = useState(null)
  const [form, setForm] = useState(null)
  const [cv, setCv] = useState(null)
  const [step, setStep] = useState('form')
  const [editing, setEditing] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const wasPending = useRef(false)
  const topRef = useRef(null)

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const apply = useCallback(
    (state) => {
      setServer(state)
      if (state.cv) setCv(state.cv)
      if (wasPending.current && state.status === 'ready') {
        showToast('Votre CV est prêt !', 'success')
        setStep('cv')
        setEditing(false)
        scrollTop()
      }
      if (wasPending.current && state.status === 'error' && state.error) showToast(state.error, 'error')
      wasPending.current = state.status === 'pending'
    },
    [showToast],
  )

  // Draft on this phone first, then the copy saved with the last CV, then the profile.
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    fetchCv()
      .then((state) => {
        if (cancelled) return
        setForm(readDraft(uid) || state.form || initialForm(user, profile))
        if (state.cv && state.status !== 'pending') setStep('cv')
        apply(state)
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
    const check = () => fetchCv().then(apply).catch(() => {})
    const timer = setInterval(check, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pending, apply])

  function validate() {
    const next = {}
    if (!form.identite.nom.trim()) next.nom = 'Indiquez vos nom et prénoms.'
    if (!form.identite.telephones.trim()) next.telephones = 'Indiquez au moins un numéro.'
    if (!form.posteRecherche.trim()) next.posteRecherche = 'Indiquez le poste recherché.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Redoing the CV replaces the hand corrections: asked first.
  function readyToCreate() {
    if (!validate()) {
      showToast('Complétez les champs obligatoires (*).', 'error')
      scrollTop()
      return false
    }
    return !cv || window.confirm('Votre CV va être recréé à partir de vos informations : les corrections faites à la main seront remplacées. Continuer ?')
  }

  // Free: written on the phone, at once, no AI.
  function handleLocalCreate() {
    if (!readyToCreate()) return
    const written = writeCvLocally(form)
    setCv(written)
    setStep('cv')
    setEditing(false)
    scrollTop()
    showToast('Votre CV est prêt !', 'success')
    // Kept on the server too, to find it on another phone.
    saveCv({ form, cv: written }).then(apply).catch(() => {})
  }

  async function handleGenerate() {
    if (!readyToCreate()) return
    setBusy(true)
    try {
      wasPending.current = true
      apply(await generateCv(form))
      scrollTop()
    } catch (err) {
      wasPending.current = false
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdits(edited) {
    setBusy(true)
    try {
      apply(await saveCv({ cv: edited }))
      setCv(edited)
      setEditing(false)
      showToast('Modifications enregistrées.', 'success')
      scrollTop()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    if (!form.identite.nom.trim() || !form.identite.telephones.trim()) {
      showToast('Ajoutez vos nom et téléphone dans « Mes informations ».', 'error')
      setStep('form')
      validate()
      return
    }
    setBusy(true)
    try {
      await downloadCvPdf({ identite: form.identite, cv })
      saveCv({ form }).catch(() => {})
    } catch {
      showToast('Le PDF n’a pas pu être créé. Réessayez.', 'error')
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
  // The AI only when the server has a key; otherwise the free way, always there.
  const aiMode = !!server?.available
  const aiReady = aiMode && remaining > 0

  return (
    <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-20 px-4 py-6 pb-28 desktop:pb-10">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-1 via-brand-2 to-brand-3 text-white shadow-md shadow-violet-500/25">
          <FileText size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Mon CV PNPE</h1>
          <p className="mt-0.5 text-sm text-ink-soft/70">{aiMode ? 'Un CV aux normes du PNPE, rédigé avec l’IA, prêt à envoyer.' : 'Un CV aux normes du PNPE, gratuit, prêt à envoyer.'}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-ink/[0.05] p-1" role="tablist">
        {[
          ['form', '1. Mes informations'],
          ['cv', '2. Mon CV'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={step === key}
            disabled={key === 'cv' && !cv}
            onClick={() => {
              setStep(key)
              setEditing(false)
            }}
            className={`rounded-full py-2 text-sm font-semibold transition disabled:opacity-40 ${step === key ? 'bg-white text-violet-700 shadow dark:bg-surface-tint' : 'text-ink-soft'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {pending && (
        <div className="glass-panel mt-5 flex items-center gap-3 rounded-2xl p-4" role="status">
          <Spinner />
          <div>
            <p className="text-sm font-semibold text-ink">L’IA rédige votre CV…</p>
            <p className="text-xs text-ink-soft/80">20 à 60 secondes. Vous pouvez quitter l’application, votre CV sera là à votre retour.</p>
          </div>
        </div>
      )}

      {step === 'form' && (
        <div className="mt-5">
          <CvForm form={form} setForm={setForm} errors={errors} aiMode={aiMode} />

          <div className="mt-5 space-y-3">
            {aiReady ? (
              <>
                <Button className="flex w-full items-center justify-center gap-2" onClick={handleGenerate} disabled={busy || pending}>
                  <Sparkles size={17} />
                  {cv ? 'Recréer mon CV avec l’IA' : 'Créer mon CV avec l’IA'}
                </Button>
                <p className="text-center text-xs text-ink-soft/80">
                  {`${remaining} création${remaining > 1 ? 's' : ''} avec l’IA restante${remaining > 1 ? 's' : ''} aujourd’hui.`}{' '}
                  <button type="button" onClick={handleLocalCreate} disabled={busy || pending} className="font-semibold text-violet-600 underline-offset-2 hover:underline">
                    Ou créer sans IA, tout de suite
                  </button>
                </p>
              </>
            ) : (
              <>
                <Button className="flex w-full items-center justify-center gap-2" onClick={handleLocalCreate} disabled={busy || pending}>
                  <FileText size={17} />
                  {cv ? 'Recréer mon CV' : 'Créer mon CV'}
                </Button>
                <p className="text-center text-xs text-ink-soft/80">
                  {aiMode ? 'Plus de création avec l’IA aujourd’hui : votre CV est préparé sans IA, gratuitement.' : 'Gratuit et illimité. Vous pourrez corriger le texte avant de télécharger le PDF.'}
                </p>
              </>
            )}
            <p className="flex items-start gap-2 rounded-xl bg-ink/[0.03] p-3 text-[11px] leading-relaxed text-ink-soft/80">
              <ShieldCheck size={15} className="mt-px shrink-0 text-mint-600" />
              {aiReady
                ? 'Avec l’IA, seuls votre poste recherché, vos expériences, formations, compétences et langues sont envoyés à Claude (Anthropic) pour la rédaction. Votre nom et vos coordonnées restent chez BomaVibes. Vérifiez toujours votre CV avant de l’envoyer.'
                : 'Votre CV est préparé directement sur votre téléphone : rien n’est envoyé à une IA. Vérifiez-le toujours avant de l’envoyer.'}
            </p>
          </div>
        </div>
      )}

      {step === 'cv' && cv && !editing && (
        <div className="mt-5 space-y-4">
          {cv.conseils?.length > 0 && (
            <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Lightbulb size={16} className="text-gold" /> Conseils pour votre CV (non imprimés)
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {cv.conseils.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <CvPaper identite={form.identite} cv={cv} />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button className="flex items-center justify-center gap-2" onClick={handleDownload} disabled={busy}>
              <Download size={17} /> Télécharger le PDF
            </Button>
            <Button variant="secondary" className="flex items-center justify-center gap-2" onClick={() => setEditing(true)} disabled={busy}>
              <Pencil size={16} /> Corriger le texte
            </Button>
          </div>
          <p className="text-center text-xs text-ink-soft/80">
            Relisez votre CV avant de l’envoyer. Une information à changer dans l’en-tête ? Modifiez-la dans « 1. Mes informations ».
          </p>
        </div>
      )}

      {step === 'cv' && cv && editing && (
        <div className="mt-5">
          <CvEditor cv={cv} onSave={handleSaveEdits} onCancel={() => setEditing(false)} isSaving={busy} />
        </div>
      )}
    </div>
  )
}

export default CvBuilder
