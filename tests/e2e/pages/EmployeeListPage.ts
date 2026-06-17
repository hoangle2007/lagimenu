/**
 * EmployeeListPage — page object for /owner/employees
 *
 * Key elements:
 *  - Add employee button → button:has-text("Thêm nhân viên")
 *  - Filter tabs       → button group with "Tất cả", "Đang hoạt động", "Đã nghỉ"
 *  - Employee table    → table.w-full
 *  - Table rows        → tbody tr
 *  - Edit button per row → button:has-text("Sửa") in row
 *  - Delete button per row → button:has-text("Xóa") in row
 *  - Shift link per row → a:has-text("Quản lý ca")
 *  - Empty state      → text "Chưa có nhân viên nào"
 *  - Modal (form)     → role=dialog
 *  - Delete confirm dialog → modal with "Xác nhận xóa nhân viên"
 */

import { type Page, expect, type Locator } from '@playwright/test'

export class EmployeeListPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/owner/employees')
  }

  // ─── Add employee ──────────────────────────────────────────────────────────────

  async clickAddEmployee() {
    await this.page.locator('button', { hasText: 'Thêm nhân viên' }).click()
  }

  // ─── Employee form (inside modal) ────────────────────────────────────────────

  async fillEmployeeForm(opts: {
    name: string
    email: string
    password: string
    pin: string
    phone?: string
  }) {
    if (opts.name) await this.page.locator('#name').fill(opts.name)
    if (opts.email) await this.page.locator('#email').fill(opts.email)
    if (opts.password) await this.page.locator('#password').fill(opts.password)
    if (opts.pin) await this.page.locator('#pin').fill(opts.pin)
    if (opts.phone) await this.page.locator('#phone').fill(opts.phone)
  }

  async submitEmployeeForm() {
    // The submit button label changes between "Tạo nhân viên" (create) and "Lưu thay đổi" (edit)
    await this.page.locator('[role="dialog"] button[type="submit"]').click()
  }

  async cancelEmployeeForm() {
    await this.page.locator('[role="dialog"] button[type="button"]').click()
  }

  // ─── Table assertions ─────────────────────────────────────────────────────────

  async expectEmployeeInTable(name: string) {
    await expect(this.page.locator('table').getByText(name)).toBeVisible()
  }

  async expectEmployeeNotInTable(name: string) {
    await expect(this.page.locator('table').getByText(name)).toBeHidden()
  }

  async expectTableVisible() {
    await expect(this.page.locator('table')).toBeVisible()
  }

  async expectEmptyState() {
    await expect(this.page.getByText('Chưa có nhân viên nào')).toBeVisible()
  }

  async expectRowCount(count: number) {
    const rows = this.page.locator('tbody tr')
    await expect(rows).toHaveCount(count)
  }

  // ─── Actions per row ─────────────────────────────────────────────────────────

  async clickEditEmployee(name: string) {
    const row = this.page.locator('tbody tr').filter({ hasText: name })
    await row.locator('button', { hasText: 'Sửa' }).click()
  }

  async clickDeleteEmployee(name: string) {
    const row = this.page.locator('tbody tr').filter({ hasText: name })
    await row.locator('button', { hasText: 'Xóa' }).click()
  }

  async clickShiftLink(name: string) {
    const row = this.page.locator('tbody tr').filter({ hasText: name })
    await row.locator('a', { hasText: 'Quản lý ca' }).click()
  }

  // ─── Delete confirmation dialog ───────────────────────────────────────────────

  async confirmDelete() {
    // The confirm dialog has title "Xác nhận xóa nhân viên"
    await this.page.locator('[role="dialog"] button', { hasText: 'Xóa nhân viên' }).click()
  }

  async cancelDelete() {
    await this.page.locator('[role="dialog"] button', { hasText: 'Hủy' }).click()
  }

  // ─── Filter tabs ──────────────────────────────────────────────────────────────

  async clickFilterTab(label: 'Tất cả' | 'Đang hoạt động' | 'Đã nghỉ') {
    await this.page.locator('button', { hasText: label }).click()
  }

  async expectStatusBadge(name: string, status: 'Hoạt động' | 'Đã nghỉ') {
    const row = this.page.locator('tbody tr').filter({ hasText: name })
    await expect(row.getByText(status)).toBeVisible()
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────────

  async expectModalOpen(title?: string) {
    const dialog = this.page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    if (title) await expect(dialog.getByText(title)).toBeVisible()
  }

  async expectModalClosed() {
    await expect(this.page.locator('[role="dialog"]')).toBeHidden()
  }

  async expectFormError(message: string) {
    await expect(this.page.locator('[role="dialog"]')).getByText(message).toBeVisible()
  }
}
