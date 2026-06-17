import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '@/api/auth'
import api from '@/lib/api'
import type { User } from '@/api/types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_TOKEN_KEY = 'token';
const STORAGE_USER_KEY  = 'user';

function loadStoredAuth(): { token: string | null; user: User | null } {
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

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const initial = loadStoredAuth()
  const [user, setUser] = useState<User | null>(initial.user)
  const [token, setToken] = useState<string | null>(initial.token)
  const [isLoading, setIsLoading] = useState(() => !!initial.token)

  useLayoutEffect(() => {
    setAuthHeader(token)
  }, [token])

  // On mount: validate stored session with /api/me (state restored via loadStoredAuth)
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    getMe()
      .then(({ data }) => {
        const newUser = data.user || (data as { merchant?: User }).merchant
        if (newUser) {
          setUser(newUser)
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser))
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_TOKEN_KEY)
        localStorage.removeItem(STORAGE_USER_KEY)
        setAuthHeader(null)
        setToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, newToken)
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser))
    
    // Store shop slug if present for smart redirection later
    if (newUser.shop?.id) {
      // In the current DB schema, shop ownerId or slug might be used. 
      // If we don't have slug explicitly, we might need to fetch it or rely on the login URL.
      // For now, let's assume the login page handles it or we'll store it in EmployeeLoginPage.
    }

    setAuthHeader(newToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    const isEmployee = user?.role === 'EMPLOYEE' || user?.role === 'staff'
    const isCustomer = user?.role === 'CUSTOMER'
    const lastSlug = localStorage.getItem('last_shop_slug')

    localStorage.removeItem(STORAGE_TOKEN_KEY)
    localStorage.removeItem(STORAGE_USER_KEY)
    setAuthHeader(null)
    setToken(null)
    setUser(null)

    if (isCustomer) {
      navigate('/customer/login')
    } else if (isEmployee && lastSlug) {
      navigate(`/shop/${lastSlug}/login`)
    } else {
      navigate('/login')
    }
  }, [navigate, user])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
