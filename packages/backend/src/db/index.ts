import { config as loadBackendEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Scripts and some test runners import this module without going through main.ts.
const backendEnvPath = join(__dirname, '..', '..', '.env');
if (existsSync(backendEnvPath)) {
  loadBackendEnv({ path: backendEnvPath, override: true });
}

const connectionString = process.env.DATABASE_URL ?? '';

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Raw postgres client for ad-hoc queries
export const sql = postgres(connectionString, { prepare: false });

// Drizzle ORM instance
export const db = drizzle(sql, { schema });

export type DbType = typeof db;
