/**
 * EmployeeForm — create or edit an employee.
 *
 * Modes:
 *  - Create: fields name, email, password, pin, phone
 *  - Edit:   fields name, phone, pin (password not editable)
 *
 * Validation: name min 2 chars, email format, password min 6 (create only),
 *             PIN exactly 4 digits (0-9).
 */

import { useState, type FormEvent } from 'react'
import {
  employeesApi,
  type EmployeeWithUser,
  type CreateEmployeeBody,
  type StaffNotifyRole,
} from '@/api/employees'

const NOTIFY_ROLE_OPTIONS: { value: StaffNotifyRole; label: string; hint: string }[] = [
  { value: 'all', label: 'Tất cả thông báo', hint: 'Giống chủ quầy — mọi sự kiện' },
  { value: 'waiter', label: 'Phục vụ', hint: 'Đơn mới, gọi NV, gọi thanh toán, trạng thái' },
  { value: 'cashier', label: 'Thu ngân', hint: 'Gọi thanh toán, xác nhận chuyển khoản' },
  { value: 'kitchen', label: 'Bếp / làm nước', hint: 'Đơn mới, cập nhật trạng thái món' },
]

interface Props {
  employee?: EmployeeWithUser | null
  onSuccess: (emp: EmployeeWithUser) => void
  onCancel: () => void
}

// ─── Validation ─────────────────────────────────────────────────────────────────

type FormFields = CreateEmployeeBody & { notifyRole: StaffNotifyRole }
type Errors = Partial<Record<keyof FormFields, string>>

function validate(data: Partial<FormFields>, isCreate: boolean): Errors {
  const errors: Errors = {}
  if (!data.name || data.name.trim().length < 2)
    errors.name = 'Tên phải có ít nhất 2 ký tự'
  if (isCreate && (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)))
    errors.email = 'Email không hợp lệ'
  if (isCreate && (!data.password || data.password.length < 6))
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
  const pin = data.pin?.trim() ?? ''
  if (isCreate && (!pin || !/^\d{4}$/.test(pin)))
    errors.pin = 'Mã PIN phải gồm 4 chữ số (0-9)'
  if (!isCreate && pin.length > 0 && !/^\d{4}$/.test(pin))
    errors.pin = 'Mã PIN phải gồm 4 chữ số (0-9) hoặc để trống để giữ cũ'
  return errors
}

// ─── Shared Component ──────────────────────────────────────────────────────────

const Field = ({
  label,
  name,
  error,
  children,
}: {
  label: string
  name: string
  error?: string
  children: React.ReactNode
}) => (
  <div>
    <label
      htmlFor={name}
      className="mb-1 block text-sm font-medium text-gray-700"
    >
      {label}
    </label>
    {children}
    {error && (
      <p role="alert" className="mt-1 text-xs text-red-500">
        {error}
      </p>
    )}
  </div>
)

// ─── Component ─────────────────────────────────────────────────────────────────

export default function EmployeeForm({ employee, onSuccess, onCancel }: Props) {
  const isCreate = !employee

  const [form, setForm] = useState<Partial<FormFields>>({
    name: employee?.name ?? '',
    email: employee?.email ?? '',
    password: '',
    pin: '',
    phone: employee?.phone ?? '',
    notifyRole: employee?.notifyRole ?? 'all',
  })

  const [errors, setErrors] = useState<Errors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const setField = <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear field error on change
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const validationErrors = validate(form, isCreate)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      let finalEmployee: EmployeeWithUser
      if (isCreate) {
        const { data } = await employeesApi.create({
          ...(form as CreateEmployeeBody),
          notifyRole: form.notifyRole ?? 'all',
        })
        finalEmployee = data.employee
      } else {
        const { data } = await employeesApi.update(employee.id, {
          name: form.name,
          phone: form.phone,
          pin: form.pin?.length === 4 ? form.pin : undefined,
          notifyRole: form.notifyRole,
        })
        finalEmployee = data.employee
      }
      onSuccess(finalEmployee)
    } catch (err) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const msg =
        axiosErr?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
      setServerError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = (hasError: boolean) =>
    `mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
      hasError
        ? 'border-red-400 bg-red-50 focus:border-red-400'
        : 'border-gray-300 focus:border-indigo-400'
    }`

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
      {/* Name */}
      <Field label="Tên nhân viên" name="name" error={errors.name}>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          className={inputClass(!!errors.name)}
          placeholder="Nguyễn Văn A"
        />
      </Field>

      {/* Email (create only) */}
      {isCreate && (
        <Field label="Email" name="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            className={inputClass(!!errors.email)}
            placeholder="nvana@lagi.vn"
          />
        </Field>
      )}

      {/* Password (create only) */}
      {isCreate && (
        <Field label="Mật khẩu" name="password" error={errors.password}>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            className={inputClass(!!errors.password)}
            placeholder="••••••"
          />
        </Field>
      )}

      {/* PIN */}
      <Field label="Mã PIN (4 chữ số)" name="pin" error={errors.pin}>
        <input
          id="pin"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={form.pin}
          onChange={(e) => setField('pin', e.target.value.replace(/\D/g, ''))}
          className={`${inputClass(!!errors.pin)} font-mono tracking-widest`}
          placeholder="1234"
        />
        <p className="mt-1 text-xs text-gray-400">
          Dùng để đăng nhập nhanh tại quầy
        </p>
      </Field>

      {/* Phone */}
      <Field label="Số điện thoại (tùy chọn)" name="phone" error={errors.phone}>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value ?? undefined)}
          className={inputClass(false)}
          placeholder="0901234567"
        />
      </Field>

      <Field label="Loại thông báo" name="notifyRole" error={errors.notifyRole}>
        <select
          id="notifyRole"
          value={form.notifyRole ?? 'all'}
          onChange={(e) => setField('notifyRole', e.target.value as StaffNotifyRole)}
          className={inputClass(!!errors.notifyRole)}
        >
          {NOTIFY_ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          {NOTIFY_ROLE_OPTIONS.find((o) => o.value === (form.notifyRole ?? 'all'))?.hint}
        </p>
      </Field>

      {/* Server error */}
      {serverError && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {serverError}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          disabled={isSubmitting}
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting && (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isCreate ? 'Tạo nhân viên' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  )
}
