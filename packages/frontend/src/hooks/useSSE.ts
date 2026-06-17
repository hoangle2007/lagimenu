/**
 * useSSE — Server-Sent Events client hook.
 *
 * Connects to /api/notifications/stream and dispatches incoming notification
 * events to callers. Uses exponential-backoff reconnection (1s → 2s → 4s … max 30s).
 *
 * NOTE: EventSource does not support custom headers, so the JWT token is passed
 * via query parameter ?token=<jwt>. The backend /api/notifications/stream endpoint
 * accepts JWT from both the Authorization header and ?token= query param.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import { notificationsApi } from '@/api/notifications'
import toast from 'react-hot-toast'

const SSE_PATH = '/api/notifications/stream'

const MAX_RECONNECT_DELAY = 30_000
const INITIAL_RECONNECT_DELAY = 1_000

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  id: string
  type: 'NEW_ORDER' | 'SUPPORT_REQUEST' | 'CHAT_MESSAGE' | 'SHIFT_ASSIGNED'
  title: string
  message: string
  metadata?: Record<string, unknown>
  isRead?: boolean
  createdAt: string
}

export interface SSEEvent {
  type: 'NOTIFICATION' | 'CONNECTED' | 'PING'
  notification?: NotificationPayload
  message?: string
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useSSE() {
  const { token } = useAuth()

  const [lastNotification, setLastNotification] = useState<NotificationPayload | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [connected, setConnected] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  /** Latest connect impl for reconnect scheduling (avoids self-reference before init). */
  const connectRef = useRef<() => void>(() => {})

  const connect = useCallback(() => {
    if (!token) return

    // Close any existing connection before opening a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const apiBase =
      (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
      window.location.origin
    const url = `${apiBase}${SSE_PATH}?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
      setUnreadCount(0) // reset on reconnect
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
    }

    es.onmessage = (event: MessageEvent) => {
      try {
        const data: SSEEvent = JSON.parse(event.data)

        if (data.type === 'CONNECTED') {
          // SSE stream established — fetch initial unread count
          notificationsApi
            .list({ unread: true })
            .then(({ data }) => {
              setUnreadCount(data.notifications.length)
            })
            .catch(() => {
              // non-critical — count just won't be populated
            })
          return
        }

        if (data.type === 'NOTIFICATION' && data.notification) {
          const notif = data.notification
          setLastNotification(notif)
          setUnreadCount((c) => c + 1)

          // Show a toast for the incoming notification
          toast(notif.message, {
            id: notif.id,          // deduplicate — same ID won't flash twice
            duration: 5000,
            icon: getTypeEmoji(notif.type),
          })
        }

        // PING — no action needed
      } catch {
        // malformed event — ignore
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      eventSourceRef.current = null

      // Schedule a reconnect with exponential backoff
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_RECONNECT_DELAY
        )
        connectRef.current()
      }, reconnectDelayRef.current)
    }
  }, [token])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      setConnected(false)
    }
  }, [connect])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead()
      setUnreadCount(0)
    } catch {
      toast.error('Không thể đánh dấu tất cả là đã đọc')
    }
  }, [])

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      toast.error('Không thể đánh dấu thông báo là đã đọc')
    }
  }, [])

  const decrementUnread = useCallback(() => {
    setUnreadCount((c) => Math.max(0, c - 1))
  }, [])

  return {
    lastNotification,
    unreadCount,
    connected,
    markAllRead,
    markRead,
    decrementUnread,
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function getTypeEmoji(type: NotificationPayload['type']): string {
  switch (type) {
    case 'NEW_ORDER': return '🍽️'
    case 'SUPPORT_REQUEST': return '🆘'
    case 'CHAT_MESSAGE': return '💬'
    case 'SHIFT_ASSIGNED': return '📅'
    default: return '🔔'
  }
}
