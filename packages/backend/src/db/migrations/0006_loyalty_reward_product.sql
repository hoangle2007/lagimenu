-- Link loyalty reward to a menu product (drink, topping, etc.)
ALTER TABLE loyalty_rewards
ADD COLUMN IF NOT EXISTS product_id integer REFERENCES products(id) ON DELETE SET NULL;
