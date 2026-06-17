/** Trạng thái làm việc nhân viên — đồng bộ realtime tới màn chủ quán. */
export type StaffPresence = 'online' | 'away' | 'offline'

export type StaffPresenceBroadcast = {
  employeeId: string
  name: string
  presence: StaffPresence
  at: string
}

export const STAFF_PRESENCE_LABELS: Record<StaffPresence, string> = {
  online: 'Online',
  away: 'Vắng',
  offline: 'Off',
}

export function employeePresenceStorageKey(userId: string) {
  return `employee_presence_${userId}`
}
