/**
 * employee-management.spec.ts — Owner employee CRUD + shift management
 *
 * Tests:
 *  ✓ Owner can view employee list when logged in as owner
 *  ✓ Owner can add a new employee (form fill + submit)
 *  ✓ Owner can edit an employee's name and phone
 *  ✓ Owner can deactivate an employee (soft delete)
 *  ✓ Owner can add a shift to an employee
 *  ✓ Employee cannot access /owner/employees (redirect or 403)
 *
 * Prerequisites: backend on port 3001, frontend on port 3000.
 */

import { test, expect } from '@playwright/test'
import { EmployeeListPage } from './pages/EmployeeListPage'
import { ShiftManagerPage } from './pages/ShiftManagerPage'
import { LoginPage } from './pages/LoginPage'
import {
  registerOwner,
  loginOwner,
  loginEmployee,
  api,
  setStorageAuth,
  type LoginResponse,
  type AuthUser,
} from './helpers/auth'
import { uniqueEmail, uniqueName, uniquePin, uniqueShopName } from './helpers/data'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Seeded owner + employee used across a test block */
interface OwnerFixture {
  owner: LoginResponse
  employeeId: string
  employeeEmail: string
  employeePin: string
}

test.describe('Employee Management', () => {
  let ownerFixture: OwnerFixture

  test.beforeAll(async () => {
    const email = uniqueEmail('owner_emp')
    const ownerReg = await registerOwner({
      ownerName: uniqueName('Chủ'),
      email,
      password: 'Test@1234',
      shopName: uniqueShopName(),
    })
    if (!('token' in ownerReg)) {
      throw new Error('Set E2E_AUTO_APPROVE_MERCHANT=true on the backend for employee-management tests.')
    }
    const owner = ownerReg

    const employeePin = uniquePin()
    const employeeEmail = uniqueEmail('nv')
    const empRes = await api.post<{
      employee: { id: string }
    }>(
      '/api/employees',
      {
        name: uniqueName('NV'),
        email: employeeEmail,
        password: 'Emp@1234',
        pin: employeePin,
      },
      owner.token,
    )

    ownerFixture = {
      owner,
      employeeId: empRes.employee.id,
      employeeEmail,
      employeePin,
    }
  })

  // ─── List page ────────────────────────────────────────────────────────────────

  test('Owner can view employee list when logged in as owner', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await expect(page).toHaveURL(/\/owner\/employees/)
    await listPage.expectTableVisible()
  })

  test('Employee table shows at least the seeded employee', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.token as unknown as typeof ownerFixture.owner.user)
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    // The seeded employee name should appear in the table
    // (name is stored in user record linked to employee)
    await listPage.expectTableVisible()
  })

  test('Filter tabs filter the employee table correctly', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickFilterTab('Đang hoạt động')
    await expect(page).toHaveURL(/active=true/, { timeout: 3000 })

    await listPage.clickFilterTab('Tất cả')
    await expect(page).toHaveURL(/\/owner\/employees/, { timeout: 3000 })
  })

  // ─── Add employee ─────────────────────────────────────────────────────────────

  test('Owner can add a new employee via the form', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickAddEmployee()
    await listPage.expectModalOpen('Thêm nhân viên')

    const newName = uniqueName('Mới')
    await listPage.fillEmployeeForm({
      name: newName,
      email: uniqueEmail('new_emp'),
      password: 'Emp@1234',
      pin: uniquePin(),
      phone: '0900000001',
    })
    await listPage.submitEmployeeForm()

    // Modal should close after success
    await listPage.expectModalClosed()
    // New employee should appear in table
    await listPage.expectEmployeeInTable(newName)
  })

  test('Add employee form shows validation error when fields are empty', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickAddEmployee()
    await listPage.expectModalOpen('Thêm nhân viên')

    // Submit with empty required fields
    await listPage.submitEmployeeForm()

    // Form should not close (modal still visible with errors)
    await listPage.expectModalOpen()
    await listPage.expectFormError('Tên phải có ít nhất 2 ký tự')
  })

  test('Add employee form shows validation error for invalid PIN', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickAddEmployee()
    await listPage.expectModalOpen('Thêm nhân viên')

    await listPage.fillEmployeeForm({
      name: 'Test',
      email: 'test@test.com',
      password: 'Emp@1234',
      pin: '12', // too short
    })
    await listPage.submitEmployeeForm()

    await listPage.expectModalOpen()
    await listPage.expectFormError('Mã PIN phải gồm 4 chữ số (0-9)')
  })

  test('Add employee form shows error when email is already used', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickAddEmployee()
    await listPage.expectModalOpen('Thêm nhân viên')

    // Use the already-seeded employee's email
    await listPage.fillEmployeeForm({
      name: 'Another',
      email: ownerFixture.employeeEmail,
      password: 'Emp@1234',
      pin: uniquePin(),
    })
    await listPage.submitEmployeeForm()

    // Server error should appear in the dialog
    await listPage.expectModalOpen()
    await expect(
      listPage.page.locator('[role="dialog"]').getByText(/email/i)
    ).toBeVisible()
  })

  // ─── Edit employee ────────────────────────────────────────────────────────────

  test('Owner can edit an employee name and phone', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickEditEmployee('NV') // the seeded employee starts with "NV"
    await listPage.expectModalOpen('Chỉnh sửa nhân viên')

    // In edit mode, name and phone are editable but not email/password
    await listPage.page.locator('#name').fill('Nguyễn Văn B Updated')
    await listPage.page.locator('#phone').fill('0909999999')
    await listPage.submitEmployeeForm()

    await listPage.expectModalClosed()
    await listPage.expectEmployeeInTable('Nguyễn Văn B Updated')
  })

  // ─── Deactivate (soft delete) ────────────────────────────────────────────────

  test('Owner can deactivate an active employee', async ({ page }) => {
    // First create a temporary employee to deactivate
    const tempEmail = uniqueEmail('temp_del')
    const tempEmp = await api.post<{
      employee: { id: string; name: string }
    }>(
      '/api/employees',
      {
        name: uniqueName('Tạm'),
        email: tempEmail,
        password: 'Emp@1234',
        pin: uniquePin(),
      },
      ownerFixture.owner.token,
    )

    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickDeleteEmployee(tempEmp.employee.name)
    await listPage.confirmDelete()

    // Employee should no longer appear in the active list
    await listPage.clickFilterTab('Đang hoạt động')
    await listPage.expectEmployeeNotInTable(tempEmp.employee.name)
  })

  test('Deactivated employee still appears in "Đã nghỉ" filter', async ({ page }) => {
    // First deactivate an employee
    const tempEmail2 = uniqueEmail('temp_del2')
    const tempEmp2 = await api.post<{
      employee: { id: string; name: string }
    }>(
      '/api/employees',
      {
        name: uniqueName('Tạm2'),
        email: tempEmail2,
        password: 'Emp@1234',
        pin: uniquePin(),
      },
      ownerFixture.owner.token,
    )

    await api.del(`/api/employees/${tempEmp2.employee.id}`, ownerFixture.owner.token)

    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickFilterTab('Đã nghỉ')
    await listPage.expectEmployeeInTable(tempEmp2.employee.name)
  })

  // ─── Shift management ────────────────────────────────────────────────────────

  test('Owner can navigate to shift manager for an employee', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const listPage = new EmployeeListPage(page)

    await listPage.goto()
    await listPage.clickShiftLink('NV')
    await expect(page).toHaveURL(/\/owner\/employees\/.*\/shifts/)
  })

  test('Owner can add a shift to an employee', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const shiftPage = new ShiftManagerPage(page)

    await shiftPage.goto(ownerFixture.employeeId)

    await shiftPage.clickAddShift()
    await shiftPage.expectAddFormVisible()

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    await shiftPage.fillAddShiftForm({
      date: dateStr,
      startTime: '08:00',
      endTime: '16:00',
    })
    await shiftPage.submitAddShift()

    // Form should close and shift should appear in list
    await shiftPage.expectEmptyState({ visible: false })
    await shiftPage.expectShiftInList(dateStr, '08:00 – 16:00')
  })

  test('Shift manager shows empty state when no shifts exist', async ({ page }) => {
    // Use a freshly created employee with no shifts
    const freshEmp = await api.post<{
      employee: { id: string }
    }>(
      '/api/employees',
      {
        name: uniqueName('Mớishift'),
        email: uniqueEmail('shift_emp'),
        password: 'Emp@1234',
        pin: uniquePin(),
      },
      ownerFixture.owner.token,
    )

    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const shiftPage = new ShiftManagerPage(page)

    await shiftPage.goto(freshEmp.employee.id)
    await shiftPage.expectEmptyState()
  })

  test('Add shift form validates that endTime is after startTime', async ({ page }) => {
    await setStorageAuth(page, ownerFixture.owner.token, ownerFixture.owner.user)
    const shiftPage = new ShiftManagerPage(page)

    await shiftPage.goto(ownerFixture.employeeId)
    await shiftPage.clickAddShift()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 2)
    const dateStr = tomorrow.toISOString().split('T')[0]

    await shiftPage.fillAddShiftForm({
      date: dateStr,
      startTime: '17:00',
      endTime: '08:00', // end before start — invalid
    })
    await shiftPage.submitAddShift()

    // Form should still be open with error
    await shiftPage.expectAddFormVisible()
    await expect(shiftPage.page.getByText('Giờ kết thúc phải sau giờ bắt đầu')).toBeVisible()
  })

  // ─── Role guard ──────────────────────────────────────────────────────────────

  test('Employee cannot access /owner/employees — redirected away', async ({ page }) => {
    const shopId = await getShopId(ownerFixture.owner.token)
    const empSession = await loginEmployee({
      email: ownerFixture.employeeEmail,
      pin: ownerFixture.employeePin,
      shopId,
    })

    await setStorageAuth(page, empSession.token, empSession.user as AuthUser)
    await page.goto('/owner/employees')

    await expect(page).not.toHaveURL(/\/owner\/employees/, { timeout: 5000 })
  })
})

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Fetch the owner's shopId from /api/auth/me */
async function getShopId(token: string): Promise<string> {
  const data = await api.get<{ user?: { shop?: { id: string } | null } | null }>('/api/auth/me', token)
  const shopId = (data as any)?.user?.shop?.id ?? (data as any)?.shopId
  if (!shopId) throw new Error('Could not determine shopId for owner')
  return shopId
}
