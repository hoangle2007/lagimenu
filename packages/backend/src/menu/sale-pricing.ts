import { BadRequestException } from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';

/** Mặc định theo plan: so sánh start/end theo wall-clock VN. */
export const SALE_TIMEZONE = 'Asia/Ho_Chi_Minh';

export type SaleDiscountType = 'percent' | 'amount';

export interface ComputeSalePricingArgs {
  basePrice: string;
  saleEnabled: boolean;
  saleDiscountType: string | null | undefined;
  saleDiscountValue: string | number | null | undefined;
  saleStartsAt: Date | string | null | undefined;
  saleEndsAt: Date | string | null | undefined;
  now?: Date;
}

export interface ComputeSalePricingResult {
  isSaleActive: boolean;
  saleActive: boolean;
  originalPrice: string;
  salePrice: number;
  discountLabel: string | null;
}

function parseDigitsToNumber(v: string): number {
  const digits = String(v).replace(/\D/g, '');
  if (!digits) return NaN;
  return Number(digits);
}

export function parseProductBasePriceNumber(v: string): number {
  return parseDigitsToNumber(v);
}

/** Làm tròn xuống bội 1.000 VND (theo plan). */
export function floorVndToThousands(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount / 1000) * 1000;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wallClockKey(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd'T'HH:mm:ss");
}

/** Cửa sổ sale: so sánh theo wall-clock `SALE_TIMEZONE` (VN không DST → so chuỗi ổn định). */
function isWithinSaleWindow(
  nowUtc: Date,
  startsAt: Date | null,
  endsAt: Date | null,
): boolean {
  const nowK = wallClockKey(nowUtc, SALE_TIMEZONE);
  if (startsAt && nowK < wallClockKey(startsAt, SALE_TIMEZONE)) return false;
  if (endsAt && nowK > wallClockKey(endsAt, SALE_TIMEZONE)) return false;
  return true;
}

function formatVndLabel(amount: number): string {
  const n = Math.round(amount);
  return `-${n.toLocaleString('vi-VN')}đ`;
}

export function computeSalePricing(
  args: ComputeSalePricingArgs,
): ComputeSalePricingResult {
  const now = args.now ?? new Date();
  const originalPrice = String(args.basePrice ?? '').trim();
  const base = parseDigitsToNumber(originalPrice);
  const startsAt = toDate(args.saleStartsAt);
  const endsAt = toDate(args.saleEndsAt);

  const typeRaw = args.saleDiscountType;
  const type =
    typeRaw === 'percent' || typeRaw === 'amount' ? typeRaw : null;
  const valueNum = (() => {
    const v = args.saleDiscountValue;
    if (v == null || v === '') return NaN;
    return typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  })();

  const windowOk = isWithinSaleWindow(now, startsAt, endsAt);
  const hasValidConfig =
    args.saleEnabled === true &&
    type != null &&
    Number.isFinite(valueNum) &&
    valueNum > 0 &&
    Number.isFinite(base) &&
    base > 0;

  let isSaleActive = false;
  let discountLabel: string | null = null;
  let salePrice = Number.isFinite(base) ? base : 0;

  if (hasValidConfig && windowOk) {
    if (type === 'percent') {
      const raw = base * (1 - valueNum / 100);
      salePrice = floorVndToThousands(raw);
      discountLabel = `-${valueNum}%`;
    } else {
      const off = Math.min(valueNum, base);
      salePrice = floorVndToThousands(base - off);
      discountLabel = formatVndLabel(off);
    }
    if (salePrice > 0 && salePrice < base) {
      isSaleActive = true;
    } else {
      salePrice = base;
    }
  } else {
    salePrice = Number.isFinite(base) ? base : 0;
  }

  return {
    isSaleActive,
    saleActive: isSaleActive,
    originalPrice,
    salePrice,
    discountLabel: isSaleActive ? discountLabel : null,
  };
}

export interface ValidateSaleBodyInput {
  saleEnabled?: boolean;
  saleDiscountType?: string | null;
  saleDiscountValue?: string | number | null;
  saleStartsAt?: string | Date | null;
  saleEndsAt?: string | Date | null;
  salePinned?: boolean;
}

/**
 * Validate payload sale khi tạo/sửa món. `basePriceDigits` là giá gốc (số) sau khi parse.
 */
export function assertSaleBodyValid(
  input: ValidateSaleBodyInput,
  basePriceDigits: number,
): void {
  const enabled = input.saleEnabled === true;
  if (!enabled) return;

  const type = input.saleDiscountType;
  if (type !== 'percent' && type !== 'amount') {
    throw new BadRequestException(
      'saleDiscountType phải là percent hoặc amount khi bật sale',
    );
  }

  const vRaw = input.saleDiscountValue;
  const v =
    vRaw == null || vRaw === ''
      ? NaN
      : typeof vRaw === 'number'
        ? vRaw
        : Number(String(vRaw).replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) {
    throw new BadRequestException('saleDiscountValue phải > 0 khi bật sale');
  }

  if (!Number.isFinite(basePriceDigits) || basePriceDigits <= 0) {
    throw new BadRequestException('Giá gốc không hợp lệ để áp dụng sale');
  }

  if (type === 'percent') {
    if (v <= 0 || v > 100) {
      throw new BadRequestException('Giảm % phải trong (0, 100]');
    }
  } else {
    if (v > basePriceDigits) {
      throw new BadRequestException('Giảm tiền không được vượt quá giá gốc');
    }
  }

  const s = input.saleStartsAt != null ? new Date(input.saleStartsAt) : null;
  const e = input.saleEndsAt != null ? new Date(input.saleEndsAt) : null;
  if (s && Number.isNaN(s.getTime())) {
    throw new BadRequestException('saleStartsAt không hợp lệ');
  }
  if (e && Number.isNaN(e.getTime())) {
    throw new BadRequestException('saleEndsAt không hợp lệ');
  }
  if (s && e && s.getTime() >= e.getTime()) {
    throw new BadRequestException('saleStartsAt phải nhỏ hơn saleEndsAt');
  }
}
