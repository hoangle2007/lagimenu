/**
 * OwnerDashboardPage — page object for /owner/dashboard
 *
 * Key elements:
 *  - Page heading    → h1:has-text("Tổng quan")
 *  - Stat cards     → 3 cards: "Đơn hàng hôm nay", "Yêu cầu hỗ trợ chờ xử lý", "Nhân viên đang hoạt động"
 *  - Stat values    → p.text-3xl.font-bold in each card
 *  - NotificationBell → button[aria-label*="Thông báo"] (in header)
 *  - Recent notifications section → h2:has-text("Thông báo gần đây")
 *  - Nav links      → sidebar/header links to /owner/employees, /owner/orders, /owner/support
 */

import { type Page, expect } from '@playwright/test'
import { NotificationPanel } from './NotificationPanel'

export class OwnerDashboardPage {
  readonly page: Page
  readonly notifications: NotificationPanel

  constructor(page: Page) {
    this.page = page
    this.notifications = new NotificationPanel(page)
  }

  async goto() {
    await this.page.goto('/owner/dashboard')
  }

  async expectStatsLoaded() {
    // Wait for stat cards to populate (not show '…' placeholder)
    await this.page.waitForFunction(() => {
      const vals = document.querySelectorAll('p.text-3xl')
      return Array.from(vals).every((el) => el.textContent !== '…')
    }, { timeout: 8000 })
  }

  async expectStatCard(label: string) {
    await expect(this.page.getByText(label)).toBeVisible()
  }

  async expectStatValue(label: string, operator: '>' | '<' | '=', value: number | string) {
    const card = this.page.locator('button', { hasText: label })
    const val = card.locator('p.text-3xl')
    await expect(val).toBeVisible()
    if (operator === '=') {
      await expect(val).toContainText(String(value))
    }
  }

  async expectRecentNotificationsSection() {
    await expect(this.page.getByRole('heading', { name: 'Thông báo gần đây' })).toBeVisible()
  }

  async expectEmptyNotifications() {
    await expect(this.page.getByText('Không có thông báo nào')).toBeVisible()
  }

  async clickStatCard(label: string) {
    await this.page.locator('button', { hasText: label }).click()
  }

  async expectRedirectTo(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path))
  }

  // ─── Notification bell (delegate to NotificationPanel) ─────────────────────

  async openNotificationBell() {
    await this.notifications.open()
  }

  async expectNotificationBadge(count: number) {
    await this.notifications.expectBadgeCount(count)
  }

  async expectNotificationPanel() {
    await this.notifications.expectPanelVisible()
  }
}
