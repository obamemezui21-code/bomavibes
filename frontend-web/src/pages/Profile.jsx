import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Settings, X } from 'lucide-react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { uploadProfilePhoto } from '../firebase/photos.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const emptyForm = {
  firstName: '',
  lastName: '',
  age: '',
  gender: '',
  city: '',
  country: '',
  bio: '',
}

const inputClass =
  'w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15'
const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80'

function Profile() {
  const { user, publicProfile, isPublicProfileLoading, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [photoSlots, setPhotoSlots] = useState([null, null, null])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
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
      bio: publicProfile?.bio || '',
    })
    setPhotoSlots([0, 1, 2].map((i) => (publicProfile?.photos?.[i] ? { url: publicProfile.photos[i] } : null)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicProfileLoading])

  function handleChange(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function handlePhotoSelect(index, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoSlots((slots) => slots.map((s, i) => (i === index ? { file, previewUrl: URL.createObjectURL(file) } : s)))
    e.target.value = ''
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

    setIsSaving(true)
    try {
      const photoUrls = (
        await Promise.all(
          photoSlots.map((slot, i) => {
            if (slot?.file) return uploadProfilePhoto(user.id, i, slot.file)
            if (slot?.url) return slot.url
            return null
          }),
        )
      ).filter(Boolean)

      await setDoc(
        doc(db, 'profiles', user.id),
        {
          firstName: form.firstName,
          lastName: form.lastName || null,
          age: parsedAge,
          gender: form.gender || null,
          city: form.city || null,
          country: form.country || null,
          bio: form.bio || null,
          photos: photoUrls,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      setSuccess(true)
      showToast('Profil mis à jour avec succès.', 'success')
      setTimeout(() => setSuccess(false), 2500)
    } catch {
      setError('Impossible de mettre à jour ton profil')
      showToast('Impossible de mettre à jour ton profil', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const completion = Math.round(
    (Object.entries(form).filter(([key, v]) => key !== 'age' && String(v).trim()).length / 6) * 100,
  )

  if (isPublicProfileLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface-soft p-6 md:min-h-full">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-violet-300 border-t-violet-600"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-surface-soft p-6 pb-24 md:min-h-full md:pb-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-mint-500/15 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative">
            <img
              src={
                photoSlots[0]?.previewUrl ||
                photoSlots[0]?.url ||
                `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(form.firstName || 'Toi')}&backgroundColor=8b5cf6`
              }
              alt="Avatar"
              className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-xl"
            />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-white shadow">
              <Pencil size={14} strokeWidth={2.25} />
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
            {form.firstName || 'Ton profil'}
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
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => {
                const src = photoSlots[i]?.previewUrl || photoSlots[i]?.url
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
                <option value="" className="bg-white">Non précisé</option>
                <option value="FEMME" className="bg-white">Femme</option>
                <option value="HOMME" className="bg-white">Homme</option>
                <option value="AUTRE" className="bg-white">Autre</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label htmlFor="country" className={labelClass}>
                Pays
              </label>
              <input
                id="country"
                type="text"
                placeholder="Ex: Gabon"
                value={form.country}
                onChange={handleChange('country')}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className={labelClass}>
              Bio
            </label>
            <textarea
              id="bio"
              rows="3"
              maxLength="280"
              placeholder="Parle un peu de toi..."
              value={form.bio}
              onChange={handleChange('bio')}
              className={`${inputClass} resize-none`}
            />
          </div>

          <motion.button
            type="submit"
            disabled={isSaving}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
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
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="w-full rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink-soft/70 transition hover:bg-ink/5"
          >
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  )
}

export default Profile
