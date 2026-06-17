/**
 * NotificationPanel — page object for the notification bell + panel.
 *
 * This component lives in the navbar and is present on all owner/employee pages.
 * Instantiate alongside another POM that has the bell in its layout.
 *
 * Key elements:
 *  - Bell button       → button[aria-label*="Thông báo"]
 *  - Unread badge      → span[aria-label*="thông báo chưa đọc"]
 *  - Notification panel → div[aria-label="Danh sách thông báo"] (role=listbox)
 *  - Mark all read btn → button:has-text("Đánh dấu tất cả đã đọc")
 *  - Notification item  → [role="option"] (each notification row)
 *  - Empty state       → text "Không có thông báo nào"
 *  - Type emoji per type: 🍽️ NEW_ORDER, 🆘 SUPPORT_REQUEST, 💬 CHAT_MESSAGE
 */

import { type Page, expect, type Locator } from '@playwright/test'

export class NotificationPanel {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // ─── Bell ─────────────────────────────────────────────────────────────────────

  bell(): Locator {
    return this.page.locator('button[aria-label*="Thông báo"]')
  }

  async open() {
    await this.bell().click()
    await this.expectPanelVisible()
  }

  async close() {
    // Click outside the panel
    await this.page.keyboard.press('Escape')
    // Fallback: click bell again to toggle off
    await this.bell().click()
  }

  // ─── Badge ───────────────────────────────────────────────────────────────────

  async expectBadgeCount(count: number) {
    const badge = this.bell().locator('span[aria-label*="thông báo chưa đọc"]')
    if (count === 0) {
      await expect(badge).toBeHidden()
    } else {
      await expect(badge).toBeVisible()
      await expect(badge).toContainText(count > 99 ? '99+' : String(count))
    }
  }

  async expectNoBadge() {
    await expect(this.bell().locator('span[aria-label*="thông báo chưa đọc"]')).toBeHidden()
  }

  // ─── Panel ───────────────────────────────────────────────────────────────────

  panel(): Locator {
    return this.page.locator('[aria-label="Danh sách thông báo"]')
  }

  async expectPanelVisible() {
    await expect(this.panel()).toBeVisible()
  }

  async expectPanelHidden() {
    await expect(this.panel()).toBeHidden()
  }

  // ─── Notification items ───────────────────────────────────────────────────────

  items(): Locator {
    return this.panel().locator('[role="option"]')
  }

  async expectItemCount(count: number) {
    await expect(this.items()).toHaveCount(count)
  }

  async expectItemWithTitle(title: string) {
    await expect(this.panel().getByText(title)).toBeVisible()
  }

  async expectItemWithEmoji(emoji: string) {
    await expect(this.panel().getByText(emoji).first()).toBeVisible()
  }

  async clickItem(title: string) {
    await this.panel().getByText(title).first().click()
  }

  // ─── Mark all read ────────────────────────────────────────────────────────────

  markAllReadButton(): Locator {
    return this.panel().locator('button', { hasText: 'Đánh dấu tất cả đã đọc' })
  }

  async expectMarkAllReadVisible(opts?: { visible: false }) {
    const btn = this.markAllReadButton()
    if (opts?.visible === false) {
      await expect(btn).toBeHidden()
    } else {
      await expect(btn).toBeVisible()
    }
  }

  async clickMarkAllRead() {
    await this.markAllReadButton().click()
  }

  // ─── Empty state ──────────────────────────────────────────────────────────────

  async expectEmptyState() {
    await expect(this.panel().getByText('Không có thông báo nào')).toBeVisible()
  }

  // ─── SSE connection indicator ─────────────────────────────────────────────────

  async expectConnected() {
    // Green dot = connected
    await expect(
      this.bell().locator('span[title="Đã kết nối"]')
    ).toBeVisible()
  }
}
