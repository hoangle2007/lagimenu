import { api } from './client'
import type { Shift, ShiftStatus } from './types'

// ─── Types matching backend response shapes ──────────────────────────────────
// Backend returns flat EmployeeOutput: { id, name, email, phone, isActive, createdAt }
// plus { pin: '****' } on create responses.

export type StaffNotifyRole = 'all' | 'waiter' | 'cashier' | 'kitchen'

export const STAFF_NOTIFY_ROLE_LABELS: Record<StaffNotifyRole, string> = {
  all: 'Tất cả',
  waiter: 'Phục vụ',
  cashier: 'Thu ngân',
  kitchen: 'Bếp',
}

export interface EmployeeWithUser {
  id: string
  name: string
  email: string
  phone?: string
  isActive: boolean
  notifyRole: StaffNotifyRole
  createdAt?: string
}

export interface CreateEmployeeBody {
  name: string
  email: string
  password: string
  pin: string
  phone?: string
  notifyRole?: StaffNotifyRole
}

export interface UpdateEmployeeBody {
  name?: string
  phone?: string
  pin?: string
  notifyRole?: StaffNotifyRole
}

export interface CreateShiftBody {
  startTime: string
  endTime: string
}

export interface UpdateShiftBody {
  startTime?: string
  endTime?: string
  status?: ShiftStatus
}

// ─── API ───────────────────────────────────────────────────────────────────────

export const employeesApi = {
  list: (params?: { active?: boolean }) =>
    api.get<{ employees: EmployeeWithUser[] }>('/api/employees', { params }),

  create: (data: CreateEmployeeBody) =>
    api.post<{ employee: EmployeeWithUser }>('/api/employees', data),

  update: (id: string, data: UpdateEmployeeBody) =>
    api.put<{ employee: EmployeeWithUser }>(`/api/employees/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/employees/${id}`),

  getShifts: (employeeId: string, params?: { from?: string; to?: string }) =>
    api.get<{ shifts: Shift[] }>(`/api/employees/${employeeId}/shifts`, { params }),

  createShift: (employeeId: string, data: CreateShiftBody) =>
    api.post<{ shift: Shift }>(`/api/employees/${employeeId}/shifts`, data),

  updateShift: (id: string, data: UpdateShiftBody) =>
    api.put<{ shift: Shift }>(`/api/shifts/${id}`, data),

  deleteShift: (id: string) =>
    api.delete(`/api/shifts/${id}`),
}
