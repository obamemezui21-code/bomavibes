import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
export default app
