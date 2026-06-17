import { api } from './client'
import type { Notification } from './types'

export const notificationsApi = {
  list: (params?: { unread?: boolean }) =>
    api.get<{ notifications: Notification[] }>('/api/notifications', { params }),

  markRead: (id: string) =>
    api.put<{ notification: Notification }>(`/api/notifications/${id}/read`),

  markAllRead: () =>
    api.put<{ count: number }>('/api/notifications/read-all'),
}
