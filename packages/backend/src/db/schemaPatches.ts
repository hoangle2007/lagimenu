import { Logger } from '@nestjs/common';
import { sql } from './index';

const logger = new Logger('SchemaPatches');

/**
 * Idempotent DDL for databases that were created before a migration was applied.
 * Keeps local/prod in sync without requiring manual psql for common drift.
 */
export async function ensureSchemaPatches(): Promise<void> {
  try {
    await sql`
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "notifyRole" text NOT NULL DEFAULT 'all'
    `;
  } catch (err) {
    logger.warn(
      `Could not ensure Employee.notifyRole column: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "Customer" (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_customer_email" ON "Customer" (email)
    `;
  } catch (err) {
    logger.warn(
      `Could not ensure Customer table: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude double precision`;
    await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude double precision`;
    await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS geo_fence_radius_m integer`;
    await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS require_customer_location boolean NOT NULL DEFAULT false`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_ip text`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_lat double precision`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_lng double precision`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_location_accuracy_m double precision`;
    await sql`
      CREATE TABLE IF NOT EXISTS merchant_blocked_ips (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        ip text NOT NULL,
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(merchant_id, ip)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_merchant_blocked_ips_merchant ON merchant_blocked_ips(merchant_id)
    `;
  } catch (err) {
    logger.warn(
      `Could not ensure order geo / blocked IP schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await sql`ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS parent_table_number text`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_group_id text`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS merged_into_order_id integer`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS merged_from_table_number text`;
    await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS split_from_item_id integer`;
    await sql`
      CREATE TABLE IF NOT EXISTS loyalty_accounts (
        id serial PRIMARY KEY,
        merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        customer_phone text NOT NULL,
        customer_name text,
        points integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(merchant_id, customer_phone)
      )
    `;
    /* Bảng loyalty_accounts tạo trước khi có UNIQUE: CREATE TABLE IF NOT EXISTS không sửa schema cũ */
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS loyalty_accounts_merchant_phone_uq
      ON loyalty_accounts (merchant_id, customer_phone)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id serial PRIMARY KEY,
        merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        order_id integer REFERENCES orders(id) ON DELETE SET NULL,
        customer_phone text NOT NULL,
        delta_points integer NOT NULL,
        reason text NOT NULL DEFAULT 'order_paid',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_merchant_phone
      ON loyalty_transactions(merchant_id, customer_phone)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS loyalty_rewards (
        id serial PRIMARY KEY,
        merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        points_cost integer NOT NULL CHECK (points_cost > 0),
        active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_merchant_active
      ON loyalty_rewards(merchant_id, active, sort_order)
    `;
    await sql`
      ALTER TABLE loyalty_transactions
      ADD COLUMN IF NOT EXISTS reward_id integer REFERENCES loyalty_rewards(id) ON DELETE SET NULL
    `;
    await sql`ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS note text`;
    await sql`ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS image_url text`;
    await sql`ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS highlight_label text`;
    await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_vnd_per_point integer NOT NULL DEFAULT 1000`;
    await sql`
      ALTER TABLE loyalty_rewards
      ADD COLUMN IF NOT EXISTS product_id integer REFERENCES products(id) ON DELETE SET NULL
    `;
  } catch (err) {
    logger.warn(
      `Could not ensure merge/split/loyalty schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS fcm_token text`;
    await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS table_number text`;
  } catch (err) {
    logger.warn(
      `Could not ensure User.fcm_token / reviews.table_number: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_enabled boolean NOT NULL DEFAULT false`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_discount_type text`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_discount_value numeric`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_starts_at timestamptz`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_pinned boolean NOT NULL DEFAULT false`;
  } catch (err) {
    logger.warn(
      `Could not ensure products sale columns: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
