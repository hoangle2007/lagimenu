/**
 * useNotifications — combines the SSE stream hook with the notifications REST API.
 *
 * Provides:
 *  - notifications[]   — paginated list fetched from the API
 *  - unreadCount       — driven by SSE events (real-time)
 *  - connected         — SSE connection state
 *  - markRead(id)      — mark single notification as read (API + local state)
 *  - markAllRead()     — mark all as read (API + local state)
 *  - refresh()         — re-fetch the notification list from the API
 */

import { useState, useEffect, useCallback } from 'react'
import { useSSE } from './useSSE'
import { notificationsApi } from '@/api/notifications'
import type { Notification } from '@/api/types'

export function useNotifications() {
  const sse = useSSE()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Fetch notification list ────────────────────────────────────────────────

  const fetchNotifications = useCallback(async (params?: { unread?: boolean }) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await notificationsApi.list(params)
      setNotifications(data.notifications)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tải thông báo'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load (all notifications)
  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  // Every 60 s refresh to catch any missed notifications
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchNotifications()
    }, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // ─── Optimistic updates ──────────────────────────────────────────────────────

  /** Mark a single notification as read and update the local list. */
  const markRead = useCallback(
    async (id: string) => {
      // Optimistic: update local state immediately
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      sse.decrementUnread()
      // Then persist via API
      try {
        await notificationsApi.markRead(id)
      } catch {
        // Revert on failure
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
        )
        sse.decrementUnread()
      }
    },
    [sse]
  )

  /** Mark all notifications as read and update the local list. */
  const markAllRead = useCallback(async () => {
    const prev = notifications
    // Optimistic: mark all as read
    setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })))
    try {
      await notificationsApi.markAllRead()
      sse.markAllRead()
    } catch {
      // Revert on failure
      setNotifications(prev)
    }
  }, [notifications, sse])

  const refresh = useCallback(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount: sse.unreadCount,
    connected: sse.connected,
    lastNotification: sse.lastNotification,
    isLoading,
    error,
    markRead,
    markAllRead,
    refresh,
  }
}
