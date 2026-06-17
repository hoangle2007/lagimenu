ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "opening_hours_json" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "feature_flags_json" text;

CREATE TABLE IF NOT EXISTS "staff_invites" (
  "id" serial PRIMARY KEY NOT NULL,
  "merchant_id" text NOT NULL REFERENCES "merchants"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "role" text NOT NULL DEFAULT 'waiter',
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_staff_invites_merchant_id" ON "staff_invites" ("merchant_id");
