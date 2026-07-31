import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('bomavibes_token'))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('bomavibes_user')
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    if (token) localStorage.setItem('bomavibes_token', token)
    else localStorage.removeItem('bomavibes_token')
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('bomavibes_user', JSON.stringify(user))
    else localStorage.removeItem('bomavibes_user')
  }, [user])

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || 'Email ou mot de passe invalide')
    }

    const data = await res.json()
    setToken(data.token)
    setUser(data.user)
  }

  async function register(firstName, email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || "Impossible de créer ton compte")
    }

    const data = await res.json()
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
