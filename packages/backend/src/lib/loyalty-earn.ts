export const DEFAULT_LOYALTY_VND_PER_POINT = 1000;
const MIN_VND_PER_POINT = 1;
const MAX_VND_PER_POINT = 10_000_000;

export function clampLoyaltyVndPerPoint(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LOYALTY_VND_PER_POINT;
  const x = Math.trunc(n);
  if (x < MIN_VND_PER_POINT) return MIN_VND_PER_POINT;
  if (x > MAX_VND_PER_POINT) return MAX_VND_PER_POINT;
  return x;
}

export function formatEarnRuleLabel(vndPerPoint: number): string {
  const n = clampLoyaltyVndPerPoint(vndPerPoint);
  const money = new Intl.NumberFormat('vi-VN').format(n);
  return `1 điểm / ${money}₫ giá trị đơn (khi đơn chuyển trạng thái đã thanh toán)`;
}

export function formatEarnRuleLabelShort(vndPerPoint: number): string {
  const n = clampLoyaltyVndPerPoint(vndPerPoint);
  const money = new Intl.NumberFormat('vi-VN').format(n);
  return `1 điểm / ${money}₫ giá trị đơn (sau khi thanh toán)`;
}
