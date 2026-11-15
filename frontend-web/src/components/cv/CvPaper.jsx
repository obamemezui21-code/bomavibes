import { useState } from 'react'
import { permisLabel } from '../../lib/cvPdf.js'
import { inputClass } from '../../lib/formStyles.js'
import Button from '../ui/Button.jsx'
import { Field, LevelPills, RemoveButton, StepCard } from './CvUi.jsx'
import { lines, textareaClass } from './cvShared.js'

// The CV as it will print (same sections, same order as lib/cvPdf.js), and
// the hand-corrections editor.

function PaperSection({ title, children }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-violet-700">{title}</h3>
      <div className="mb-2 mt-1 h-0.5 w-6 rounded bg-violet-600" />
      {children}
    </div>
  )
}

const period = (e) => [e.debut, e.fin].filter(Boolean).join(' – ')

export function CvPaper({ identite, cv, compact = false }) {
  const contact = [identite.telephones && `Tél. / WhatsApp : ${identite.telephones}`, identite.email, [identite.ville, identite.quartier].filter(Boolean).join(', ')].filter(Boolean)
  const admin = [identite.numeroPnpe && `N° PNPE : ${identite.numeroPnpe}`, permisLabel(identite.permis)].filter(Boolean)
  const text = compact ? 'text-[13px]' : 'text-sm'
  const trainings = (items) =>
    items.map((f, i) => (
      <div key={i} className={`mb-2 grid grid-cols-[5rem_1fr] gap-3 ${text}`}>
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
      <div className={compact ? 'p-4' : 'p-5 sm:p-8'}>
        <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold leading-tight`}>{identite.nom || 'Nom et prénoms'}</h2>
        <p className={`mt-1 font-bold text-[#6a4693] ${compact ? 'text-sm' : 'text-base'}`}>{cv.titrePoste || 'Poste recherché'}</p>
        {contact.length > 0 && <p className="mt-2 text-xs text-[#635a65]">{contact.join('   |   ')}</p>}
        {admin.length > 0 && <p className="text-xs text-[#635a65]">{admin.join('   |   ')}</p>}
        <hr className="mt-3 border-[#ddd6e2]" />

        {cv.experiences?.length > 0 && (
          <PaperSection title="Expériences professionnelles">
            {cv.experiences.map((e, i) => (
              <div key={i} className={`mb-3 grid grid-cols-[5rem_1fr] gap-3 ${text}`}>
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
                <p className={`mb-1.5 mt-3 font-semibold text-[#635a65] ${text}`}>Certificats et formations qualifiantes</p>
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
                  <div key={label} className={`mb-2 ${text}`}>
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
            <ul className={`list-disc space-y-0.5 pl-4 marker:text-[#6a4693] ${text}`}>
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

// Hand corrections, no AI: one line per task or skill.
export function CvEditor({ cv, onSave, onCancel, isSaving }) {
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
      <div key={`${key}-${i}`} className="rounded-2xl border border-ink/10 p-3">
        <div className="flex items-start gap-2">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Intitulé" className="sm:col-span-2">
              <input className={inputClass} value={f.intitule} onChange={(ev) => setList(key, i, 'intitule', ev.target.value)} />
            </Field>
            <Field label="Établissement">
              <input className={inputClass} value={f.etablissement} onChange={(ev) => setList(key, i, 'etablissement', ev.target.value)} />
            </Field>
            <Field label="Année">
              <input className={inputClass} value={f.annee} onChange={(ev) => setList(key, i, 'annee', ev.target.value)} />
            </Field>
          </div>
          <RemoveButton onClick={() => removeFrom(key, i)} label="Retirer" />
        </div>
      </div>
    ))

  return (
    <div className="space-y-4">
      <StepCard title="Corriger le texte" subtitle="Changez ce que vous voulez : rien n’est envoyé à une IA. Une tâche ou une compétence par ligne.">
        <Field label="Titre du poste">
          <input className={inputClass} value={draft.titrePoste} onChange={(ev) => setDraft((d) => ({ ...d, titrePoste: ev.target.value }))} />
        </Field>
      </StepCard>
      <StepCard title="Expériences">
        {draft.experiences.map((e, i) => (
          <div key={i} className="rounded-2xl border border-ink/10 p-3">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
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
              </div>
              <RemoveButton onClick={() => removeFrom('experiences', i)} label={`Retirer l’expérience ${i + 1}`} />
            </div>
          </div>
        ))}
      </StepCard>
      <StepCard title="Formations et diplômes">
        {trainingRows('formations')}
        {draft.certifications.length > 0 && <p className="text-sm font-medium text-ink-soft">Certificats et formations qualifiantes</p>}
        {trainingRows('certifications')}
      </StepCard>
      <StepCard title="Compétences">
        <Field label="Compétences techniques">
          <textarea className={textareaClass} value={draft.competencesText} onChange={(ev) => setDraft((d) => ({ ...d, competencesText: ev.target.value }))} />
        </Field>
        <Field label="Savoir-faire">
          <textarea className={textareaClass} value={draft.savoirFaireText} onChange={(ev) => setDraft((d) => ({ ...d, savoirFaireText: ev.target.value }))} />
        </Field>
      </StepCard>
      <StepCard title="Langues">
        {draft.langues.map((l, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl border border-ink/10 p-3">
            <div className="flex-1 space-y-2">
              <input className={inputClass} value={l.langue} onChange={(ev) => setList('langues', i, 'langue', ev.target.value)} aria-label="Langue" />
              <LevelPills value={l.niveau} onChange={(n) => setList('langues', i, 'niveau', n)} />
            </div>
            <RemoveButton onClick={() => removeFrom('langues', i)} label={`Retirer la langue ${i + 1}`} />
          </div>
        ))}
      </StepCard>
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
