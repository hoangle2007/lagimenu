/**
 * Chuẩn hoá SĐT VN để khớp tài khoản tích điểm (bỏ khoảng, +84 → 0…).
 */
export function normalizeVnCustomerPhone(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const d = String(input).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('84') && d.length >= 10) return `0${d.slice(2)}`;
  if (d.length === 9 && !d.startsWith('0')) return `0${d}`;
  return d;
}
