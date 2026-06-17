-- Per-merchant earn rule: floor(order_total / N) points, default N = 1000
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS loyalty_vnd_per_point integer NOT NULL DEFAULT 1000;
