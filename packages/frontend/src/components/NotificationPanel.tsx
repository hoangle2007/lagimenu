/**
 * NotificationPanel — dropdown list of notifications.
 *
 * Per DESIGN_SYSTEM.md spec:
 *  - max-height 400px, overflow-y auto
 *  - Each item: type emoji, title, message excerpt, time-ago
 *  - Unread items: bg-indigo-50 highlight
 *  - Header: "Thông báo" + "Đánh dấu tất cả đã đọc" button
 *  - Empty state: centered icon + text
 *  - Click item → navigate + mark as read
 *  - Click-outside / onClose callback closes panel
 */

import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import type { Notification } from '@/api/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PanelProps = {
  onClose: () => void
  panelRef: RefObject<HTMLDivElement>
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000) // seconds

  if (diff < 60) return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

function getTypeEmoji(type: Notification['type']): string {
  switch (type) {
    case 'NEW_ORDER': return '🍽️'
    case 'SUPPORT_REQUEST': return '🆘'
    case 'SHIFT_ASSIGNED': return '📅'
    default: return '🔔'
  }
}

function getNavPath(notif: Notification): string | null {
  const meta = notif.metadata as Record<string, unknown> | undefined
  switch (notif.type) {
    case 'NEW_ORDER':
      return meta?.orderId ? `/owner/orders/${meta.orderId}` : null
    case 'SUPPORT_REQUEST':
      return meta?.ticketId ? `/owner/support/${meta.ticketId}` : null
    case 'SHIFT_ASSIGNED':
      return meta?.employeeId ? `/owner/employees/${meta.employeeId}/shifts` : null
    default:
      return null
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function NotificationPanel({ onClose, panelRef }: PanelProps) {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead, isLoading } =
    useNotifications()

  const handleItemClick = (notif: Notification) => {
    const path = getNavPath(notif)
    if (path) navigate(path)
    if (!notif.isRead) void markRead(notif.id)
    onClose()
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl bg-surface shadow-xl ring-1 ring-black/5 sm:w-96"
      role="listbox"
      aria-label="Danh sách thông báo"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Thông báo</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          notifications.map((notif: Notification) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onClick={() => handleItemClick(notif)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

interface ItemProps {
  notification: Notification
  onClick: () => void
}

function NotificationItem({ notification: n, onClick }: ItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-violet-50 ${
        !n.isRead ? 'bg-indigo-50' : 'bg-surface'
      }`}
      role="option"
      aria-selected={!n.isRead}
    >
      {/* Type emoji */}
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base">
        {getTypeEmoji(n.type)}
      </span>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-gray-900">{n.title}</span>
          <span className="shrink-0 text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.message}</p>
      </div>

      {/* Unread dot */}
      {!n.isRead && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
      )}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl" aria-hidden="true">🔔</span>
      <p className="mt-3 text-sm font-medium text-gray-500">Không có thông báo nào</p>
      <p className="mt-1 text-xs text-gray-400">Bạn sẽ nhận thông báo ở đây</p>
    </div>
  )
}
