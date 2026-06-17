-- Geo fence + customer order metadata + IP blocklist
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS geo_fence_radius_m integer;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS require_customer_location boolean NOT NULL DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_ip text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_lat double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_lng double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_location_accuracy_m double precision;

CREATE TABLE IF NOT EXISTS merchant_blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  ip text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, ip)
);
CREATE INDEX IF NOT EXISTS idx_merchant_blocked_ips_merchant ON merchant_blocked_ips(merchant_id);
