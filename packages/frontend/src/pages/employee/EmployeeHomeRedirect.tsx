import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getDefaultEmployeePath } from '@/lib/employeeRoles'

export default function EmployeeHomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={getDefaultEmployeePath(user?.notifyRole)} replace />
}
