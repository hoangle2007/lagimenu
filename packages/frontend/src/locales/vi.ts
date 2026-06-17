/**
 * Gói chuỗi tiếng Việt — mở rộng dần theo module.
 */
export const vi = {
  employee: {
    nav: {
      dashboard: 'Tổng quan',
      service: 'Phục vụ',
      tables: 'Bàn & Live',
      orders: 'Lịch sử đơn',
      pos: 'POS',
      kitchen: 'Bếp / KDS',
      cashier: 'Thu ngân',
      staffBadge: 'Nhân viên',
    },
  },
  tts: {
    newOrder: (table: string, amount: string) =>
      `Có đơn hàng mới bàn ${table}. Tổng cộng ${amount} đồng.`,
    newOrderNoAmount: (table: string) => `Có đơn hàng mới bàn ${table}.`,
    callStaff: (table: string) => `Bàn ${table} gọi nhân viên`,
    callPayment: (table: string) => `Bàn ${table} yêu cầu thanh toán`,
    callPaymentPreference: (
      table: string,
      pref: 'at_table' | 'bank_qr',
    ) =>
      pref === 'bank_qr'
        ? `Bàn ${table} muốn thanh toán bằng quét mã QR ngân hàng`
        : `Bàn ${table} muốn thu ngân tới bàn thanh toán`,
    loyaltyPayRequest: (table: string, method: 'at_table' | 'bank_qr') =>
      method === 'bank_qr'
        ? `Bàn ${table} yêu cầu thanh toán tích điểm, khách chọn quét mã QR ngân hàng`
        : `Bàn ${table} yêu cầu thanh toán tích điểm tại bàn, nhờ thu ngân`,
    loyaltyRedeem: (
      table: string,
      rewardTitle: string,
      points: number,
      phoneLast4: string,
    ) =>
      table && table !== '—'
        ? `Bàn ${table}. Khách đổi quà ${rewardTitle}, trừ ${points} điểm, số điện thoại kết thúc ${phoneLast4}.`
        : `Khách đổi quà ${rewardTitle}, trừ ${points} điểm, số điện thoại kết thúc ${phoneLast4}.`,
    readyToServe: (table: string) =>
      `Bàn ${table}. Món đã sẵn sàng. Mang đơn ra cho khách.`,
    kitchenLine: (qty: number, name: string, table: string) =>
      `${qty} ${name}, bàn ${table}`,
    dashboardWarmup: 'Hệ thống thông báo bằng giọng tiếng Việt đã sẵn sàng.',
  },
  speech: {
    missingVoiceTitle: 'Chưa có giọng đọc tiếng Việt',
    missingVoiceHint:
      'Windows: Cài đặt → Thời gian và ngôn ngữ → Ngôn ngữ → thêm Tiếng Việt và gói giọng nói. Trình duyệt: thêm Tiếng Việt trong phần ngôn ngữ rồi tải lại trang.',
    dismiss: 'Đã hiểu',
    chooseVoice: 'Chọn giọng đọc (nếu có)',
  },
  kitchen: {
    title: 'Bếp — Đang nấu',
    colWaiting: 'Đang nấu',
    colReady: 'Đã xong / Chờ mang ra',
    filterByDish: 'Theo món',
    filterByTable: 'Theo bàn',
    bump: 'Tiến trạng',
    speak: 'Đọc',
    emptyWaiting: 'Không có món chờ',
    emptyReady: 'Chưa có đơn chờ mang ra',
    loadError: 'Không tải được đơn hoạt động',
    statusError: 'Không đổi được trạng thái',
    takeaway: 'Mang về',
  },
  pos: {
    tabMenu: 'Thực đơn',
    tabTables: 'Đơn bàn / Quầy',
    searchShortcut: 'Tìm món (F3)',
    payShortcut: 'Thanh toán (F9)',
    takeaway: 'Mang về',
    total: 'Tổng tiền',
    pay: 'Thanh toán',
  },
} as const

export type ViMessages = typeof vi
