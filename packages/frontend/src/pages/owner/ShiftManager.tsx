/**
 * ShiftManager — view and assign shifts for a specific employee.
 *
 * Features:
 *  - "Gán ca" button → opens add-shift form
 *  - Shift list: date, time range, status badge (SCHEDULED=blue, ACTIVE=green, COMPLETED=gray)
 *  - Edit/Delete buttons per shift
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { employeesApi, type EmployeeWithUser } from '@/api/employees'
import type { Shift, ShiftStatus } from '@/api/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ShiftStatus, string> = {
  SCHEDULED: 'Sắp tới',
  ACTIVE: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}

const STATUS_COLORS: Record<ShiftStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-600',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatShiftTime(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddShiftForm {
  date: string
  startTime: string
  endTime: string
}

type ValidationErrors = Partial<Record<keyof AddShiftForm, string>>

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftManager() {
  const { id: employeeId } = useParams<{ id: string }>()
  const [employee, setEmployee] = useState<EmployeeWithUser | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add-shift form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<AddShiftForm>({ date: '', startTime: '', endTime: '' })
  const [formErrors, setFormErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit-shift state
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editForm, setEditForm] = useState<AddShiftForm>({ date: '', startTime: '', endTime: '' })

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)
    setError(null)
    try {
      const [empRes, shiftsRes] = await Promise.all([
        // The employees list returns employees with user info; fetch by listing all then find
        employeesApi.list(),
        employeesApi.getShifts(employeeId),
      ])
      const emp = empRes.data.employees.find((e) => e.id === employeeId) ?? null
      setEmployee(emp)
      setShifts(shiftsRes.data.shifts)
    } catch {
      setError('Không thể tải thông tin ca làm.')
    } finally {
      setIsLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ─── Add shift ─────────────────────────────────────────────────────────────

  function validateAddForm(form: AddShiftForm): ValidationErrors {
    const errs: ValidationErrors = {}
    if (!form.date) errs.date = 'Vui lòng chọn ngày'
    if (!form.startTime) errs.startTime = 'Vui lòng chọn giờ bắt đầu'
    if (!form.endTime) errs.endTime = 'Vui lòng chọn giờ kết thúc'
    if (form.startTime && form.endTime && form.startTime >= form.endTime) {
      errs.endTime = 'Giờ kết thúc phải sau giờ bắt đầu'
    }
    return errs
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId) return
    const errs = validateAddForm(addForm)
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }

    setIsSubmitting(true)
    try {
      const startTime = `${addForm.date}T${addForm.startTime}:00.000Z`
      const endTime = `${addForm.date}T${addForm.endTime}:00.000Z`
      const { data } = await employeesApi.createShift(employeeId, { startTime, endTime })
      setShifts((prev) => [data.shift, ...prev])
      setShowAddForm(false)
      setAddForm({ date: '', startTime: '', endTime: '' })
      setFormErrors({})
      toast.success('Đã gán ca làm việc')
    } catch {
      toast.error('Không thể tạo ca. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Edit shift ─────────────────────────────────────────────────────────────

  const openEdit = (shift: Shift) => {
    setEditingShift(shift)
    const d = shift.startTime.split('T')[0]
    const s = shift.startTime.split('T')[1]?.slice(0, 5) ?? ''
    const e = shift.endTime.split('T')[1]?.slice(0, 5) ?? ''
    setEditForm({ date: d, startTime: s, endTime: e })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingShift) return
    const errs = validateAddForm(editForm)
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }

    setIsSubmitting(true)
    try {
      const startTime = `${editForm.date}T${editForm.startTime}:00.000Z`
      const endTime = `${editForm.date}T${editForm.endTime}:00.000Z`
      const { data } = await employeesApi.updateShift(editingShift.id, { startTime, endTime })
      setShifts((prev) => prev.map((s) => (s.id === data.shift.id ? data.shift : s)))
      setEditingShift(null)
      toast.success('Đã cập nhật ca làm')
    } catch {
      toast.error('Không thể cập nhật ca. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete shift ───────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await employeesApi.deleteShift(deleteTarget.id)
      setShifts((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      toast.success('Đã xóa ca làm')
      setDeleteTarget(null)
    } catch {
      toast.error('Không thể xóa ca. Vui lòng thử lại.')
    } finally {
      setIsDeleting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/owner/employees"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
          aria-label="Quay lại danh sách nhân viên"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quản lý ca — {employee ? employee.name : '…'}
          </h1>
          {employee && (
            <p className="mt-0.5 text-sm text-gray-500">{employee.email}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="ml-auto shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Gán ca
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}{' '}
          <button onClick={() => void fetchAll()} className="underline">Thử lại</button>
        </div>
      )}

      {/* Add-shift form */}
      {showAddForm && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Gán ca mới</h2>
          <form onSubmit={(e) => void handleAddSubmit(e)} noValidate className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Ngày</label>
              <input
                type="date"
                value={addForm.date}
                onChange={(e) => {
                  setAddForm((p) => ({ ...p, date: e.target.value }))
                  setFormErrors((p) => ({ ...p, date: '' }))
                }}
                className={inputClass}
              />
              {formErrors.date && <p className="mt-1 text-xs text-red-500">{formErrors.date}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Giờ bắt đầu</label>
                <input
                  type="time"
                  value={addForm.startTime}
                  onChange={(e) => {
                    setAddForm((p) => ({ ...p, startTime: e.target.value }))
                    setFormErrors((p) => ({ ...p, startTime: '' }))
                  }}
                  className={inputClass}
                />
                {formErrors.startTime && <p className="mt-1 text-xs text-red-500">{formErrors.startTime}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Giờ kết thúc</label>
                <input
                  type="time"
                  value={addForm.endTime}
                  onChange={(e) => {
                    setAddForm((p) => ({ ...p, endTime: e.target.value }))
                    setFormErrors((p) => ({ ...p, endTime: '' }))
                  }}
                  className={inputClass}
                />
                {formErrors.endTime && <p className="mt-1 text-xs text-red-500">{formErrors.endTime}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setFormErrors({}) }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                Lưu ca
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit-shift form */}
      {editingShift && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Sửa ca làm</h2>
          <form onSubmit={(e) => void handleEditSubmit(e)} noValidate className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Ngày</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => {
                  setEditForm((p) => ({ ...p, date: e.target.value }))
                  setFormErrors((p) => ({ ...p, date: '' }))
                }}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Giờ bắt đầu</label>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Giờ kết thúc</label>
                <input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shift list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-xl bg-surface py-12 text-center shadow-sm ring-1 ring-gray-200">
          <span className="text-4xl">📅</span>
          <p className="mt-3 text-sm font-medium text-gray-500">Chưa có ca làm nào</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            Gán ca đầu tiên
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {shifts.map((shift) => (
            <li
              key={shift.id}
              className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 shadow-sm ring-1 ring-gray-200"
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{formatDate(shift.startTime)}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{formatShiftTime(shift.startTime, shift.endTime)}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[shift.status]}`}
                >
                  {STATUS_LABELS[shift.status]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(shift)}
                  className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(shift)}
                  className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Xác nhận xóa ca</h3>
            <p className="mt-2 text-sm text-gray-600">
              Bạn có chắc muốn xóa ca ngày{' '}
              <strong>{formatDate(deleteTarget.startTime)}</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa…' : 'Xóa ca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
