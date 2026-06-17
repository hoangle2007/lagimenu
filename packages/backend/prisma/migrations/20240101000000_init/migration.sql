-- Migration: init
-- This migration baselines the existing database schema.

-- ============================================================
-- User & Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS "User" (
    "id"          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "email"       TEXT        UNIQUE NOT NULL,
    "passwordHash" TEXT       NOT NULL,
    "name"        TEXT        NOT NULL,
    "phone"       TEXT,
    "role"        TEXT        NOT NULL DEFAULT 'CUSTOMER',
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Shop
-- ============================================================
CREATE TABLE IF NOT EXISTS "Shop" (
    "id"      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "name"    TEXT NOT NULL,
    "address" TEXT,
    "ownerId" TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT
);

-- ============================================================
-- Employee
-- ============================================================
CREATE TABLE IF NOT EXISTS "Employee" (
    "id"        TEXT       PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "userId"    TEXT       UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "shopId"    TEXT       NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE,
    "pin"       TEXT       NOT NULL,
    "isActive"  BOOLEAN   NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Shift
-- ============================================================
CREATE TABLE IF NOT EXISTS "Shift" (
    "id"         TEXT       PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "employeeId" TEXT       NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
    "startTime"  TIMESTAMPTZ NOT NULL,
    "endTime"    TIMESTAMPTZ NOT NULL,
    "status"     TEXT       NOT NULL DEFAULT 'SCHEDULED'
);

-- ============================================================
-- Notification
-- ============================================================
CREATE TABLE IF NOT EXISTS "Notification" (
    "id"          TEXT       PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "shopId"      TEXT       NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE,
    "recipientId" TEXT       NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "senderId"    TEXT       REFERENCES "User"("id") ON DELETE SET NULL,
    "type"        TEXT       NOT NULL,
    "title"       TEXT       NOT NULL,
    "message"     TEXT       NOT NULL,
    "metadata"    JSONB,
    "isRead"      BOOLEAN    NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Order
-- ============================================================
CREATE TABLE IF NOT EXISTS "Order" (
    "id"          TEXT       PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "shopId"      TEXT       NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE,
    "customerId"  TEXT       NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "tableNumber" TEXT,
    "items"       JSONB      NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status"      TEXT       NOT NULL DEFAULT 'PENDING',
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SupportRequest
-- ============================================================
CREATE TABLE IF NOT EXISTS "SupportRequest" (
    "id"          TEXT       PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "shopId"      TEXT       NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE,
    "customerId"  TEXT       NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "type"        TEXT       NOT NULL,
    "message"     TEXT       NOT NULL,
    "tableNumber" TEXT,
    "status"      TEXT       NOT NULL DEFAULT 'PENDING',
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ChatMessage
-- ============================================================
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id"          TEXT       PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "shopId"      TEXT       NOT NULL,
    "senderId"    TEXT       NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "recipientId" TEXT       NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "message"     TEXT       NOT NULL,
    "isRead"      BOOLEAN    NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS "Employee_shopId_idx"           ON "Employee"("shopId");
CREATE INDEX IF NOT EXISTS "Shift_employeeId_idx"          ON "Shift"("employeeId");
CREATE INDEX IF NOT EXISTS "Notification_recipientId_idx" ON "Notification"("recipientId");
CREATE INDEX IF NOT EXISTS "Notification_shopId_idx"       ON "Notification"("shopId");
CREATE INDEX IF NOT EXISTS "Order_shopId_idx"              ON "Order"("shopId");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx"          ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "SupportRequest_shopId_idx"     ON "SupportRequest"("shopId");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx"      ON "ChatMessage"("senderId");
CREATE INDEX IF NOT EXISTS "ChatMessage_recipientId_idx"   ON "ChatMessage"("recipientId");
