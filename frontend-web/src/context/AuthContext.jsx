import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase/config.js'
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
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(toAppUser(firebaseUser))
        setToken(await firebaseUser.getIdToken())
      } else {
        setUser(null)
        setToken(null)
      }
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

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
      setUser(toAppUser({ ...credential.user, displayName: firstName }))
    } catch (error) {
      const message = mapAuthError(error)
      if (message) throw new Error(message)
    }
  }

  function loginWithGoogle() {
    return signInWithRedirect(auth, googleProvider)
  }

  function logout() {
    signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
