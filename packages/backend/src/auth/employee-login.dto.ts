import { z } from 'zod';
import { pragmaticEmailSchema } from '../lib/zod-email';

export const employeeLoginSchema = z.object({
  email: pragmaticEmailSchema,
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN must be 4 digits'),
  /** Same as merchantId (shop UUID) — matches frontend `shopId` */
  shopId: z.string().uuid().optional(),
  merchantId: z.string().uuid().optional(),
  shopSlug: z.string().optional(),
});

export type EmployeeLoginDto = z.infer<typeof employeeLoginSchema>;
