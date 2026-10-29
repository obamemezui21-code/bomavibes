import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, Mars, Minus, NonBinary, Plus, RotateCw, Venus, X } from 'lucide-react'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { appealPhoto, uploadProfilePhoto } from '../firebase/photos.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { findCountry, findRegion } from '../lib/geography.js'
import { MIN_PHOTO_SIDE, MIN_PROFILE_PHOTOS, PHOTO_NOT_HD_MESSAGE, isHdPhoto } from '../lib/photoQuality.js'
import CountryPicker from '../components/CountryPicker.jsx'
import SearchSelect from '../components/SearchSelect.jsx'
import ProfileLaunchOverlay from '../components/ProfileLaunchOverlay.jsx'
import { FullPageSpinner } from '../components/ui/Spinner.jsx'
import {
  DATING_GOALS,
  LANGUAGES,
  LIFESTYLE_GROUPS,
  MAX_PERSONALITY_TRAITS,
  PERSONALITY_TRAITS,
  RELIGIONS,
} from '../lib/onboardingOptions.js'
import { inputClass, labelClass, chipClass } from '../lib/formStyles.js'

const INTEREST_OPTIONS = [
  'Danse', 'Cuisine', 'Voyages', 'Musique', 'Sport', 'Cinéma',
  'Lecture', 'Photo', 'Nature', 'Art', 'Café', 'Randonnée', 'Mode', 'Business',
  'Football', 'Fitness', 'Technologie', 'Entrepreneuriat', 'Jeux vidéo',
  'Culture africaine', 'Spiritualité', 'Famille',
]

const GENDER_OPTIONS = [
  { value: 'FEMME', label: 'Femme', Icon: Venus },
  { value: 'HOMME', label: 'Homme', Icon: Mars },
  { value: 'AUTRE', label: 'Autre', Icon: NonBinary },
]

// firestore.rules refuses a profile with more than 20 interests: the
// save failed with no explanation for anyone who ticked 21 or 22.
const MAX_INTERESTS = 20

const MIN_AGE = 18
const MAX_AGE = 80

const STEPS = [
  'Photos',
  'À propos de vous',
  'Où vous êtes',
  'Vos centres d\'intérêt',
  'Langues & personnalité',
  'Style de vie',
  'Vos préférences',
]

function Onboarding() {
  const { user, profile, isProfileLoading, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  // Last upload per server slot: a new photo reusing a freed slot waits for
  // the removed photo's upload so it can't be overwritten by it afterwards.
  const slotUploadsRef = useRef([null, null, null])

  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [form, setForm] = useState({
    photos: [],
    age: 25,
    gender: '',
    bio: '',
    interests: [],
    country: '',
    region: '',
    city: '',
    languages: [],
    personalityTraits: [],
    datingGoal: '',
    isEntrepreneur: false,
    religion: '',
    isTraveling: false,
    lifestyle: { sport: '', travel: '', smoking: '', alcohol: '' },
    prefGender: 'TOUS',
    prefMaxDistance: 25,
  })

  // Photos start uploading as soon as they're picked: the server checks each
  // one (HD, a real photo of a person with the face visible) and the tile
  // shows the verdict. status: checking → ok | refused | failed (network).
  function startUpload(slot, file) {
    const previous = slotUploadsRef.current[slot] || Promise.resolve()
    const upload = previous.then(() => uploadProfilePhoto(user.id, slot, file))
    slotUploadsRef.current[slot] = upload.catch(() => null)
    return upload
  }

  function updatePhoto(id, patch) {
    setForm((f) => ({ ...f, photos: f.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  }

  function checkPhoto({ id, slot, file }) {
    updatePhoto(id, { status: 'checking', message: null })
    startUpload(slot, file).then(
      (url) => updatePhoto(id, { status: 'ok', url }),
      (err) => {
        const refused = Boolean(err?.code?.startsWith('photo-'))
        if (refused) showToast(err.message, 'error')
        updatePhoto(id, refused ? { status: 'refused', message: err.message, refusalId: err.refusalId || null } : { status: 'failed' })
      },
    )
  }

  // "Ce n'est pas correct": a moderator looks at the refused photo; validated,
  // it's added to the profile.
  async function requestReview(photo) {
    try {
      await appealPhoto({ refusalId: photo.refusalId, slot: photo.slot })
      updatePhoto(photo.id, { appealed: true })
      showToast('Demande envoyée : l’équipe va vérifier ta photo.', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleAddPhotos(e) {
    const picked = Array.from(e.target.files || []).slice(0, 3 - form.photos.length)
    e.target.value = ''
    const hd = await Promise.all(picked.map(isHdPhoto))
    const files = picked.filter((_, i) => hd[i])
    if (files.length < picked.length) showToast(PHOTO_NOT_HD_MESSAGE, 'error')
    if (!files.length) return
    const freeSlots = [0, 1, 2].filter((slot) => !form.photos.some((p) => p.slot === slot))
    const entries = files.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      file,
      slot: freeSlots[i],
      previewUrl: URL.createObjectURL(file),
      status: 'checking',
    }))
    setForm((f) => ({ ...f, photos: [...f.photos, ...entries].slice(0, 3) }))
    entries.forEach(checkPhoto)
  }

  function removePhoto(index) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== index) }))
  }

  function toggleInterest(interest) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter((i) => i !== interest)
        : f.interests.length >= MAX_INTERESTS
          ? f.interests
          : [...f.interests, interest],
    }))
  }

  function toggleLanguage(language) {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(language)
        ? f.languages.filter((l) => l !== language)
        : [...f.languages, language],
    }))
  }

  function togglePersonalityTrait(trait) {
    setForm((f) => {
      if (f.personalityTraits.includes(trait)) {
        return { ...f, personalityTraits: f.personalityTraits.filter((t) => t !== trait) }
      }
      if (f.personalityTraits.length >= MAX_PERSONALITY_TRAITS) return f
      return { ...f, personalityTraits: [...f.personalityTraits, trait] }
    })
  }

  function selectCountry(code) {
    setForm((f) => (f.country === code ? f : { ...f, country: code, region: '', city: '' }))
  }

  function selectRegion(name) {
    setForm((f) => (f.region === name ? f : { ...f, region: name, city: '' }))
  }

  function selectCity(name) {
    setForm((f) => ({ ...f, city: name }))
  }

  function setLifestyle(key, value) {
    setForm((f) => ({ ...f, lifestyle: { ...f.lifestyle, [key]: value } }))
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
    // Only photos the server accepted; the photo step can't be left without
    // enough of them, so this is a last guard.
    const photoUrls = form.photos.filter((p) => p.status === 'ok').map((p) => p.url)
    if (photoUrls.length < MIN_PROFILE_PHOTOS) {
      showToast(`Ajoutez au moins ${MIN_PROFILE_PHOTOS} photos de vous.`, 'error')
      setStep(0)
      return
    }
    setIsSaving(true)
    try {
      // Both docs in one round trip instead of two sequential writes.
      const batch = writeBatch(db)
      batch.set(
        doc(db, 'users', user.id),
        {
          // email is required by the users rule: if the account doc was
          // never created, this merge is a create and must carry it.
          email: user?.email || '',
          firstName: user?.firstName || '',
          prefGender: form.prefGender,
          prefMaxDistance: form.prefMaxDistance,
          onboarded: true,
        },
        { merge: true },
      )
      batch.set(
        doc(db, 'profiles', user.id),
        {
          firstName: user?.firstName || '',
          age: form.age ? Number(form.age) : null,
          gender: form.gender || null,
          bio: form.bio || null,
          interests: form.interests,
          country: findCountry(form.country)?.name || null,
          countryCode: form.country || null,
          region: form.region || null,
          city: form.city || null,
          languages: form.languages,
          personalityTraits: form.personalityTraits,
          datingGoal: form.datingGoal || null,
          isEntrepreneur: form.isEntrepreneur,
          religion: form.religion || null,
          isTraveling: form.isTraveling,
          lifestyle: form.lifestyle,
          photos: photoUrls,
          verified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      await batch.commit()
    } catch {
      setIsSaving(false)
      showToast("Impossible d'enregistrer votre profil, réessayez.", 'error')
      return
    }
    // Short celebration on the overlay before landing on Discover.
    setIsDone(true)
    setTimeout(() => navigate('/discover', { replace: true }), 1100)
  }

  // A member whose profile is already done never sees this form again
  // (except right after finishing it, for the celebration overlay).
  if (isProfileLoading) return <FullPageSpinner />
  if (profile?.onboarded && !isSaving) return <Navigate to="/discover" replace />

  const acceptedPhotos = form.photos.filter((p) => p.status === 'ok').length
  const checkingPhotos = form.photos.some((p) => p.status === 'checking')
  const refusedPhotos = form.photos.filter((p) => p.status === 'refused')

  const canContinue =
    step === 0
      ? acceptedPhotos >= MIN_PROFILE_PHOTOS && !checkingPhotos
      : step === 1
      ? form.age && form.gender
      : step === 2
        ? !!form.country
        : step === 3
          ? form.interests.length >= 3
          : step === 4
            ? form.languages.length >= 1
            : step === 6
              ? !!form.datingGoal
              : true

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-surface-soft px-4 py-8 md:items-center md:justify-center">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-mint-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-violet-500/10 blur-[100px]" />

      <AnimatePresence>
        {isSaving && (
          <ProfileLaunchOverlay
            photoUrl={form.photos[0]?.previewUrl}
            firstName={user?.firstName}
            done={isDone}
          />
        )}
      </AnimatePresence>

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
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Ajoutez {MIN_PROFILE_PHOTOS} ou 3 photos de vous
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft/60">
                    De vraies photos de vous, le visage bien visible : chaque photo est vérifiée automatiquement.
                  </p>
                  <p className="mt-1 text-xs text-ink-soft/50">
                    Photos HD uniquement (au moins {MIN_PHOTO_SIDE} pixels de côté). Pas d’animal, de dessin, de paysage,
                    de capture d’écran ni de photo où l’on ne voit pas votre visage.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => {
                      const photo = form.photos[i]
                      const src = photo?.previewUrl
                      return (
                        <div
                          key={i}
                          className={`relative aspect-[3/4] overflow-hidden rounded-2xl border bg-ink/[0.03] ${
                            photo?.status === 'refused' ? 'border-2 border-red-500' : 'border-dashed border-ink/15'
                          }`}
                        >
                          {src ? (
                            <>
                              <img
                                src={src}
                                alt=""
                                className={`h-full w-full object-cover ${photo.status === 'ok' ? '' : 'opacity-60'}`}
                              />
                              {photo.status === 'checking' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-[11px] font-medium text-white">
                                  <Loader2 size={20} className="animate-spin" />
                                  Vérification…
                                </div>
                              )}
                              {photo.status === 'refused' && (
                                <div className="absolute inset-x-0 bottom-0 bg-red-600 py-1 text-center text-[11px] font-semibold text-white">
                                  Refusée
                                </div>
                              )}
                              {photo.status === 'failed' && (
                                <button
                                  type="button"
                                  onClick={() => checkPhoto(photo)}
                                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-[11px] font-medium text-white"
                                >
                                  <RotateCw size={18} />
                                  Échec de l’envoi, réessayer
                                </button>
                              )}
                              {photo.status === 'ok' && (
                                <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-mint-500 text-white">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              )}
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
                  {refusedPhotos.length > 0 && (
                    <ul className="mt-3 space-y-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
                      {refusedPhotos.map((p) => (
                        <li key={p.id}>
                          <span className="font-semibold">Photo {form.photos.indexOf(p) + 1} :</span> {p.message}
                          {p.refusalId &&
                            (p.appealed ? (
                              <span className="mt-0.5 block font-medium text-violet-700 dark:text-violet-300">
                                ✓ Vérification demandée : si l’équipe la valide, elle sera ajoutée à ton profil.
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => requestReview(p)}
                                className="mt-0.5 block font-semibold text-violet-700 underline underline-offset-2 dark:text-violet-300"
                              >
                                Ce n’est pas correct, demander une vérification
                              </button>
                            ))}
                        </li>
                      ))}
                      <li className="text-red-700/80 dark:text-red-300/80">En attendant, retire-la avec la croix et ajoutes-en une autre.</li>
                    </ul>
                  )}
                  {!checkingPhotos && acceptedPhotos < MIN_PROFILE_PHOTOS && (
                    <p className="mt-3 text-xs text-ink-soft/60">
                      {acceptedPhotos === 0
                        ? `Il faut au moins ${MIN_PROFILE_PHOTOS} photos de vous pour continuer.`
                        : `Encore ${MIN_PROFILE_PHOTOS - acceptedPhotos} photo pour continuer.`}
                    </p>
                  )}
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
                  <h2 className="font-display text-xl font-semibold text-ink">Où vous êtes</h2>
                  <p className="mt-1 text-sm text-ink-soft/60">Choisissez votre pays, puis votre région et votre ville.</p>

                  <div className="mt-4">
                    <label htmlFor="country" className={labelClass}>
                      Pays
                    </label>
                    <CountryPicker id="country" value={form.country} onSelect={selectCountry} />
                  </div>

                  {form.country && findCountry(form.country)?.regions.length > 0 && (
                    <div className="mt-5">
                      <label htmlFor="region" className={labelClass}>
                        Région
                      </label>
                      <SearchSelect
                        id="region"
                        value={form.region}
                        options={findCountry(form.country).regions.map((r) => ({ value: r.name, label: r.name }))}
                        onSelect={selectRegion}
                        title="Choisir une région"
                        placeholder="Choisir une région"
                        searchPlaceholder="Rechercher une région…"
                      />
                    </div>
                  )}

                  {form.region && findRegion(form.country, form.region)?.cities.length > 0 && (
                    <div className="mt-5">
                      <label htmlFor="city" className={labelClass}>
                        Ville
                      </label>
                      <SearchSelect
                        id="city"
                        value={form.city}
                        options={findRegion(form.country, form.region).cities.map((city) => ({
                          value: city,
                          label: city,
                        }))}
                        onSelect={selectCity}
                        title="Choisir une ville"
                        placeholder="Choisir une ville"
                        searchPlaceholder="Rechercher ou saisir une ville…"
                        allowCustom
                      />
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">Vos centres d'intérêt</h2>
                  <p className="mt-1 text-sm text-ink-soft/60">Choisissez-en au moins 3 (jusqu'à {MAX_INTERESTS}).</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={chipClass(form.interests.includes(interest))}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ink">Vos langues</h2>
                    <p className="mt-1 text-sm text-ink-soft/60">Choisissez-en au moins une.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {LANGUAGES.map((language) => (
                        <button
                          key={language}
                          type="button"
                          onClick={() => toggleLanguage(language)}
                          className={chipClass(form.languages.includes(language))}
                        >
                          {language}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="font-display text-xl font-semibold text-ink">Votre personnalité</h2>
                    <p className="mt-1 text-sm text-ink-soft/60">
                      Jusqu'à {MAX_PERSONALITY_TRAITS} traits qui vous décrivent.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {PERSONALITY_TRAITS.map((trait) => (
                        <button
                          key={trait}
                          type="button"
                          onClick={() => togglePersonalityTrait(trait)}
                          className={chipClass(form.personalityTraits.includes(trait))}
                        >
                          {trait}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">Votre style de vie</h2>
                  <p className="mt-1 text-sm text-ink-soft/60">Optionnel, mais ça aide à mieux vous faire matcher.</p>

                  <div className="mt-4 space-y-5">
                    {LIFESTYLE_GROUPS.map((group) => (
                      <div key={group.key}>
                        <p className={labelClass}>{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.options.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setLifestyle(group.key, option)}
                              className={chipClass(form.lifestyle[group.key] === option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 6 && (
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
                  <div>
                    <p className={labelClass}>Objectif de rencontre</p>
                    <div className="flex flex-wrap gap-2">
                      {DATING_GOALS.map((goal) => (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, datingGoal: goal }))}
                          className={chipClass(form.datingGoal === goal)}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, isEntrepreneur: !f.isEntrepreneur }))}
                      className={chipClass(form.isEntrepreneur)}
                    >
                      🚀 Je suis entrepreneur·e
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, isTraveling: !f.isTraveling }))}
                      className={chipClass(form.isTraveling)}
                    >
                      ✈️ Actuellement en voyage
                    </button>
                  </div>
                  <div>
                    <p className={labelClass}>Religion (optionnel)</p>
                    <select
                      value={form.religion}
                      onChange={(e) => setForm((f) => ({ ...f, religion: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Préférer ne pas préciser</option>
                      {RELIGIONS.map((religion) => (
                        <option key={religion} value={religion}>
                          {religion}
                        </option>
                      ))}
                    </select>
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
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
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
