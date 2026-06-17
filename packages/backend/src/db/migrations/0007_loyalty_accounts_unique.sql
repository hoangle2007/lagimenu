-- Bảng loyalty_accounts cũ có thể thiếu UNIQUE(merchant_id, customer_phone) → ON CONFLICT lỗi
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_accounts_merchant_phone_uq
ON loyalty_accounts (merchant_id, customer_phone);
