-- Migration: add_employees_shifts
-- Add employees and shifts tables for shop staff management

-- 1. Create employees table
CREATE TABLE IF NOT EXISTS "employees" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
    "pin" text NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_employees_user_id" ON "employees"("user_id");
CREATE INDEX IF NOT EXISTS "idx_employees_shop_id" ON "employees"("shop_id");
CREATE INDEX IF NOT EXISTS "idx_employees_is_active" ON "employees"("is_active");

-- 2. Create shifts table
CREATE TABLE IF NOT EXISTS "shifts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
    "start_time" timestamptz NOT NULL,
    "end_time" timestamptz NOT NULL,
    "status" text NOT NULL DEFAULT 'SCHEDULED',
    "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_shifts_employee_id" ON "shifts"("employee_id");
CREATE INDEX IF NOT EXISTS "idx_shifts_status" ON "shifts"("status");
CREATE INDEX IF NOT EXISTS "idx_shifts_start_time" ON "shifts"("start_time");
