import { z } from 'zod';

export const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Token Google không được trống.'),
});

export const linkGoogleSchema = z.object({
  googleId: z.string().min(1),
  password: z.string().optional(),
});

export type GoogleLoginDto = z.infer<typeof googleLoginSchema>;
export type LinkGoogleDto = z.infer<typeof linkGoogleSchema>;
