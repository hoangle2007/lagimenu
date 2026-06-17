-- Fix: error: role "lagimenu" does not exist (drizzle-kit / backend cần user này)
--
-- Bước 0: Sửa YOUR_PASSWORD bên dưới cho trùng mật khẩu trong packages/backend/.env (DATABASE_URL).
--
-- Cách A — psql (khuyến nghị, từ thư mục packages/backend):
--   psql -h 127.0.0.1 -p 5432 -U postgres -f src/db/scripts/create-lagimenu-role.sql
--
-- Cách B — pgAdmin 4: Query Tool kết nối bằng user postgres.
--   Chạy KHỐI 1 (Execute). Sau đó mở tab Query mới, chạy KHỐI 2 (một dòng).
--   (pgAdmin hay bọc cả file trong một transaction; CREATE DATABASE không chạy được trong transaction.)

-- ========== KHỐI 1 — chỉ tạo role ==========
DO $body$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lagimenu') THEN
    CREATE ROLE lagimenu WITH LOGIN PASSWORD 'Hoang2007';
  END IF;
END
$body$;

-- ========== KHỐI 2 — pgAdmin: tab Query MỚI, chỉ chọn dòng CREATE bên dưới rồi Execute.
-- psql -f cả file: chạy tiếp sau KHỐI 1 (ổn định). Nếu DB đã tồn tại, bỏ qua lỗi hoặc xóa dòng này.
CREATE DATABASE lagimenu OWNER lagimenu;
