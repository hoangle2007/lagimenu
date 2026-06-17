/**
 * EmployeeList — employee management table with create/edit/delete.
 *
 * Features:
 *  - Filter tabs: Tất cả / Đang hoạt động / Đã nghỉ
 *  - "Thêm nhân viên" button → opens EmployeeForm modal (create mode)
 *  - Edit button → opens EmployeeForm modal (edit mode, pre-filled)
 *  - Delete (deactivate) button → confirmation dialog
 *  - Lists: name, email, phone, PIN (masked "••••"), isActive, created date
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { employeesApi, type EmployeeWithUser, STAFF_NOTIFY_ROLE_LABELS } from '@/api/employees'
import EmployeeForm from '@/components/employee/EmployeeForm'
import Modal from '@/components/ui/Modal'

type FilterTab = 'all' | 'active' | 'inactive'

export default function EmployeeList() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [employees, setEmployees] = useState<EmployeeWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithUser | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWithUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchEmployees = useCallback(async (activeFilter?: boolean) => {
    setIsLoading(true)
    setError(null)
    try {
      const params: { active?: boolean } = {}
      if (activeFilter === true) params.active = true
      if (activeFilter === false) params.active = false
      const { data } = await employeesApi.list(params)
      setEmployees(data.employees)
    } catch {
      setError('Không thể tải danh sách nhân viên.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const activeFilter =
      filter === 'active' ? true : filter === 'inactive' ? false : undefined
    void fetchEmployees(activeFilter)
  }, [filter, fetchEmployees])

  const handleCreated = (newEmp: EmployeeWithUser) => {
    setEmployees((prev) => [newEmp, ...prev])
    setFormOpen(false)
    toast.success(`Đã thêm nhân viên "${newEmp.name}"`)
  }

  const handleUpdated = (updated: EmployeeWithUser) => {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingEmployee(null)
    setFormOpen(false)
    toast.success('Đã cập nhật thông tin nhân viên')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await employeesApi.delete(deleteTarget.id)
      setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id))
      toast.success(`Đã vô hiệu hóa nhân viên "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch {
      toast.error('Không thể xóa nhân viên. Vui lòng thử lại.')
    } finally {
      setIsDeleting(false)
    }
  }

  const openCreate = () => {
    setEditingEmployee(null)
    setFormOpen(true)
  }

  const openEdit = (emp: EmployeeWithUser) => {
    setEditingEmployee(emp)
    setFormOpen(true)
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'active', label: 'Đang hoạt động' },
    { key: 'inactive', label: 'Đã nghỉ' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Nhân viên</h1>
          <p className="mt-1 text-sm text-gray-500">
            {employees.length} nhân viên
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          + Thêm nhân viên
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-surface text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-gray-200">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => void fetchEmployees()}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              Thử lại
            </button>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl" aria-hidden="true">👤</span>
            <p className="mt-3 text-sm font-medium text-gray-500">Chưa có nhân viên nào</p>
            <button
              onClick={openCreate}
              className="mt-3 text-sm text-indigo-600 hover:underline"
            >
              Thêm nhân viên đầu tiên
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Thông báo</th>
                <th className="px-4 py-3">Điện thoại</th>
                <th className="px-4 py-3">PIN</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3">Ca làm</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-surface-container-low px-2 py-0.5 text-xs font-medium text-slate-700">
                      {STAFF_NOTIFY_ROLE_LABELS[emp.notifyRole] ?? emp.notifyRole}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{emp.phone ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">••••</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        emp.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          emp.isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      />
                      {emp.isActive ? 'Hoạt động' : 'Đã nghỉ'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {emp.createdAt
                      ? new Date(emp.createdAt).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/owner/employees/${emp.id}/shifts`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Quản lý ca
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(emp)}
                        className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                      >
                        Sửa
                      </button>
                      {emp.isActive && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(emp)}
                          className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingEmployee(null) }}
        title={editingEmployee ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}
        size="md"
      >
        <EmployeeForm
          employee={editingEmployee}
          onSuccess={editingEmployee ? handleUpdated : handleCreated}
          onCancel={() => { setFormOpen(false); setEditingEmployee(null) }}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận xóa nhân viên"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc muốn vô hiệu hóa nhân viên{' '}
          <strong className="text-gray-900">{deleteTarget?.name}</strong>?
          Hành động này không thể hoàn tác.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isDeleting}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            disabled={isDeleting}
          >
            {isDeleting ? 'Đang xóa…' : 'Xóa nhân viên'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
