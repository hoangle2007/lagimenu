import { z } from 'zod';

const orderItemSchema = z
  .object({
    productId: z.union([z.string(), z.number()]).optional(),
    /** Alias for productId */
    menuItemId: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    price: z.union([z.number(), z.string()]),
    quantity: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
      .pipe(z.number().int().min(1))
      .optional(),
    /** Alias for quantity */
    qty: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
      .pipe(z.number().int().min(1))
      .optional(),
    notes: z.string().optional(),
    note: z.string().optional(),
  })
  .transform((i) => ({
    ...i,
    quantity: i.quantity ?? i.qty ?? 1,
  }));

export const createOrderSchema = z
  .object({
    merchantId: z.string().min(1).optional(),
    shopId: z.string().min(1).optional(),
    tableNumber: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v !== undefined ? String(v) : v)),
    tableId: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v !== undefined ? String(v) : undefined)),
    sessionId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerNote: z.string().optional(),
    note: z.string().optional(),
    type: z.string().optional(),
    items: z.array(orderItemSchema).optional().default([]),
    notes: z.string().optional(),
    totalPrice: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) =>
        v !== undefined ? (typeof v === 'string' ? parseFloat(v) : v) : 0,
      ),
    totalAmount: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) =>
        v !== undefined
          ? typeof v === 'string'
            ? parseFloat(v)
            : v
          : undefined,
      ),
    fromPos: z.boolean().optional().default(false),
    customerLat: z.number().finite().optional(),
    customerLng: z.number().finite().optional(),
    locationAccuracyM: z.number().finite().optional(),
    /** Khi type là loyalty_pay_request — báo nhân viên / thu ngân */
    loyaltyPaymentMethod: z.enum(['at_table', 'bank_qr']).optional(),
    /** Khi type là call_payment — gợi ý thu ngân cách thanh toán */
    paymentPreference: z.enum(['at_table', 'bank_qr']).optional(),
  })
  .superRefine((val, ctx) => {
    const mid = val.merchantId?.trim() || val.shopId?.trim();
    if (!mid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'merchantId or shopId is required',
      });
    }
    if (String(val.type ?? '') === 'loyalty_pay_request') {
      const m = val.loyaltyPaymentMethod;
      if (m !== 'at_table' && m !== 'bank_qr') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'loyaltyPaymentMethod (at_table | bank_qr) is required for loyalty_pay_request',
          path: ['loyaltyPaymentMethod'],
        });
      }
    }
  })
  .transform((val) => {
    const merchantId = val.merchantId?.trim() || val.shopId?.trim() || '';
    const tableNumber = val.tableNumber ?? val.tableId;
    const mergedNotes = val.note ?? val.notes ?? val.customerNote;
    const price = val.totalPrice || val.totalAmount || 0;
    const items = (val.items ?? []).map((i) => ({
      ...i,
      productId: i.productId ?? i.menuItemId,
    }));
    return {
      ...val,
      merchantId,
      tableNumber,
      notes: mergedNotes,
      totalPrice: price,
      items,
      customerLat: val.customerLat,
      customerLng: val.customerLng,
      locationAccuracyM: val.locationAccuracyM,
    };
  });

export const mergeTablesSchema = z.object({
  masterTableNumber: z.union([z.string(), z.number()]).transform((v) => String(v)),
  sourceTableNumbers: z
    .array(z.union([z.string(), z.number()]).transform((v) => String(v)))
    .min(1),
});

export const splitTableSchema = z.object({
  masterTableNumber: z.union([z.string(), z.number()]).transform((v) => String(v)),
  sourceTableNumber: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export const mergeBillsSchema = z.object({
  targetOrderId: z.number().int().positive(),
  sourceOrderIds: z.array(z.number().int().positive()).min(1),
});

export const splitBillItemsSchema = z.object({
  sourceOrderId: z.number().int().positive(),
  itemIds: z.array(z.number().int().positive()).min(1),
  newTableNumber: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v) : undefined)),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'completed',
    'cancelled',
    'paid',
    'in_progress',
  ]),
  paymentMethod: z.enum(['cash', 'transfer']).optional(),
});

export const patchOrderSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'completed',
    'cancelled',
    'paid',
    'in_progress',
  ]),
  paymentMethod: z.enum(['cash', 'transfer']).optional(),
});

/** Allowed status transitions — prevents invalid state jumps */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'preparing', 'cancelled', 'paid'],
  confirmed: ['preparing', 'cancelled', 'paid'],
  preparing: ['ready', 'cancelled', 'paid'],
  ready: ['completed', 'cancelled', 'paid'],
  completed: ['paid'],
  paid: [],
  cancelled: [],
};

/** Check if a status transition is valid */
export function isValidTransition(current: string, next: string): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export const createLoyaltyRewardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  imageUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  highlightLabel: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  /** Gắn quà với món trong menu (nước, topping, …) */
  productId: z.coerce.number().int().positive().optional(),
  pointsCost: z.coerce.number().int().positive(),
  active: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const patchLoyaltyRewardSchema = createLoyaltyRewardSchema.partial().extend({
  productId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
});

export const patchLoyaltySettingsSchema = z.object({
  vndPerPoint: z.number().int().min(1).max(10_000_000),
});

/** Chủ quán điều chỉnh điểm thủ công (cộng/trừ) */
export const adjustLoyaltyPointsSchema = z.object({
  phone: z.string().min(8).max(32),
  deltaPoints: z
    .number()
    .int()
    .min(-500_000)
    .max(500_000)
    .refine((v) => v !== 0, { message: 'deltaPoints không được bằng 0' }),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

export const redeemLoyaltySchema = z.object({
  phone: z.string().min(8).max(32),
  rewardId: z.coerce.number().int().positive(),
  /** Gợi ý bàn (từ URL khách) — để quầy biết vị trí khi đổi quà */
  tableNumber: z.string().trim().max(32).optional(),
  sessionId: z.string().trim().max(128).optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
export type PatchOrderDto = z.infer<typeof patchOrderSchema>;
export type MergeTablesDto = z.infer<typeof mergeTablesSchema>;
export type SplitTableDto = z.infer<typeof splitTableSchema>;
export type MergeBillsDto = z.infer<typeof mergeBillsSchema>;
export type SplitBillItemsDto = z.infer<typeof splitBillItemsSchema>;
export type CreateLoyaltyRewardDto = z.infer<typeof createLoyaltyRewardSchema>;
export type PatchLoyaltyRewardDto = z.infer<typeof patchLoyaltyRewardSchema>;
export type RedeemLoyaltyDto = z.infer<typeof redeemLoyaltySchema>;
export type PatchLoyaltySettingsDto = z.infer<typeof patchLoyaltySettingsSchema>;
export type AdjustLoyaltyPointsDto = z.infer<typeof adjustLoyaltyPointsSchema>;
