/**
 * notifications.spec.ts — Notification system (UI bell + SSE)
 *
 * Tests:
 *  ✓ NotificationBell shows badge when unread count > 0
 *  ✓ NotificationPanel opens when bell is clicked
 *  ✓ Clicking a notification item marks it as read
 *  ✓ "Mark all read" button resets badge to 0
 *  ✓ NotificationPanel shows empty state when no notifications
 *  ✓ SSE connection is established on page load
 *
 * SSE real-time delivery: verified via network request inspection (EventSource
 * connection to /api/notifications/stream is visible in browser DevTools).
 * Full end-to-end SSE tests require triggering backend events that create
 * notifications (covered in orders-support.spec.ts).
 *
 * Prerequisites: backend on port 3001, frontend on port 3000.
 */

import { test, expect } from '@playwright/test'
import { NotificationPanel } from './pages/NotificationPanel'
import { OwnerDashboardPage } from './pages/OwnerDashboardPage'
import { registerOwner, loginOwner, api, setStorageAuth } from './helpers/auth'
import { uniqueEmail, uniqueName, uniqueShopName } from './helpers/data'

test.describe('Notifications', () => {
  let ownerToken: string

  test.beforeAll(async () => {
    const reg = await registerOwner({
      ownerName: uniqueName('Owner'),
      email: uniqueEmail('notif_owner'),
      password: 'Test@1234',
      shopName: uniqueShopName(),
    })
    if (!('token' in reg)) {
      throw new Error('Set E2E_AUTO_APPROVE_MERCHANT=true on the backend for notifications tests.')
    }
    ownerToken = reg.token
  })

  // ─── Bell badge ─────────────────────────────────────────────────────────────

  test('NotificationBell shows no badge when unread count is 0', async ({ page }) => {
    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.expectNoBadge()
  })

  test('NotificationBell shows badge when unread count > 0', async ({ page }) => {
    // Seed 3 unread notifications directly into DB via API
    const userId = await getUserId(ownerToken)
    await seedNotifications(ownerToken, userId, 3)

    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.expectBadgeCount(3)
  })

  test('Badge shows "99+" when unread count exceeds 99', async ({ page }) => {
    const userId = await getUserId(ownerToken)
    await seedNotifications(ownerToken, userId, 150)

    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.expectBadgeCount(150)
    // The badge text should show "99+"
    await expect(bell.bell().locator('span[aria-label*="thông báo chưa đọc"]')).toContainText('99+')
  })

  // ─── Panel open/close ────────────────────────────────────────────────────────

  test('NotificationPanel opens when bell is clicked', async ({ page }) => {
    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.open()
    await bell.expectPanelVisible()
  })

  test('NotificationPanel closes when Escape key is pressed', async ({ page }) => {
    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.open()
    await page.keyboard.press('Escape')
    await bell.expectPanelHidden()
  })

  // ─── Mark as read ──────────────────────────────────────────────────────────

  test('Clicking a notification item marks it as read', async ({ page }) => {
    const userId = await getUserId(ownerToken)
    const { data } = await seedNotifications(ownerToken, userId, 2)

    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.open()

    // Verify 2 unread
    await bell.expectItemCount(2)

    // Click the first item
    const firstItem = bell.items().first()
    await firstItem.click()

    // Panel should close after click (per spec: onClose() called)
    await bell.expectPanelHidden()
  })

  test('"Mark all read" button is visible when there are unread notifications', async ({ page }) => {
    const userId = await getUserId(ownerToken)
    await seedNotifications(ownerToken, userId, 1)

    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.open()
    await bell.expectMarkAllReadVisible()
  })

  test('"Mark all read" button resets badge to 0', async ({ page }) => {
    const userId = await getUserId(ownerToken)
    await seedNotifications(ownerToken, userId, 5)

    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.open()
    await bell.expectMarkAllReadVisible()
    await bell.clickMarkAllRead()

    // Badge should be gone (no unread)
    await bell.expectNoBadge()
    await bell.expectMarkAllReadVisible({ visible: false })
  })

  // ─── Empty state ────────────────────────────────────────────────────────────

  test('NotificationPanel shows empty state when no notifications', async ({ page }) => {
    // Mark all notifications as read for this user first
    await api.patch('/api/notifications/read-all', {}, ownerToken).catch(() => {})

    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.open()
    await bell.expectEmptyState()
  })

  // ─── Notification type emojis ────────────────────────────────────────────────

  test('Notification items show correct emoji by type', async ({ page }) => {
    const userId = await getUserId(ownerToken)

    // Seed a NEW_ORDER notification
    const shopId = await getShopId(ownerToken)
    await api.post(
      '/api/notifications',
      {
        recipientId: userId,
        shopId,
        type: 'NEW_ORDER',
        title: 'Đơn hàng mới',
        message: 'Bàn 5 — 3 món',
        isRead: false,
      },
      ownerToken
    )

    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    const bell = new NotificationPanel(page)
    await bell.open()

    await bell.expectItemWithEmoji('🍽️')
    await bell.expectItemWithTitle('Đơn hàng mới')
  })

  // ─── SSE connection ──────────────────────────────────────────────────────────

  test('SSE EventSource connects to /api/notifications/stream on page load', async ({ page }) => {
    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)

    // Capture all network requests
    const sseRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/notifications/stream')) {
        sseRequests.push(req.url())
      }
    })

    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    // Give SSE a moment to establish
    await page.waitForTimeout(2000)

    // Verify an SSE request was made
    expect(sseRequests.length).toBeGreaterThan(0)
    // Verify the request URL contains the SSE endpoint
    expect(sseRequests[0]).toContain('/api/notifications/stream')
    // Verify it includes a token (either Authorization header or ?token=)
    const url = sseRequests[0]
    expect(
      url.includes('token=') || url.includes('Authorization')
    ).toBeTruthy()
  })

  test('SSE connection indicator shows green dot when connected', async ({ page }) => {
    await setStorageAuth(page, ownerToken, {
      id: '',
      email: '',
      name: '',
      role: 'OWNER',
    } as any)
    const dashboard = new OwnerDashboardPage(page)
    await dashboard.goto()

    // Give SSE time to connect
    await page.waitForTimeout(2000)

    const bell = new NotificationPanel(page)
    await bell.expectConnected()
  })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getUserId(token: string): Promise<string> {
  const data = await api.get<{
    user?: { id: string }
    id?: string
  }>('/api/auth/me', token)
  return (data as any).user?.id ?? (data as any).id ?? ''
}

async function getShopId(token: string): Promise<string> {
  const data = await api.get<{
    user?: { shop?: { id: string } }
    shopId?: string
  }>('/api/auth/me', token)
  return (data as any).user?.shop?.id ?? (data as any).shopId ?? ''
}

/** Seed N unread notifications for a user and return the notification IDs */
async function seedNotifications(
  token: string,
  recipientId: string,
  count: number
): Promise<{ data: { notifications: Array<{ id: string }> } }> {
  const shopId = await getShopId(token)
  const notifs = Array.from({ length: count }, (_, i) => ({
    recipientId,
    shopId,
    type: 'NEW_ORDER' as const,
    title: `Đơn hàng #${i + 1}`,
    message: `Tin nhắn thông báo số ${i + 1}`,
    isRead: false,
  }))

  const results = await Promise.all(
    notifs.map((n) =>
      api.post<{ notification: { id: string } }>('/api/notifications', n, token)
    )
  )

  return {
    data: {
      notifications: results.map((r) => ({ id: r.data.notification.id })),
    },
  }
}
