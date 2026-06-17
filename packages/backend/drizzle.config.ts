import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import type { Config } from 'drizzle-kit';

// drizzle-kit does not always load .env; also Windows may set DATABASE_URL globally (old password).
loadEnv({ path: resolve(__dirname, '.env'), override: true });

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;