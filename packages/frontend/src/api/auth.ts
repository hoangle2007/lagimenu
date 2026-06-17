import { api } from './client'
import type { User } from './types'

export interface LoginBody {
  email: string
  password: string
}

export interface RegisterBody {
  email: string
  password: string
  shopName: string
  ownerName: string
  phone?: string
}

export interface EmployeeLoginBody {
  email: string
  pin: string
  shopId?: string
  shopSlug?: string
}

export interface EmployeeLoginResponse {
  token: string
  user: User
}

export interface AuthResponse {
  token: string
  user: User
  employeeId?: string
}

export interface RegisterPendingResponse {
  pending: true
  message: string
}

export const login = (body: LoginBody) =>
  api.post<AuthResponse>('auth/login', body)

export const register = (body: RegisterBody) =>
  api.post<RegisterPendingResponse | AuthResponse>('auth/register', body)

export interface CustomerRegisterBody {
  email: string
  password: string
  name: string
  phone?: string
}

export const customerRegister = (body: CustomerRegisterBody) =>
  api.post<AuthResponse>('auth/customer/register', body)

export const customerLogin = (body: LoginBody) =>
  api.post<AuthResponse>('auth/customer/login', body)

export const employeeLogin = (body: EmployeeLoginBody) =>
  api.post<AuthResponse>('auth/employee-login', body)

export const getMe = (opts?: { admin?: boolean }) =>
  api.get<{ user: User }>('auth/me', {
    headers: opts?.admin
      ? { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` }
      : undefined,
  })

export interface GoogleLoginBody {
  credential: string
}

export interface SocialAuthResponse extends AuthResponse {
  isNewAccount: boolean
}

export const googleLogin = (body: GoogleLoginBody) =>
  api.post<SocialAuthResponse>('auth/google', body)

export interface LinkGoogleBody {
  googleId: string
  password?: string
}

export const linkGoogle = (body: LinkGoogleBody) =>
  api.post<AuthResponse>('auth/google/link', body)
