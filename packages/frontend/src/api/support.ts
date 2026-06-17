import { api } from './client'
import type { SupportRequest, SupportRequestStatus } from './types'

export interface CreateSupportBody {
  shopId: string
  type: string
  message: string
  tableNumber?: string
}

export const supportApi = {
  create: (data: CreateSupportBody) =>
    api.post<{ request: SupportRequest }>('/api/support', data),

  list: (params?: { status?: SupportRequestStatus; type?: string }) =>
    api.get<{ requests: SupportRequest[] }>('/api/support', { params }),

  updateStatus: (id: string, status: SupportRequestStatus) =>
    api.put<{ request: SupportRequest }>(`/api/support/${id}/status`, { status }),
}
