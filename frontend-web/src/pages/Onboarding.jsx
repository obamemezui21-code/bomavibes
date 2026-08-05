import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Mars, Minus, NonBinary, Plus, Venus, X } from 'lucide-react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { uploadProfilePhotos } from '../firebase/photos.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const INTEREST_OPTIONS = [
  'Danse', 'Cuisine', 'Voyages', 'Musique', 'Sport', 'Cinéma',
  'Lecture', 'Photo', 'Nature', 'Art', 'Café', 'Randonnée', 'Mode', 'Business',
]

const GENDER_OPTIONS = [
  { value: 'FEMME', label: 'Femme', Icon: Venus },
  { value: 'HOMME', label: 'Homme', Icon: Mars },
  { value: 'AUTRE', label: 'Autre', Icon: NonBinary },
]

const MIN_AGE = 18
const MAX_AGE = 80

const inputClass =
  'w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white dark:focus:bg-ink/[0.06] focus:ring-4 focus:ring-violet-400/15'
const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80'

const STEPS = ['Photos', 'À propos de vous', 'Vos centres d\'intérêt', 'Vos préférences']

function Onboarding() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    photos: [],
    age: 25,
    gender: '',
    bio: '',
    interests: [],
    prefGender: 'TOUS',
    prefMaxDistance: 25,
  })

  function handleAddPhotos(e) {
    const files = Array.from(e.target.files || []).slice(0, 3 - form.photos.length)
    const entries = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    setForm((f) => ({ ...f, photos: [...f.photos, ...entries].slice(0, 3) }))
    e.target.value = ''
  }

  function removePhoto(index) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== index) }))
  }

  function toggleInterest(interest) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter((i) => i !== interest)
        : [...f.interests, interest],
    }))
  }

  function goNext() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else finish()
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  async function handleCancel() {
    await logout()
    navigate('/')
  }

  async function finish() {
    setIsSaving(true)
    try {
      const photoUrls = (await uploadProfilePhotos(user.id, form.photos.map((p) => p.file))).filter(Boolean)

      await setDoc(
        doc(db, 'users', user.id),
        {
          firstName: user?.firstName || '',
          prefGender: form.prefGender,
          prefMaxDistance: form.prefMaxDistance,
          onboarded: true,
        },
        { merge: true },
      )

      await setDoc(
        doc(db, 'profiles', user.id),
        {
          firstName: user?.firstName || '',
          age: form.age ? Number(form.age) : null,
          gender: form.gender || null,
          bio: form.bio || null,
          interests: form.interests,
          photos: photoUrls,
          verified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch {
      setIsSaving(false)
      showToast("Impossible d'enregistrer votre profil, réessayez.", 'error')
      return
    }
    setIsSaving(false)
    showToast(`Bienvenue sur BomaVibes, ${user?.firstName || ''} 🎉`, 'success')
    navigate('/discover', { replace: true })
  }

  const canContinue =
    step === 0 ? true : step === 1 ? form.age && form.gender : step === 2 ? form.interests.length >= 3 : true

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-surface-soft px-4 py-8 md:items-center md:justify-center">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-mint-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-violet-500/10 blur-[100px]" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-ink-soft/60">
            <span>{STEPS[step]}</span>
            <div className="flex items-center gap-2">
              <span>{step + 1} / {STEPS.length}</span>
              <button
                type="button"
                onClick={handleCancel}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-ink/5 hover:text-ink"
                aria-label="Annuler l'inscription"
                title="Annuler l'inscription"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        <div className="glass-panel overflow-hidden rounded-[28px] p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">Ajoutez vos photos</h2>
                  <p className="mt-1 text-sm text-ink-soft/60">
                    Un profil avec au moins une photo reçoit bien plus de matchs.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => {
                      const src = form.photos[i]?.previewUrl
                      return (
                        <div
                          key={i}
                          className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-ink/15 bg-ink/[0.03]"
                        >
                          {src ? (
                            <>
                              <img src={src} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removePhoto(i)}
                                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                                aria-label="Retirer la photo"
                              >
                                <X size={13} strokeWidth={2.5} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex h-full w-full items-center justify-center text-2xl text-ink-soft/40 transition hover:text-violet-600"
                              aria-label="Ajouter une photo"
                            >
                              +
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddPhotos}
                  />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="font-display text-xl font-semibold text-ink">Parlez-nous de vous</h2>

                  <div>
                    <label className={labelClass}>Âge</label>
                    <div className="flex items-center gap-3 rounded-2xl bg-ink/[0.03] p-4">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, age: Math.max(MIN_AGE, f.age - 1) }))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white dark:bg-surface-tint text-ink/70 shadow-sm transition hover:text-violet-600"
                        aria-label="Diminuer l'âge"
                      >
                        <Minus size={16} />
                      </button>

                      <div className="flex-1">
                        <p className="mb-1 text-center font-display text-3xl font-semibold text-ink">
                          {form.age} <span className="text-base font-medium text-ink-soft/60">ans</span>
                        </p>
                        <input
                          type="range"
                          min={MIN_AGE}
                          max={MAX_AGE}
                          value={form.age}
                          onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) }))}
                          className="w-full accent-violet-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, age: Math.min(MAX_AGE, f.age + 1) }))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white dark:bg-surface-tint text-ink/70 shadow-sm transition hover:text-violet-600"
                        aria-label="Augmenter l'âge"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Genre</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {GENDER_OPTIONS.map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, gender: value }))}
                          className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3.5 text-sm font-medium transition ${
                            form.gender === value
                              ? 'border-violet-400 bg-violet-500/10 text-violet-600'
                              : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
                          }`}
                        >
                          <Icon size={22} strokeWidth={2} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Bio</label>
                    <textarea
                      rows="3"
                      maxLength="280"
                      placeholder="Parlez un peu de vous..."
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">Vos centres d'intérêt</h2>
                  <p className="mt-1 text-sm text-ink-soft/60">Choisissez-en au moins 3.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((interest) => {
                      const selected = form.interests.includes(interest)
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                            selected
                              ? 'border-violet-400 bg-violet-500/15 text-violet-600'
                              : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
                          }`}
                        >
                          {interest}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <h2 className="font-display text-xl font-semibold text-ink">Vos préférences</h2>
                  <div>
                    <p className={labelClass}>Vous recherchez</p>
                    <div className="flex gap-2">
                      {[
                        { value: 'TOUS', label: 'Tout le monde' },
                        { value: 'FEMME', label: 'Femmes' },
                        { value: 'HOMME', label: 'Hommes' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, prefGender: opt.value }))}
                          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            form.prefGender === opt.value
                              ? 'border-violet-400 bg-violet-500/10 text-violet-600'
                              : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-ink/80">
                      Distance maximale : {form.prefMaxDistance} km
                    </p>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={form.prefMaxDistance}
                      onChange={(e) => setForm((f) => ({ ...f, prefMaxDistance: Number(e.target.value) }))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl border border-ink/12 px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
              >
                Retour
              </button>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={goNext}
              disabled={!canContinue || isSaving}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Finalisation…' : step === STEPS.length - 1 ? 'Terminer' : 'Continuer'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
