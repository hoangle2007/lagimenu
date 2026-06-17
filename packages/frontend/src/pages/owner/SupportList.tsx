/**
 * SupportList — support request management for owner.
 *
 * Features:
 *  - Status + Type filter tabs
 *  - Support cards: type icon, customer name, message, table, time, status
 *  - Quick action: mark as resolved
 */

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supportApi } from '@/api/support'
import type { SupportRequest, SupportRequestStatus } from '@/api/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  WATER: 'Nước uống',
  PAYMENT: 'Thanh toán',
  CLEANING: 'Dọn dẹp',
  OTHER: 'Khác',
}

const TYPE_EMOJI: Record<string, string> = {
  WATER: '💧',
  PAYMENT: '💳',
  CLEANING: '🧹',
  OTHER: '❓',
}

const STATUS_LABELS: Record<SupportRequestStatus, string> = {
  OPEN: 'Chờ xử lý',
  RESOLVED: 'Đã xử lý',
  CLOSED: 'Đã đóng',
}

const STATUS_COLORS: Record<SupportRequestStatus, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | SupportRequestStatus
type TypeFilter = 'ALL' | string

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'OPEN', label: 'Chờ xử lý' },
  { key: 'RESOLVED', label: 'Đã xử lý' },
  { key: 'CLOSED', label: 'Đã đóng' },
]

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'WATER', label: 'Nước uống' },
  { key: 'PAYMENT', label: 'Thanh toán' },
  { key: 'CLEANING', label: 'Dọn dẹp' },
  { key: 'OTHER', label: 'Khác' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupportList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: { status?: SupportRequestStatus; type?: string } = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (typeFilter !== 'ALL') params.type = typeFilter
      const { data } = await supportApi.list(params)
      setRequests(data.requests)
    } catch {
      toast.error('Không thể tải danh sách yêu cầu hỗ trợ.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => {
    void fetchRequests()
  }, [fetchRequests])

  const handleResolve = async (id: string) => {
    try {
      const { data } = await supportApi.updateStatus(id, 'RESOLVED')
      setRequests((prev) => prev.map((r) => (r.id === id ? data.request : r)))
      toast.success('Đã đánh dấu là đã xử lý')
    } catch {
      toast.error('Không thể cập nhật trạng thái.')
    }
  }

  const handleClose = async (id: string) => {
    try {
      const { data } = await supportApi.updateStatus(id, 'CLOSED')
      setRequests((prev) => prev.map((r) => (r.id === id ? data.request : r)))
      toast.success('Đã đóng yêu cầu')
    } catch {
      toast.error('Không thể cập nhật trạng thái.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Yêu cầu Hỗ trợ</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isLoading ? '…' : `${requests.length} yêu cầu`}
        </p>
      </div>

      {/* Filter rows */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-surface text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-50 p-1 ring-1 ring-gray-200">
          {TYPE_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`shrink-0 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                typeFilter === key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl bg-surface py-12 text-center shadow-sm ring-1 ring-gray-200">
          <span className="text-4xl">🆘</span>
          <p className="mt-3 text-sm font-medium text-gray-500">Không có yêu cầu nào</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <SupportCard
              key={req.id}
              request={req}
              onResolve={() => void handleResolve(req.id)}
              onClose={() => void handleClose(req.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Support Card ─────────────────────────────────────────────────────────────

interface SupportCardProps {
  request: SupportRequest
  onResolve: () => void
  onClose: () => void
}

function SupportCard({ request: r, onResolve, onClose }: SupportCardProps) {
  const isOpen = r.status === 'OPEN'
  const isResolved = r.status === 'RESOLVED'

  return (
    <li className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Type icon */}
        <span className="mt-0.5 text-2xl" aria-hidden="true">
          {TYPE_EMOJI[r.type] ?? '❓'}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {TYPE_LABELS[r.type] ?? r.type}
                {r.tableNumber ? ` · Bàn ${r.tableNumber}` : ''}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{r.message}</p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}
            >
              {STATUS_LABELS[r.status]}
            </span>
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
            {isOpen && (
              <button
                type="button"
                onClick={onResolve}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                Đã xử lý
              </button>
            )}
            {isResolved && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Đóng
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
