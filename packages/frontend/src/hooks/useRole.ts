import { useAuth } from './useAuth'
import type { UserRole } from '@/api/types'

/**
 * Returns true if the current authenticated user has one of the given roles.
 * Defaults to false when there is no user.
 */
export function useRole(allowedRoles: UserRole | UserRole[]): boolean {
  const { user } = useAuth()
  if (!user) return false
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  return roles.includes(user.role)
}
