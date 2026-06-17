/**
 * ShiftManagerPage — page object for /owner/employees/:id/shifts
 *
 * Key elements:
 *  - Back link        → a[aria-label="Quay lại danh sách nhân viên"]
 *  - Page heading    → h1:has-text("Quản lý ca")
 *  - "Gán ca" button → button:has-text("Gán ca")
 *  - Shift form (add) → form with date, startTime, endTime inputs
 *  - Shift form (edit) → similar, shown when editing
 *  - Shift list      → ul li (each shift card)
 *  - Shift time text → "HH:MM – HH:MM"
 *  - Shift status badge → span with "Sắp tới" / "Đang làm" / "Hoàn thành"
 *  - Edit per shift  → button:has-text("Sửa") in shift card
 *  - Delete per shift → button:has-text("Xóa") in shift card
 *  - Delete confirm  → fixed overlay with "Xác nhận xóa ca"
 *  - Empty state     → text "Chưa có ca làm nào"
 */

import { type Page, expect } from '@playwright/test'

export class ShiftManagerPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto(employeeId: string) {
    await this.page.goto(`/owner/employees/${employeeId}/shifts`)
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  async clickBack() {
    await this.page.locator('a[aria-label="Quay lại danh sách nhân viên"]').click()
  }

  async expectEmployeeName(name: string) {
    await expect(this.page.locator('h1')).toContainText(name)
  }

  // ─── Add shift ──────────────────────────────────────────────────────────────

  async clickAddShift() {
    await this.page.locator('button', { hasText: 'Gán ca' }).click()
  }

  async expectAddFormVisible() {
    await expect(this.page.getByText('Gán ca mới')).toBeVisible()
  }

  async fillAddShiftForm(opts: { date: string; startTime: string; endTime: string }) {
    await this.page.locator('input[type="date"]').fill(opts.date)
    // startTime and endTime are time inputs
    const timeInputs = this.page.locator('input[type="time"]')
    await timeInputs.nth(0).fill(opts.startTime)
    await timeInputs.nth(1).fill(opts.endTime)
  }

  async submitAddShift() {
    // Inside the add-shift section, find the submit button labeled "Lưu ca"
    await this.page.locator('button', { hasText: 'Lưu ca' }).click()
  }

  async cancelAddShift() {
    await this.page.locator('button', { hasText: 'Hủy' }).click()
  }

  // ─── Shift list ─────────────────────────────────────────────────────────────

  async expectShiftCount(count: number) {
    const items = this.page.locator('ul li')
    await expect(items).toHaveCount(count)
  }

  async expectEmptyState(opts?: { visible: true }) {
    const el = this.page.getByText('Chưa có ca làm nào')
    if (opts?.visible ?? true) {
      await expect(el).toBeVisible()
    } else {
      await expect(el).toBeHidden()
    }
  }

  async expectShiftInList(dateLabel: string, timeRange: string) {
    await expect(this.page.getByText(dateLabel)).toBeVisible()
    await expect(this.page.getByText(timeRange)).toBeVisible()
  }

  // ─── Edit shift ─────────────────────────────────────────────────────────────

  async clickEditShift(index: number) {
    const editButtons = this.page.locator('ul li button', { hasText: 'Sửa' })
    await editButtons.nth(index).click()
  }

  async expectEditFormVisible() {
    await expect(this.page.getByText('Sửa ca làm')).toBeVisible()
  }

  // ─── Delete shift ───────────────────────────────────────────────────────────

  async clickDeleteShift(index: number) {
    const deleteButtons = this.page.locator('ul li button', { hasText: 'Xóa' })
    await deleteButtons.nth(index).click()
  }

  async confirmDeleteShift() {
    await this.page.locator('button', { hasText: 'Xóa ca' }).last().click()
  }

  async cancelDeleteShift() {
    await this.page.locator('button', { hasText: 'Hủy' }).first().click()
  }

  async expectDeleteDialogVisible() {
    await expect(this.page.getByText('Xác nhận xóa ca')).toBeVisible()
  }

  // ─── Status badge ───────────────────────────────────────────────────────────

  async expectStatusBadge(status: 'Sắp tới' | 'Đang làm' | 'Hoàn thành' | 'Đã hủy') {
    await expect(this.page.getByText(status).first()).toBeVisible()
  }
}
