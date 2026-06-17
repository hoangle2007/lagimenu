/**
 * API helper — thin wrapper around fetch for direct backend calls in tests.
 * Uses the same base URL convention as the frontend's VITE_API_URL.
 *
 * For tests that need an approved merchant token, set on the backend:
 *   E2E_AUTO_APPROVE_MERCHANT=true
 */

import type { Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3001'

export interface ApiError {
  error: string
  code: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'OWNER' | 'EMPLOYEE' | 'CUSTOMER' | 'merchant' | string
}

export interface LoginResponse {
  token: string
  user: AuthUser
  employeeId?: string
}

export interface RegisterPendingResponse {
  pending: true
  message: string
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const json = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as Record<string, unknown>
    const msg =
      (typeof json.error === 'string' && json.error) ||
      (typeof json.message === 'string' && json.message) ||
      `Request failed: ${res.status}`
    const err = new Error(msg) as Error & { response: Record<string, unknown>; status: number }
    err.response = json
    err.status = res.status
    throw err
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>('GET', path, undefined, token),
  post: <T>(path: string, body?: unknown, token?: string) => request<T>('POST', path, body, token),
  patch: <T>(path: string, body: unknown, token?: string) => request<T>('PATCH', path, body, token),
  put: <T>(path: string, body: unknown, token?: string) => request<T>('PUT', path, body, token),
  del: <T>(path: string, token?: string) => request<T>('DELETE', path, undefined, token),
}

/**
 * Register merchant (pending unless E2E_AUTO_APPROVE_MERCHANT is set on backend).
 */
export async function registerOwner(opts: {
  ownerName: string
  email: string
  password: string
  shopName: string
  phone?: string
}): Promise<LoginResponse | RegisterPendingResponse> {
  return api.post<LoginResponse | RegisterPendingResponse>('/api/auth/register', {
    shopName: opts.shopName,
    ownerName: opts.ownerName,
    email: opts.email,
    password: opts.password,
    phone: opts.phone,
  })
}

export async function loginAuth(creds: { email: string; password: string }): Promise<LoginResponse> {
  return api.post<LoginResponse>('/api/auth/login', creds)
}

export async function loginOwner(creds: { email: string; password: string }): Promise<LoginResponse> {
  return loginAuth(creds)
}

export async function loginEmployee(cred: {
  email: string
  pin: string
  shopId?: string
  merchantId?: string
  shopSlug?: string
}): Promise<LoginResponse> {
  return api.post<LoginResponse>('/api/auth/employee-login', cred)
}

export function setStorageAuth(page: Page, token: string, user: AuthUser) {
  return page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    },
    { token, user },
  )
}
