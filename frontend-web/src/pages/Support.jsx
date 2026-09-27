import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SupportForm from '../components/SupportForm.jsx'

function Support() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-svh overflow-hidden bg-surface-soft p-6 pb-24 desktop:min-h-full desktop:pb-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-coral-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl font-semibold text-ink">Construisons BomaVibes ensemble</h1>
        </div>

        <SupportForm />
      </div>
    </div>
  )
}

export default Support
