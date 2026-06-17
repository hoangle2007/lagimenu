/** Aligns with backend `statusLabelForWebPush` for toast / Web Push copy. */
export function statusLabelForWebPush(status: string): string {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    pending: '⏳ Đang đợi xác nhận',
    confirmed: '✅ Đang order',
    processing: '✅ Đang order',
    preparing: '✅ Đang order',
    waiting_drinks: '🧃 Đang đợi nước',
    served: '🎉 Đã nhận nước',
    ready: '✅ Đang order',
    completed: '✅ Đang order',
    paid: '💰 Đã thanh toán',
    unpaid: '❌ Chưa thanh toán',
    cancelled: '❌ Đã hủy',
  };
  return map[s] ?? '⏳ Đang đợi xác nhận';
}

export function formatVnd(amount: string | number): string {
  const n =
    typeof amount === 'string' ? parseFloat(String(amount).replace(/[^\d.]/g, '')) || 0 : amount;
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

export function newOrderPushBody(
  order: {
    id: number;
    tableNumber?: string;
    table_number?: string;
    totalPrice?: string;
    total_price?: string;
    status?: string;
    items?: { quantity?: number }[];
  },
  opts?: { omitPrice?: boolean },
): { title: string; body: string } {
  const tableNumber = order.tableNumber || order.table_number || '??';
  const totalAmount = order.totalPrice ?? order.total_price ?? 0;
  const totalItems = Array.isArray(order.items)
    ? order.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    : 0;
  const id6 = String(order.id).slice(-6);
  const title = '🔔 Đơn mới!';
  const priceLine = opts?.omitPrice ? '' : `Giá: ${formatVnd(totalAmount)}₫\n`;
  const body =
    `Bàn: ${tableNumber}\n` +
    `Order: #${id6}\n` +
    priceLine +
    `Số lượng: ${totalItems || 0} món\n` +
    `Tình trạng: ${statusLabelForWebPush(order.status || 'pending')}`;
  return { title, body };
}
