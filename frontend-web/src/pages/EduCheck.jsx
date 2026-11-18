import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FileSearch, GitCompare, History, Lock, ShieldCheck } from 'lucide-react'
import { fetchEduAccess } from '../firebase/eduCheck.js'
import Spinner from '../components/ui/Spinner.jsx'
import AnalyzePanel from '../components/eduCheck/AnalyzePanel.jsx'
import ComparePanel from '../components/eduCheck/ComparePanel.jsx'
import HistoryPanel from '../components/eduCheck/HistoryPanel.jsx'
import { Disclaimer } from '../components/eduCheck/eduUi.jsx'

// EDU-CHECK — assistant de vérification des devoirs (Outils pédagogiques).
// For the teachers and pedagogical leads given access (scripts/setEduRole.js).
// Everything is analysed on our server, locally: no paid AI per analysis.

const VIEWS = {
  analyze: { label: 'Analyser un devoir', icon: FileSearch, text: 'Importer un devoir, choisir les analyses, obtenir un rapport détaillé.' },
  compare: { label: 'Comparer plusieurs devoirs', icon: GitCompare, text: 'Style, vocabulaire et structure de 2 à 5 textes côte à côte.' },
  history: { label: 'Historique des analyses', icon: History, text: 'Retrouver, filtrer et télécharger les analyses, tableau de bord.' },
}

function EduCheck() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState(null)

  useEffect(() => {
    fetchEduAccess()
      .then(setConfig)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="min-h-svh bg-surface-soft pb-24 desktop:min-h-full desktop:pb-8">
      <div className="flex items-center gap-2 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => (view ? setView(null) : navigate(-1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold text-ink">EDU-CHECK</h1>
          <p className="truncate text-xs text-ink-soft">{view ? VIEWS[view].label : 'Assistant intelligent de vérification des devoirs'}</p>
        </div>
        {config?.allowed && (
          <span className="hidden items-center gap-1 rounded-full bg-violet-600/10 px-2.5 py-1 text-[11px] font-bold text-violet-700 sm:inline-flex dark:text-violet-300">
            <ShieldCheck size={13} /> {config.role === 'lead' ? `Responsable${config.org ? ` · ${config.org}` : ''}` : 'Enseignant'}
          </span>
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        {error && <p className="text-sm text-coral-500">{error}</p>}
        {!config && !error && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {config && !config.allowed && (
          <div className="mx-auto max-w-md rounded-3xl bg-surface p-6 text-center shadow-sm">
            <Lock size={30} className="mx-auto text-violet-600" />
            <h2 className="mt-3 font-display text-lg font-bold text-ink">Réservé aux enseignants</h2>
            <p className="mt-2 text-sm text-ink-soft">
              EDU-CHECK aide les enseignants et les responsables pédagogiques à examiner les devoirs. L’accès est accordé par l’administrateur de BomaVibes à
              chaque enseignant ou établissement.
            </p>
          </div>
        )}

        {config?.allowed && (
          <div className="space-y-4">
            <Disclaimer text={config.disclaimer} />
            {!view && (
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(VIEWS).map(([key, v]) => {
                  const Icon = v.icon
                  return (
                    <button key={key} type="button" onClick={() => setView(key)} className="group flex flex-col rounded-3xl border border-ink/8 bg-surface p-4 text-left shadow-sm transition hover:border-violet-300">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600">
                        <Icon size={22} />
                      </span>
                      <span className="mt-3 flex items-center gap-1 font-display text-base font-bold text-ink">
                        {v.label}
                        <ChevronRight size={16} className="text-ink-soft transition group-hover:translate-x-0.5" />
                      </span>
                      <span className="mt-1 text-xs text-ink-soft">{v.text}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {!view && (
              <p className="text-xs text-ink-soft">
                Analyse locale et gratuite : statistiques du texte, règles d’écriture, vérification des références dans Crossref et OpenAlex
                {config.sourceVerification ? '' : ' (désactivée sur ce serveur)'}. Aucun modèle d’IA payant n’est utilisé.
              </p>
            )}
            {view === 'analyze' && <AnalyzePanel config={config} onOpenHistory={() => setView('history')} />}
            {view === 'compare' && <ComparePanel config={config} />}
            {view === 'history' && <HistoryPanel config={config} />}
          </div>
        )}
      </div>
    </div>
  )
}

export default EduCheck
