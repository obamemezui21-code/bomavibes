import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
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
  const [isLoading, setIsLoading] = useState(true)
  const [isProfileLoading, setIsProfileLoading] = useState(true)
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
    getRedirectResult(auth)
      .then((result) => {
        if (!result) return
        const isNewUser = getAdditionalUserInfo(result)?.isNewUser
        navigate(isNewUser ? '/onboarding' : '/discover', { replace: true })
      })
      .catch((error) => {
        const message = mapAuthError(error)
        if (message) showToast(message, 'error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      const message = mapAuthError(error)
      if (message) throw new Error(message)
    }
  }

  async function register(firstName, email, password) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, { displayName: firstName })
      await sendEmailVerification(credential.user)
      setUser(toAppUser(credential.user))
    } catch (error) {
      const message = mapAuthError(error)
      if (message) throw new Error(message)
    }
  }

  async function resendVerificationEmail() {
    if (!auth.currentUser) return
    try {
      await sendEmailVerification(auth.currentUser)
      showToast('Email de vérification envoyé', 'success')
    } catch (error) {
      const message = mapAuthError(error)
      if (message) showToast(message, 'error')
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
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      // Don't reveal whether an account exists for this email.
      if (error?.code === 'auth/user-not-found') return
      const message = mapAuthError(error)
      if (message) throw new Error(message)
    }
  }

  async function loginWithGoogle() {
    try {
      await signInWithRedirect(auth, googleProvider)
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
      await deleteDoc(doc(db, 'users', currentUser.uid))
      await deleteUser(currentUser)
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
        login,
        register,
        loginWithGoogle,
        logout,
        deleteAccount,
        resendVerificationEmail,
        refreshEmailVerified,
        resetPassword,
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
