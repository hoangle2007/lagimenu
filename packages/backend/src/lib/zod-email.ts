import { z } from 'zod';

/**
 * Zod 4's default `.email()` is very strict (e.g. requires dotted domain labels).
 * We trim/normalize and accept common real-world + internal addresses.
 */
export const pragmaticEmailSchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(3, 'Invalid email address')
      .max(254, 'Invalid email address')
      .refine(
        (email) => {
          if (email.includes('..')) return false;
          const parts = email.split('@');
          if (parts.length !== 2) return false;
          const [local, domain] = parts;
          if (!local || !domain) return false;
          if (local.length > 64 || domain.length > 253) return false;
          // No whitespace in local or domain
          if (/\s/.test(local) || /\s/.test(domain)) return false;
          return true;
        },
        { message: 'Invalid email address' },
      ),
  );
