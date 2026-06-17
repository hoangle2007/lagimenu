ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "wifi_ssid" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "wifi_password" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "account_status" text DEFAULT 'approved';

CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "value" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
