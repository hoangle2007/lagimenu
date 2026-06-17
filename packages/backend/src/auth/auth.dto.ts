import { z } from 'zod';
import { pragmaticEmailSchema } from '../lib/zod-email';

export const registerSchema = z.object({
  email: pragmaticEmailSchema,
  password: z.string().min(6),
  /** Tên quán (lưu vào merchants.name) */
  shopName: z.string().min(2),
  /** Họ tên chủ quán */
  ownerName: z.string().min(2),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
