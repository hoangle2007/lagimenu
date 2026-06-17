-- ============================================================
-- Lagi Menu — Initial Schema Migration
-- Generated: 2026-03-30
-- ORM: Drizzle ORM
-- ============================================================
-- Enable UUID generation (bundled with PostgreSQL 13+)
-- No separate pgcrypto extension needed — gen_random_uuid() is available OOTB.

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "user_role" AS ENUM('owner', 'staff');
CREATE TYPE "order_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');

-- ─── 1. shops ────────────────────────────────────────────────────────────────

CREATE TABLE "shops" (
  "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text        NOT NULL,
  "slug"       text        NOT NULL UNIQUE,
  "phone"      text,
  "address"    text,
  "logo_url"   text,
  "is_active"  boolean     NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_shops_slug" ON "shops" USING btree ("slug");

COMMENT ON TABLE "shops" IS 'Multi-tenant root — each F&B business is a shop.';

-- ─── 2. users ───────────────────────────────────────────────────────────────

CREATE TABLE "users" (
  "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id"        uuid        NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "email"          text        NOT NULL UNIQUE,
  "password_hash"  text        NOT NULL,
  "name"           text        NOT NULL,
  "role"           "user_role" NOT NULL DEFAULT 'owner',
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_users_email"    ON "users" USING btree ("email");
CREATE INDEX "idx_users_shop_id"  ON "users" USING btree ("shop_id");

COMMENT ON TABLE "users" IS 'Merchant accounts (owner/staff) — one shop may have multiple users.';

-- ─── 3. categories ───────────────────────────────────────────────────────────

CREATE TABLE "categories" (
  "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id"     uuid        NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "name"        text        NOT NULL,
  "sort_order"  integer     NOT NULL DEFAULT 0,
  "is_active"   boolean     NOT NULL DEFAULT true,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_categories_shop_id" ON "categories" USING btree ("shop_id");

COMMENT ON TABLE "categories" IS 'Menu category groups within a shop (e.g. Trà sữa, Cà phê).';

-- ─── 4. products ─────────────────────────────────────────────────────────────

CREATE TABLE "products" (
  "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id"      uuid        NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "category_id"  uuid        NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
  "name"         text        NOT NULL,
  "description" text,
  "price"        integer     NOT NULL,
  "image_url"    text,
  "is_available" boolean     NOT NULL DEFAULT true,
  "sort_order"   integer     NOT NULL DEFAULT 0,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_products_shop_id"     ON "products" USING btree ("shop_id");
CREATE INDEX "idx_products_category_id" ON "products" USING btree ("category_id");

COMMENT ON TABLE "products" IS 'Menu items. Price stored as integer VND (no decimals).';

-- ─── 5. topping_groups ──────────────────────────────────────────────────────

CREATE TABLE "topping_groups" (
  "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id"     uuid        NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "name"        text        NOT NULL,
  "sort_order"  integer     NOT NULL DEFAULT 0,
  "is_required" boolean     NOT NULL DEFAULT false,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_topping_groups_shop_id" ON "topping_groups" USING btree ("shop_id");

COMMENT ON TABLE "topping_groups" IS 'Groups of topping options (e.g. Đường, Đá, Topping).';

-- ─── 6. topping_items ──────────────────────────────────────────────────────

CREATE TABLE "topping_items" (
  "id"               uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id"          uuid        NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "topping_group_id" uuid        NOT NULL REFERENCES "topping_groups"("id") ON DELETE CASCADE,
  "name"             text        NOT NULL,
  "price"            integer     NOT NULL DEFAULT 0,
  "is_default"       boolean     NOT NULL DEFAULT false,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_topping_items_group_id" ON "topping_items" USING btree ("topping_group_id");

COMMENT ON TABLE "topping_items" IS 'Individual topping options within a group. Price in VND.';

-- ─── 7. product_topping_groups ─────────────────────────────────────────────

CREATE TABLE "product_topping_groups" (
  "product_id"       uuid NOT NULL REFERENCES "products"("id")       ON DELETE CASCADE,
  "topping_group_id" uuid NOT NULL REFERENCES "topping_groups"("id") ON DELETE CASCADE,
  PRIMARY KEY ("product_id", "topping_group_id")
);

COMMENT ON TABLE "product_topping_groups" IS 'Many-to-many: which topping groups apply to which products.';

-- ─── 8. tables ─────────────────────────────────────────────────────────────

CREATE TABLE "tables" (
  "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id"     uuid        NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "name"        text        NOT NULL,
  "qr_code_url" text,
  "is_active"   boolean     NOT NULL DEFAULT true,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_tables_shop_id" ON "tables" USING btree ("shop_id");

COMMENT ON TABLE "tables" IS 'Physical tables with QR codes for customer scanning.';

-- ─── 9. orders ─────────────────────────────────────────────────────────────

CREATE TABLE "orders" (
  "id"             uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id"        uuid         NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "table_id"       uuid         REFERENCES "tables"("id") ON DELETE SET NULL,
  "order_number"   text         NOT NULL,
  "status"         "order_status" NOT NULL DEFAULT 'pending',
  "customer_name"  text,
  "customer_phone" text,
  "notes"          text,
  "total_amount"   integer      NOT NULL DEFAULT 0,
  "created_at"     timestamptz  NOT NULL DEFAULT now(),
  "updated_at"     timestamptz  NOT NULL DEFAULT now(),
  "completed_at"   timestamptz
);

CREATE INDEX "idx_orders_shop_id"     ON "orders" USING btree ("shop_id");
CREATE INDEX "idx_orders_status"      ON "orders" USING btree ("status");
CREATE INDEX "idx_orders_created_at"  ON "orders" USING btree ("created_at");

COMMENT ON TABLE "orders" IS 'Customer orders placed via QR scan. total_amount = sum of line items + toppings.';

-- ─── 10. order_items ───────────────────────────────────────────────────────

CREATE TABLE "order_items" (
  "id"            uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id"      uuid        NOT NULL REFERENCES "orders"("id")   ON DELETE CASCADE,
  "product_id"    uuid        NOT NULL REFERENCES "products"("id"),
  "product_name"  text        NOT NULL,
  "unit_price"    integer     NOT NULL,
  "quantity"      integer     NOT NULL DEFAULT 1,
  "notes"         text,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_order_items_order_id" ON "order_items" USING btree ("order_id");

COMMENT ON TABLE "order_items" IS 'Line items — name and price are snapshots at time of order.';

-- ─── 11. order_item_toppings ───────────────────────────────────────────────

CREATE TABLE "order_item_toppings" (
  "order_item_id"   uuid    NOT NULL REFERENCES "order_items"("id")   ON DELETE CASCADE,
  "topping_item_id" uuid    NOT NULL REFERENCES "topping_items"("id"),
  "topping_name"    text    NOT NULL,
  "topping_price"   integer NOT NULL,
  PRIMARY KEY ("order_item_id", "topping_item_id")
);

COMMENT ON TABLE "order_item_toppings" IS 'Toppings selected per order item — names/prices are snapshots.';

-- ─── Migration record ───────────────────────────────────────────────────────

INSERT INTO "__drizzle_migrations" ("name", "hash", "executed_at")
VALUES ('001_initial_schema', 'initial', now())
ON CONFLICT DO NOTHING;
