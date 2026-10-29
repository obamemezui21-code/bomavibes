import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pencil, Settings, X } from 'lucide-react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { appealPhoto, uploadProfilePhoto } from '../firebase/photos.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { usePhotoQuality } from '../context/PhotoQualityContext.jsx'
import { COUNTRIES, findCountry, findRegion } from '../lib/geography.js'
import { MIN_PROFILE_PHOTOS, PHOTO_NOT_HD_MESSAGE, isHdPhoto } from '../lib/photoQuality.js'
import CountryPicker from '../components/CountryPicker.jsx'
import SearchSelect from '../components/SearchSelect.jsx'
import SupportModal from '../components/SupportModal.jsx'
import VerificationCard from '../components/VerificationCard.jsx'
import SubscriptionCard from '../components/SubscriptionCard.jsx'
import ProfilePromptsEditor from '../components/ProfilePromptsEditor.jsx'
import VoicePromptEditor from '../components/VoicePromptEditor.jsx'
import {
  CHILDREN_OPTIONS,
  DATING_GOALS,
  EDUCATION_LEVELS,
  LANGUAGES,
  LIFESTYLE_GROUPS,
  MAX_PERSONALITY_TRAITS,
  PERSONALITY_TRAITS,
  RELATIONSHIP_STATUSES,
  RELIGIONS,
} from '../lib/onboardingOptions.js'
import { inputClass, labelClass, chipClass } from '../lib/formStyles.js'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'

const emptyForm = {
  firstName: '',
  lastName: '',
  age: '',
  gender: '',
  city: '',
  country: '',
  region: '',
  neighborhood: '',
  height: '',
  jobTitle: '',
  workplace: '',
  children: '',
  relationshipStatus: '',
  education: '',
  bio: '',
  languages: [],
  personalityTraits: [],
  datingGoal: '',
  isEntrepreneur: false,
  religion: '',
  isTraveling: false,
  lifestyle: { sport: '', travel: '', smoking: '', alcohol: '' },
  prompts: [],
}

function Profile() {
  const { user, publicProfile, isPublicProfileLoading, logout } = useAuth()
  const { showToast } = useToast()
  const { lowRes, rejected, review: reviewUrls, missing: photosMissing, blocked: photosBlocked } = usePhotoQuality()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [countryCode, setCountryCode] = useState('')
  const [photoSlots, setPhotoSlots] = useState([null, null, null])
  // Photos whose refusal the member contested (by refusalId or url).
  const [appealed, setAppealed] = useState({})
  const [appealing, setAppealing] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const fileInputRefs = [useRef(null), useRef(null), useRef(null)]

  useEffect(() => {
    if (isPublicProfileLoading) return
    setForm({
      firstName: publicProfile?.firstName || '',
      lastName: publicProfile?.lastName || '',
      age: publicProfile?.age ?? '',
      gender: publicProfile?.gender || '',
      city: publicProfile?.city || '',
      country: publicProfile?.country || '',
      region: publicProfile?.region || '',
      neighborhood: publicProfile?.neighborhood || '',
      height: publicProfile?.height ?? '',
      jobTitle: publicProfile?.jobTitle || '',
      workplace: publicProfile?.workplace || '',
      children: publicProfile?.children || '',
      relationshipStatus: publicProfile?.relationshipStatus || '',
      education: publicProfile?.education || '',
      bio: publicProfile?.bio || '',
      languages: publicProfile?.languages || [],
      personalityTraits: publicProfile?.personalityTraits || [],
      datingGoal: publicProfile?.datingGoal || '',
      isEntrepreneur: publicProfile?.isEntrepreneur || false,
      religion: publicProfile?.religion || '',
      isTraveling: publicProfile?.isTraveling || false,
      lifestyle: publicProfile?.lifestyle || { sport: '', travel: '', smoking: '', alcohol: '' },
      prompts: publicProfile?.prompts || [],
    })
    setCountryCode(
      publicProfile?.countryCode ||
        COUNTRIES.find((c) => c.name.toLowerCase() === (publicProfile?.country || '').toLowerCase())?.code ||
        '',
    )
    setPhotoSlots([0, 1, 2].map((i) => (publicProfile?.photos?.[i] ? { url: publicProfile.photos[i] } : null)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicProfileLoading])

  function handleChange(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function selectCountry(code) {
    setCountryCode(code)
    setForm((f) => ({ ...f, country: findCountry(code)?.name || f.country, region: '', city: '' }))
  }

  function selectRegion(name) {
    setForm((f) => (f.region === name ? f : { ...f, region: name, city: '' }))
  }

  function selectCity(name) {
    setForm((f) => ({ ...f, city: name }))
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

  function setLifestyle(key, value) {
    setForm((f) => ({ ...f, lifestyle: { ...f.lifestyle, [key]: value } }))
  }

  async function handlePhotoSelect(index, e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!(await isHdPhoto(file))) {
      setError(PHOTO_NOT_HD_MESSAGE)
      showToast(PHOTO_NOT_HD_MESSAGE, 'error')
      return
    }
    setError('')
    setPhotoSlots((slots) => slots.map((s, i) => (i === index ? { file, previewUrl: URL.createObjectURL(file) } : s)))
  }

  // A photo already on the profile that must be replaced (see PhotoQualityContext):
  // not HD, or not a real photo of the member (with the reason).
  const saved = (slot) => Boolean(slot?.url && !slot.file)
  const rejectionOf = (slot) => (saved(slot) ? rejected.find((r) => r.url === slot.url) : null)

  // What to say about each photo — one precise reason and what to do — or
  // null when it's fine. appeal: what to send to ask a moderator to look.
  function issueOf(slot) {
    if (slot?.refused) {
      const { message, refusalId } = slot.refused
      return { tone: 'refused', badge: 'Photo refusée', text: message, appeal: refusalId ? { refusalId } : null, key: refusalId }
    }
    const rejection = rejectionOf(slot)
    if (rejection?.human) return { tone: 'refused', badge: 'Refusée par l’équipe', text: rejection.message }
    if (rejection) {
      const canAppeal = rejection.code !== 'photo-not-ours'
      return { tone: 'refused', badge: 'Photo refusée', text: rejection.message, appeal: canAppeal ? { url: slot.url } : null, key: slot.url }
    }
    if (saved(slot) && lowRes.includes(slot.url)) {
      return { tone: 'lowres', badge: 'Pas en HD', text: 'Pas en HD : remplace-la par une photo prise avec ton téléphone (au moins 720 pixels de côté).' }
    }
    if (saved(slot) && reviewUrls.includes(slot.url)) {
      return { tone: 'review', badge: 'En vérification', text: 'En cours de vérification par l’équipe : elle reste visible sur ton profil en attendant.' }
    }
    return null
  }
  const issues = photoSlots.map(issueOf)
  const ISSUE_STYLES = {
    refused: { badge: 'bg-coral-500', border: 'border-2 border-coral-500', text: 'text-coral-600 dark:text-coral-400' },
    lowres: { badge: 'bg-amber-500', border: 'border-2 border-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    review: { badge: 'bg-violet-500', border: 'border-2 border-violet-400', text: 'text-violet-700 dark:text-violet-300' },
  }

  async function requestReview(index, issue) {
    setAppealing(issue.key)
    try {
      await appealPhoto(issue.appeal.refusalId ? { ...issue.appeal, slot: index } : issue.appeal)
      setAppealed((a) => ({ ...a, [issue.key]: true }))
      showToast('Demande envoyée : l’équipe va vérifier ta photo.', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setAppealing(null)
    }
  }

  function removePhotoSlot(index) {
    setPhotoSlots((slots) => slots.map((s, i) => (i === index ? null : s)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!form.firstName.trim()) {
      setError('Le prénom est requis')
      return
    }
    const parsedAge = form.age === '' ? null : Number(form.age)
    if (parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 120)) {
      setError("L'âge doit être un nombre valide (18 ou plus)")
      return
    }
    const parsedHeight = form.height === '' ? null : Number(form.height)
    if (parsedHeight !== null && (!Number.isInteger(parsedHeight) || parsedHeight < 120 || parsedHeight > 230)) {
      setError('La taille doit être en centimètres (entre 120 et 230)')
      return
    }
    if (photoSlots.some((slot) => slot?.refused)) {
      setError('Retire les photos refusées avant d’enregistrer (si tu as demandé une vérification, elle sera ajoutée une fois validée).')
      return
    }
    if (photoSlots.filter(Boolean).length < MIN_PROFILE_PHOTOS) {
      setError(`Ton profil doit avoir au moins ${MIN_PROFILE_PHOTOS} photos de toi.`)
      return
    }

    setIsSaving(true)
    try {
      // Each new photo is checked by the server. What went through is kept
      // (not uploaded again); a refused photo stays in its slot with its
      // reason, so the member can contest it.
      const uploads = await Promise.allSettled(
        photoSlots.map((slot, i) => (slot?.file ? uploadProfilePhoto(user.id, i, slot.file) : Promise.resolve(slot?.url || null))),
      )
      const isRefusal = (r) => r.status === 'rejected' && r.reason?.code?.startsWith('photo-')
      setPhotoSlots((slots) =>
        slots.map((slot, i) => {
          const r = uploads[i]
          if (!slot?.file) return slot
          if (r.status === 'fulfilled') return { url: r.value }
          if (isRefusal(r)) return { ...slot, refused: { code: r.reason.code, message: r.reason.message, refusalId: r.reason.refusalId } }
          return slot
        }),
      )
      const failed = uploads.find((r) => r.status === 'rejected' && !isRefusal(r))
      if (failed) throw failed.reason
      const refusedSlots = uploads.map((r, i) => (isRefusal(r) ? i + 1 : null)).filter(Boolean)
      if (refusedSlots.length) {
        const message =
          refusedSlots.length > 1
            ? 'Des photos ont été refusées : le motif est indiqué sous les photos.'
            : `La photo ${refusedSlots[0]} a été refusée : le motif est indiqué sous les photos.`
        setError(message)
        showToast(message, 'error')
        return
      }
      const photoUrls = uploads.map((r) => r.value).filter(Boolean)

      await setDoc(
        doc(db, 'profiles', user.id),
        {
          firstName: form.firstName,
          lastName: form.lastName || null,
          age: parsedAge,
          gender: form.gender || null,
          city: form.city || null,
          country: form.country || null,
          countryCode: countryCode || null,
          region: form.region || null,
          neighborhood: form.neighborhood.trim() || null,
          height: parsedHeight,
          jobTitle: form.jobTitle.trim() || null,
          workplace: form.workplace.trim() || null,
          children: form.children || null,
          relationshipStatus: form.relationshipStatus || null,
          education: form.education || null,
          bio: form.bio || null,
          languages: form.languages,
          personalityTraits: form.personalityTraits,
          datingGoal: form.datingGoal || null,
          isEntrepreneur: form.isEntrepreneur,
          religion: form.religion || null,
          isTraveling: form.isTraveling,
          lifestyle: form.lifestyle,
          prompts: form.prompts
            .map((p) => ({ question: p.question, answer: p.answer.trim() }))
            .filter((p) => p.answer),
          photos: photoUrls,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      setSuccess(true)
      showToast('Profil mis à jour avec succès.', 'success')
      setTimeout(() => setSuccess(false), 2500)
    } catch (err) {
      const message = err?.code?.startsWith('photo-') ? err.message : 'Impossible de mettre à jour votre profil'
      setError(message)
      showToast(message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const completion = Math.min(100, Math.round(
    (Object.entries(form).filter(([key, v]) => key !== 'age' && String(v).trim()).length / 6) * 100,
  ))

  if (isPublicProfileLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface-soft p-6 desktop:min-h-full">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-violet-300 border-t-violet-600"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-surface-soft p-6 pb-24 desktop:min-h-full desktop:pb-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-mint-500/15 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative">
            <img
              src={
                photoSlots[0]?.previewUrl ||
                photoSlots[0]?.url ||
                fallbackAvatar(form.firstName || 'Vous', '8b5cf6')
              }
              alt="Avatar"
              className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-xl"
            />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-white shadow">
              <Pencil size={14} strokeWidth={2.25} />
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
            {form.firstName || 'Votre profil'}
          </h1>
          {user?.email && <p className="text-sm text-ink-soft/60">{user.email}</p>}

          <div className="mt-3 w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs text-ink-soft/60">
              <span>Profil complété</span>
              <span>{completion}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>

        <SubscriptionCard />
        <VerificationCard />

        <form onSubmit={handleSubmit} className="glass-panel space-y-4 rounded-2xl p-6">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-400"
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-sm text-mint-500"
              >
                Profil mis à jour avec succès.
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className={labelClass}>Photos</label>
            {photosBlocked ? (
              <p className="mb-3 rounded-xl border border-coral-500/40 bg-coral-500/10 px-3 py-2.5 text-sm font-semibold text-coral-600 dark:text-coral-400">
                Ton compte est suspendu : après vérification par l’équipe, tes photos ne te montrent pas. Ajoute une vraie photo de toi pour le
                réactiver.
              </p>
            ) : (
              photosMissing > 0 && (
                <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
                  Ajoute encore {photosMissing > 1 ? `${photosMissing} photos` : '1 photo'} de toi, le visage visible (au moins {MIN_PROFILE_PHOTOS} au total).
                </p>
              )
            )}
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => {
                const src = photoSlots[i]?.previewUrl || photoSlots[i]?.url
                const issue = issues[i]
                return (
                  <div
                    key={i}
                    className={`relative aspect-[3/4] overflow-hidden rounded-2xl border bg-ink/[0.03] ${
                      issue ? ISSUE_STYLES[issue.tone].border : 'border-dashed border-ink/15'
                    }`}
                  >
                    {src ? (
                      <>
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        {issue && (
                          <span
                            className={`absolute inset-x-0 bottom-0 py-1 text-center text-[11px] font-bold text-white ${ISSUE_STYLES[issue.tone].badge}`}
                          >
                            {issue.badge}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhotoSlot(i)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                          aria-label="Retirer la photo"
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs[i].current?.click()}
                        className="flex h-full w-full items-center justify-center text-2xl text-ink-soft/40 transition hover:text-violet-600"
                        aria-label="Ajouter une photo"
                      >
                        +
                      </button>
                    )}
                    <input
                      ref={fileInputRefs[i]}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(i, e)}
                    />
                  </div>
                )
              })}
            </div>
            {/* One precise reason per photo, with what to do — and a way to
                ask a moderator when the member thinks the analysis is wrong. */}
            {issues.some(Boolean) && (
              <ul className="mt-3 space-y-2">
                {issues.map((issue, i) =>
                  issue ? (
                    <li key={i} className="rounded-xl bg-ink/[0.03] px-3 py-2 text-xs dark:bg-white/5">
                      <p className={`font-semibold ${ISSUE_STYLES[issue.tone].text}`}>
                        Photo {i + 1} · {issue.badge}
                      </p>
                      <p className="mt-0.5 text-ink-soft">{issue.text}</p>
                      {issue.appeal &&
                        (appealed[issue.key] ? (
                          <p className="mt-1.5 font-medium text-violet-700 dark:text-violet-300">
                            ✓ Vérification demandée : l’équipe va regarder. Ton compte reste actif en attendant.
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => requestReview(i, issue)}
                            disabled={appealing === issue.key}
                            className="mt-1.5 font-semibold text-violet-700 underline underline-offset-2 disabled:opacity-50 dark:text-violet-300"
                          >
                            Ce n’est pas correct, demander une vérification
                          </button>
                        ))}
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className={labelClass}>
                Prénom
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={form.firstName}
                onChange={handleChange('firstName')}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="lastName" className={labelClass}>
                Nom
              </label>
              <input id="lastName" type="text" value={form.lastName} onChange={handleChange('lastName')} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="age" className={labelClass}>
                Âge
              </label>
              <input
                id="age"
                type="number"
                min="18"
                max="120"
                value={form.age}
                onChange={handleChange('age')}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="gender" className={labelClass}>
                Genre
              </label>
              <select id="gender" value={form.gender} onChange={handleChange('gender')} className={inputClass}>
                <option value="">Non précisé</option>
                <option value="FEMME">Femme</option>
                <option value="HOMME">Homme</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="country" className={labelClass}>
              Pays
            </label>
            <CountryPicker id="country" value={countryCode} onSelect={selectCountry} />
            {!countryCode && form.country && (
              <p className="mt-2 text-xs text-ink-soft/50">Actuel : {form.country}</p>
            )}
          </div>

          {countryCode && findCountry(countryCode)?.regions.length > 0 && (
            <div>
              <label htmlFor="region" className={labelClass}>
                Région
              </label>
              <SearchSelect
                id="region"
                value={form.region}
                options={findCountry(countryCode).regions.map((r) => ({ value: r.name, label: r.name }))}
                onSelect={selectRegion}
                title="Choisir une région"
                placeholder="Choisir une région"
                searchPlaceholder="Rechercher une région…"
              />
            </div>
          )}

          {form.region && findRegion(countryCode, form.region)?.cities.length > 0 ? (
            <div>
              <label htmlFor="city" className={labelClass}>
                Ville
              </label>
              <SearchSelect
                id="city"
                value={form.city}
                options={findRegion(countryCode, form.region).cities.map((city) => ({ value: city, label: city }))}
                onSelect={selectCity}
                title="Choisir une ville"
                placeholder="Choisir une ville"
                searchPlaceholder="Rechercher ou saisir une ville…"
                allowCustom
              />
            </div>
          ) : (
            <div>
              <label htmlFor="city" className={labelClass}>
                Ville
              </label>
              <input
                id="city"
                type="text"
                placeholder="Ex: Libreville"
                value={form.city}
                onChange={handleChange('city')}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="neighborhood" className={labelClass}>
              Quartier
            </label>
            <input
              id="neighborhood"
              type="text"
              maxLength="80"
              placeholder="Ex: Louis, Glass, Akanda…"
              value={form.neighborhood}
              onChange={handleChange('neighborhood')}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="jobTitle" className={labelClass}>
                Métier
              </label>
              <input
                id="jobTitle"
                type="text"
                maxLength="80"
                placeholder="Ex: Comptable"
                value={form.jobTitle}
                onChange={handleChange('jobTitle')}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="workplace" className={labelClass}>
                Lieu de travail
              </label>
              <input
                id="workplace"
                type="text"
                maxLength="80"
                placeholder="Entreprise ou secteur"
                value={form.workplace}
                onChange={handleChange('workplace')}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="height" className={labelClass}>
              Taille <span className="font-normal text-ink-soft/50">(en cm)</span>
            </label>
            <input
              id="height"
              type="number"
              min="120"
              max="230"
              placeholder="Ex: 175"
              value={form.height}
              onChange={handleChange('height')}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Enfants</label>
            <div className="flex flex-wrap gap-2">
              {CHILDREN_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, children: f.children === option ? '' : option }))}
                  className={chipClass(form.children === option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Situation amoureuse (optionnel)</label>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIP_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={form.relationshipStatus === option}
                  onClick={() => setForm((f) => ({ ...f, relationshipStatus: f.relationshipStatus === option ? '' : option }))}
                  className={chipClass(form.relationshipStatus === option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="education" className={labelClass}>
              Niveau d’études (optionnel)
            </label>
            <select
              id="education"
              value={form.education}
              onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
              className={inputClass}
            >
              <option value="">Préférer ne pas préciser</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bio" className={labelClass}>
              Bio
            </label>
            <textarea
              id="bio"
              rows="3"
              maxLength="280"
              placeholder="Parlez un peu de vous..."
              value={form.bio}
              onChange={handleChange('bio')}
              className={`${inputClass} resize-none`}
            />
          </div>

          <ProfilePromptsEditor prompts={form.prompts} onChange={(prompts) => setForm((f) => ({ ...f, prompts }))} />

          <VoicePromptEditor voicePrompt={publicProfile?.voicePrompt} />

          <div>
            <label className={labelClass}>Langues</label>
            <div className="flex flex-wrap gap-2">
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
            <label className={labelClass}>
              Personnalité <span className="font-normal text-ink-soft/50">(jusqu'à {MAX_PERSONALITY_TRAITS})</span>
            </label>
            <div className="flex flex-wrap gap-2">
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

          <div>
            <label className={labelClass}>Objectif de rencontre</label>
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
            <label className={labelClass}>Religion (optionnel)</label>
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

          <div className="space-y-4">
            <label className={labelClass}>Style de vie</label>
            {LIFESTYLE_GROUPS.map((group) => (
              <div key={group.key}>
                <p className="mb-1.5 text-xs font-medium text-ink-soft/60">{group.label}</p>
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

          <div className="space-y-2.5 border-t border-ink/8 pt-5">
            <motion.button
              type="submit"
              disabled={isSaving}
              whileTap={{ scale: 0.97 }}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </motion.button>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
            >
              <Settings size={16} strokeWidth={2} />
              Paramètres
            </button>

            <button
              type="button"
              onClick={() => setShowSupport(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
            >
              <Heart size={16} strokeWidth={2} />
              Soutenir BomaVibes
            </button>

            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="w-full rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink-soft/70 transition hover:bg-ink/5"
            >
              Déconnexion
            </button>
          </div>
        </form>
      </div>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </div>
  )
}

export default Profile
