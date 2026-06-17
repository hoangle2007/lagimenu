export type PaymentInfo = {
  bankName: string | null;
  bankAccount: string | null;
  bankOwner: string | null;
};

/** VietQR image URL (compact2) per https://img.vietqr.io/ */
export function buildVietQrUrl(
  info: PaymentInfo,
  amount: number,
  addInfo: string,
): string | null {
  const bankId = (info.bankName || '').trim().replace(/\s+/g, '');
  const account = (info.bankAccount || '').trim().replace(/\s+/g, '');
  if (!bankId || !account) return null;
  const accountName = encodeURIComponent(info.bankOwner || '');
  const amt = Math.max(0, Math.round(amount));
  return `https://img.vietqr.io/image/${bankId}-${account}-compact2.png?amount=${amt}&addInfo=${encodeURIComponent(addInfo)}&accountName=${accountName}`;
}
