import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyB-Z6Txp7GBbNEKYr5KmrH5bT8TKQPtFOE',
  authDomain: 'bomavibes-cd139.firebaseapp.com',
  projectId: 'bomavibes-cd139',
  storageBucket: 'bomavibes-cd139.firebasestorage.app',
  messagingSenderId: '463929414106',
  appId: '1:463929414106:web:3cd8b8df8ed840e90570e3',
  measurementId: 'G-THX2PFCJGQ',
}

const app = initializeApp(firebaseConfig)

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (recaptchaSiteKey) {
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
} else if (import.meta.env.DEV) {
  console.warn('VITE_RECAPTCHA_SITE_KEY is not set — Firebase App Check is disabled.')
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
export const VAPID_KEY =
  'BHuBFx2zRXcbcwSBcTs3Pm4xq4lZkcd_dGAw0Ty-8sOPbXUCSyXND3tPSj3BarIG5HolOklAlN9b5DtLaVR_Cis'
export default app
