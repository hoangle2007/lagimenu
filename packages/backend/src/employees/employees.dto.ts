import { z } from 'zod';
import { pragmaticEmailSchema } from '../lib/zod-email';

export const staffNotifyRoleSchema = z.enum([
  'all',
  'waiter',
  'cashier',
  'kitchen',
]);

export const createEmployeeSchema = z.object({
  name: z.string().min(2),
  email: pragmaticEmailSchema,
  password: z.string().min(4),
  phone: z.string().optional(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  shopId: z.string().uuid(),
  notifyRole: staffNotifyRoleSchema.optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits')
    .optional(),
  isActive: z.boolean().optional(),
  notifyRole: staffNotifyRoleSchema.optional(),
});

export const listEmployeesSchema = z.object({
  shopId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesDto = z.infer<typeof listEmployeesSchema>;
