import { z } from 'zod';
import { pragmaticEmailSchema } from '../lib/zod-email';

export const customerRegisterSchema = z.object({
  email: pragmaticEmailSchema,
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().optional(),
});

export const customerLoginSchema = z.object({
  email: pragmaticEmailSchema,
  password: z.string().min(1),
});

export type CustomerRegisterDto = z.infer<typeof customerRegisterSchema>;
export type CustomerLoginDto = z.infer<typeof customerLoginSchema>;
