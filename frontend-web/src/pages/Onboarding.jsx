import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const INTEREST_OPTIONS = [
  'Danse', 'Cuisine', 'Voyages', 'Musique', 'Sport', 'Cinéma',
  'Lecture', 'Photo', 'Nature', 'Art', 'Café', 'Randonnée', 'Mode', 'Business',
]

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-cream-100 placeholder-cream-300/30 outline-none transition focus:border-gold-400/60 focus:bg-white/[0.07] focus:ring-4 focus:ring-gold-400/10'
const labelClass = 'mb-1.5 block text-sm font-medium text-cream-200'

const STEPS = ['Photos', 'À propos de toi', 'Tes centres d\'intérêt', 'Tes préférences']

function Onboarding() {
  const { user, token } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    photos: [],
    age: '',
    gender: '',
    bio: '',
    interests: [],
    prefGender: 'TOUS',
    prefMaxDistance: 25,
  })

  function handleAddPhotos(e) {
    const files = Array.from(e.target.files || []).slice(0, 3 - form.photos.length)
    const urls = files.map((f) => URL.createObjectURL(f))
    setForm((f) => ({ ...f, photos: [...f.photos, ...urls].slice(0, 3) }))
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

  async function finish() {
    setIsSaving(true)
    try {
      await fetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: user?.firstName || '',
          age: form.age || null,
          gender: form.gender || null,
          bio: form.bio || null,
        }),
      })
    } catch {
      // Non-blocking: onboarding still completes even if the profile sync fails.
    } finally {
      setIsSaving(false)
      showToast(`Bienvenue sur BomaVibes, ${user?.firstName || ''} 🎉`, 'success')
      navigate('/discover', { replace: true })
    }
  }

  const canContinue =
    step === 0 ? true : step === 1 ? form.age && form.gender : step === 2 ? form.interests.length >= 3 : true

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-ink px-4 py-8 md:items-center md:justify-center">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-forest-500/20 blur-[100px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-gold-500/10 blur-[100px]" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs text-cream-300/60">
            <span>{STEPS[step]}</span>
            <span>{step + 1} / {STEPS.length}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400"
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
                  <h2 className="font-display text-xl font-semibold text-cream-100">Ajoute tes photos</h2>
                  <p className="mt-1 text-sm text-cream-300/60">
                    Un profil avec au moins une photo reçoit bien plus de matchs.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => {
                      const src = form.photos[i]
                      return (
                        <div
                          key={i}
                          className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/5"
                        >
                          {src ? (
                            <>
                              <img src={src} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removePhoto(i)}
                                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                                aria-label="Retirer la photo"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex h-full w-full items-center justify-center text-2xl text-cream-300/40 transition hover:text-gold-400"
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
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-cream-100">Parle-nous de toi</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Âge</label>
                      <input
                        type="number"
                        min="18"
                        max="120"
                        value={form.age}
                        onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Genre</label>
                      <select
                        value={form.gender}
                        onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="" className="bg-forest-950">Choisir</option>
                        <option value="FEMME" className="bg-forest-950">Femme</option>
                        <option value="HOMME" className="bg-forest-950">Homme</option>
                        <option value="AUTRE" className="bg-forest-950">Autre</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Bio</label>
                    <textarea
                      rows="3"
                      maxLength="280"
                      placeholder="Parle un peu de toi..."
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="font-display text-xl font-semibold text-cream-100">Tes centres d'intérêt</h2>
                  <p className="mt-1 text-sm text-cream-300/60">Choisis-en au moins 3.</p>
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
                              ? 'border-gold-400/60 bg-gold-400/15 text-gold-400'
                              : 'border-white/10 text-cream-300/70 hover:bg-white/5'
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
                  <h2 className="font-display text-xl font-semibold text-cream-100">Tes préférences</h2>
                  <div>
                    <p className={labelClass}>Tu recherches</p>
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
                              ? 'border-gold-400/60 bg-gold-400/10 text-gold-400'
                              : 'border-white/10 text-cream-300/70 hover:bg-white/5'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-cream-200">
                      Distance maximale : {form.prefMaxDistance} km
                    </p>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={form.prefMaxDistance}
                      onChange={(e) => setForm((f) => ({ ...f, prefMaxDistance: Number(e.target.value) }))}
                      className="w-full accent-gold-400"
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
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-cream-200 transition hover:bg-white/5"
              >
                Retour
              </button>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={goNext}
              disabled={!canContinue || isSaving}
              className="flex-1 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 py-2.5 text-sm font-semibold text-forest-950 shadow-lg shadow-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
