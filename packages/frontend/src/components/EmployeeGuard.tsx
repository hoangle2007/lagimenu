import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface EmployeeGuardProps {
  children: React.ReactNode
}

/**
 * Specifically protects employee routes.
 * If authentication fails or session is lost, it redirects back to the 
 * shop-specific employee login page using the slug from the URL or localStorage.
 */
export default function EmployeeGuard({ children }: EmployeeGuardProps) {
  const { user, isLoading } = useAuth()
  const { shopSlug } = useParams<{ shopSlug: string }>()

  // Wait for auth check
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // Not logged in or NOT an employee/merchant staff
  const isAuthorized = user && (user.role === 'EMPLOYEE' || user.role === 'staff' || user.role === 'merchant')
  
  if (!isAuthorized) {
    // Try to find the shop slug to redirect back to the correct login page
    const lastSlug = shopSlug || localStorage.getItem('last_shop_slug') || 'unknown'
    return <Navigate to={`/shop/${lastSlug}/login`} replace />
  }

  return <>{children}</>
}
