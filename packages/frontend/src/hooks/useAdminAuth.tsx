import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '@/api/auth'
import api from '@/lib/api'
import type { User } from '@/api/types'

export interface AdminAuthContextType {
  admin: User | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

const STORAGE_TOKEN_KEY = 'admin_token';
const STORAGE_USER_KEY  = 'admin_user';

function loadStoredAdmin(): { token: string | null; user: User | null } {
  if (typeof window === 'undefined') return { token: null, user: null }
  const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY)
  const storedUser = localStorage.getItem(STORAGE_USER_KEY)
  if (!storedToken || !storedUser) return { token: null, user: null }
  try {
    return { token: storedToken, user: JSON.parse(storedUser) as User }
  } catch {
    return { token: storedToken, user: null }
  }
}

function setAuthHeader(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const initial = loadStoredAdmin()
  const [admin, setAdmin] = useState<User | null>(initial.user)
  const [token, setToken] = useState<string | null>(initial.token)
  const [isLoading, setIsLoading] = useState(() => !!initial.token)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    setAuthHeader(token)
    setIsLoading(true)

    getMe({ admin: true })
      .then(({ data }) => {
        if (data.user.role === 'admin' || data.user.role === 'ADMIN' || data.user.role === 'super_admin') {
          setAdmin(data.user)
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user))
        } else {
          throw new Error('Not an admin')
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_TOKEN_KEY)
        localStorage.removeItem(STORAGE_USER_KEY)
        setAuthHeader(null)
        setToken(null)
        setAdmin(null)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, newToken)
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser))
    setAuthHeader(newToken)
    setToken(newToken)
    setAdmin(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN_KEY)
    localStorage.removeItem(STORAGE_USER_KEY)
    setAuthHeader(null)
    setToken(null)
    setAdmin(null)
    navigate('/admin/login')
  }, [navigate])

  return (
    <AdminAuthContext.Provider value={{ admin, token, isLoading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthContextType {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>')
  return ctx
}
