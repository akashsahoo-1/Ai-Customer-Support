import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  function login() {
    // Redirects to backend /api/auth/google which triggers Google OAuth.
    // Must use the backend (Railway) URL — NOT the Vercel frontend URL.
    const backendUrl = import.meta.env.VITE_BACKEND_URL ||
      (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')
    window.location.href = `${backendUrl}/api/auth/google`
  }

  async function logout() {
    await api.post('/auth/logout')
    setUser(null)
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetch: checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
