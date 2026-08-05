import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase/config.js'
import { useToast } from './ToastContext.jsx'

const AuthContext = createContext(null)

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Email ou mot de passe invalide',
  'auth/wrong-password': 'Email ou mot de passe invalide',
  'auth/user-not-found': 'Email ou mot de passe invalide',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet email',
  'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères',
  'auth/invalid-email': 'Adresse email invalide',
  'auth/too-many-requests': 'Trop de tentatives, réessaie dans un instant',
  'auth/popup-closed-by-user': null,
  'auth/operation-not-allowed': "Ce mode de connexion n'est pas encore activé, réessaie plus tard",
  'auth/unauthorized-domain': "La connexion Google n'est pas encore autorisée sur ce domaine",
  'auth/account-exists-with-different-credential':
    'Un compte existe déjà avec cet email. Connecte-toi avec ton mot de passe.',
  'auth/requires-recent-login': 'Pour des raisons de sécurité, reconnecte-toi puis réessaie.',
}

function mapAuthError(error) {
  const code = error?.code
  if (code && code in ERROR_MESSAGES) return ERROR_MESSAGES[code]
  return "Une erreur est survenue, réessaie."
}

function toAppUser(firebaseUser) {
  if (!firebaseUser) return null
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    firstName: firebaseUser.displayName || '',
    emailVerified: firebaseUser.emailVerified,
    hasPassword: firebaseUser.providerData?.some((p) => p.providerId === 'password') ?? false,
  }
}

async function ensureUserDocument(firebaseUser) {
  const ref = doc(db, 'users', firebaseUser.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      email: firebaseUser.email,
      firstName: firebaseUser.displayName || '',
      onboarded: false,
      createdAt: serverTimestamp(),
    })
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [publicProfile, setPublicProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProfileLoading, setIsProfileLoading] = useState(true)
  const [isPublicProfileLoading, setIsPublicProfileLoading] = useState(true)
  const [latestAnnouncementAt, setLatestAnnouncementAt] = useState(null)
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(toAppUser(firebaseUser))
        setToken(await firebaseUser.getIdToken())
        ensureUserDocument(firebaseUser)
      } else {
        setUser(null)
        setToken(null)
        setProfile(null)
      }
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    setIsProfileLoading(true)
    const ref = doc(db, 'users', user.id)
    const unsubscribe = onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? snap.data() : null)
      setIsProfileLoading(false)
    })
    return unsubscribe
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setPublicProfile(null)
      return
    }
    setIsPublicProfileLoading(true)
    const ref = doc(db, 'profiles', user.id)
    const unsubscribe = onSnapshot(ref, (snap) => {
      setPublicProfile(snap.exists() ? snap.data() : null)
      setIsPublicProfileLoading(false)
    })
    return unsubscribe
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setLatestAnnouncementAt(null)
      return
    }
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(1))
    const unsubscribe = onSnapshot(q, (snap) => {
      const latest = snap.docs[0]?.data()?.createdAt?.toDate?.() ?? null
      setLatestAnnouncementAt(latest)
    })
    return unsubscribe
  }, [user?.id])

  const lastSeenAnnouncementAt = profile?.lastSeenAnnouncementAt?.toDate?.() ?? null
  const hasUnseenAnnouncement = !!latestAnnouncementAt && (!lastSeenAnnouncementAt || latestAnnouncementAt > lastSeenAnnouncementAt)

  async function markAnnouncementsSeen() {
    if (!user) return
    await updateDoc(doc(db, 'users', user.id), { lastSeenAnnouncementAt: serverTimestamp() }).catch(() => {})
  }

  async function login(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      const message = mapAuthError(error)
      if (message) throw new Error(message)
    }
  }

  async function sendVerificationEmailFor(firebaseUser) {
    const idToken = await firebaseUser.getIdToken()
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) throw new Error()
  }

  async function register(firstName, email, password) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, { displayName: firstName })
      await sendVerificationEmailFor(credential.user).catch(() => {})
      setUser(toAppUser(credential.user))
    } catch (error) {
      const message = mapAuthError(error)
      if (message) throw new Error(message)
    }
  }

  async function resendVerificationEmail() {
    if (!auth.currentUser) return
    try {
      await sendVerificationEmailFor(auth.currentUser)
      showToast('Email de vérification envoyé', 'success')
    } catch {
      showToast("Impossible d'envoyer l'email, réessaie.", 'error')
    }
  }

  async function refreshEmailVerified() {
    if (!auth.currentUser) return false
    await auth.currentUser.reload()
    setUser(toAppUser(auth.currentUser))
    return auth.currentUser.emailVerified
  }

  async function resetPassword(email) {
    try {
      const res = await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
    } catch {
      throw new Error('Une erreur est survenue, réessaie.')
    }
  }

  async function loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser
      navigate(isNewUser ? '/onboarding' : '/discover', { replace: true })
    } catch (error) {
      const message = mapAuthError(error)
      if (message) throw new Error(message)
    }
  }

  function logout() {
    signOut(auth)
  }

  async function deleteAccount() {
    const currentUser = auth.currentUser
    if (!currentUser) return
    try {
      const idToken = await currentUser.getIdToken()
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      if (!res.ok) throw new Error()
      await signOut(auth)
    } catch {
      throw new Error('Impossible de supprimer ton compte, réessaie.')
    }
  }

  async function reauthenticate(currentPassword) {
    const currentUser = auth.currentUser
    if (!currentUser?.email) throw new Error('Session invalide, reconnecte-toi.')
    if (!currentUser.providerData.some((p) => p.providerId === 'password')) {
      throw new Error(
        'Cette action est réservée aux comptes email/mot de passe. Les comptes Google se gèrent depuis ton compte Google.',
      )
    }
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
    } catch (error) {
      const message = mapAuthError(error)
      throw new Error(message)
    }
  }

  async function changeEmail(newEmail, currentPassword) {
    await reauthenticate(currentPassword)
    try {
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail)
    } catch (error) {
      const message = mapAuthError(error)
      throw new Error(message)
    }
  }

  async function changePassword(currentPassword, newPassword) {
    await reauthenticate(currentPassword)
    try {
      await updatePassword(auth.currentUser, newPassword)
    } catch (error) {
      const message = mapAuthError(error)
      throw new Error(message)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        profile,
        isLoading,
        isProfileLoading,
        publicProfile,
        isPublicProfileLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        deleteAccount,
        changeEmail,
        changePassword,
        resendVerificationEmail,
        refreshEmailVerified,
        resetPassword,
        hasUnseenAnnouncement,
        markAnnouncementsSeen,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
