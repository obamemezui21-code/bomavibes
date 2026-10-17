import { useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, Square, Trash2 } from 'lucide-react'
import { VOICE_PROMPTS, VOICE_PROMPT_MAX_SECONDS } from '../lib/onboardingOptions.js'
import { inputClass, labelClass } from '../lib/formStyles.js'
import { deleteVoicePrompt, uploadVoicePrompt } from '../firebase/voiceNotes.js'
import { useToast } from '../context/ToastContext.jsx'
import VoicePromptPlayer from './VoicePromptPlayer.jsx'

// Profile page: record (or replace / remove) the voice prompt. Saved right
// away through the backend, independently of the profile form's "Enregistrer".
function VoicePromptEditor({ voicePrompt: initial }) {
  const { showToast } = useToast()
  const [voicePrompt, setVoicePrompt] = useState(initial || null)
  const [question, setQuestion] = useState(initial?.question || VOICE_PROMPTS[0])
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [isBusy, setIsBusy] = useState(false)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const secondsRef = useRef(0)
  const timerRef = useRef(null)

  function teardown() {
    clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => teardown, [])

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      recorder.onstop = save
      recorder.start()
      secondsRef.current = 0
      setSeconds(0)
      setIsRecording(true)
      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
        if (secondsRef.current >= VOICE_PROMPT_MAX_SECONDS) stop()
      }, 1000)
    } catch {
      showToast('Autorisez le micro pour enregistrer votre voix.', 'error')
    }
  }

  function stop() {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
    setIsRecording(false)
    clearInterval(timerRef.current)
  }

  async function save() {
    const duration = secondsRef.current
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' })
    teardown()
    if (duration < 2) {
      showToast('Enregistrement trop court, parlez au moins 2 secondes.', 'error')
      return
    }
    setIsBusy(true)
    try {
      setVoicePrompt(await uploadVoicePrompt(blob, question, duration))
      showToast('Note vocale ajoutée à votre profil 🎤', 'success')
    } catch {
      showToast("Impossible d'enregistrer la note vocale, réessayez.", 'error')
    } finally {
      setIsBusy(false)
    }
  }

  async function remove() {
    setIsBusy(true)
    try {
      await deleteVoicePrompt()
      setVoicePrompt(null)
    } catch {
      showToast('Impossible de supprimer la note vocale, réessayez.', 'error')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div>
      <label className={labelClass}>
        Ma voix <span className="font-normal text-ink-soft/50">(facultatif, {VOICE_PROMPT_MAX_SECONDS} s max)</span>
      </label>
      <p className="-mt-1 mb-3 text-xs text-ink-soft/60">Une note vocale sur votre profil : rien de tel pour briser la glace.</p>

      {voicePrompt && !isRecording ? (
        <div className="space-y-2">
          <VoicePromptPlayer key={voicePrompt.url} voicePrompt={voicePrompt} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={start}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/12 py-2 text-xs font-semibold text-ink/80 transition hover:bg-ink/5 disabled:opacity-60"
            >
              <RotateCcw size={13} strokeWidth={2.5} />
              Réenregistrer
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={remove}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-coral-500/30 py-2 text-xs font-semibold text-coral-500 transition hover:bg-coral-500/5 disabled:opacity-60"
            >
              <Trash2 size={13} strokeWidth={2.5} />
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink/10 bg-surface-soft p-3">
          <select
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isRecording || isBusy}
            aria-label="Question"
            className={`${inputClass} font-semibold text-violet-600`}
          >
            {VOICE_PROMPTS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isBusy}
            onClick={isRecording ? stop : start}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${
              isRecording ? 'bg-coral-500' : 'bg-gradient-to-r from-violet-500 to-pink-500'
            }`}
          >
            {isRecording ? (
              <>
                <Square size={14} strokeWidth={2.5} fill="currentColor" />
                Terminer · {seconds}/{VOICE_PROMPT_MAX_SECONDS} s
              </>
            ) : (
              <>
                <Mic size={16} strokeWidth={2.25} />
                {isBusy ? 'Envoi…' : 'Enregistrer ma réponse'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default VoicePromptEditor
