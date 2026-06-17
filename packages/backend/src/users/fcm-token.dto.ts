import { z } from 'zod';

export const registerFcmTokenSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token is required'),
  deviceType: z.enum(['web', 'android', 'ios']).optional().default('web'),
});

export type RegisterFcmTokenDto = z.infer<typeof registerFcmTokenSchema>;
