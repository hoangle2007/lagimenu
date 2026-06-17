# End-to-end tests (Playwright)



## Prerequisites



- **PostgreSQL**: `packages/backend/.env` must define a valid `DATABASE_URL` (or equivalent Drizzle connection settings). Wrong credentials produce HTTP 500 on auth/order APIs (`password authentication failed for user ...`).

- **Backend**: `npm run dev:backend` on port **3001**. Optional: `E2E_AUTO_APPROVE_MERCHANT=true` auto-approves new merchant registrations (needed for tests that call `registerOwner` and expect a JWT).

- **Frontend**: `npm run dev:frontend` — Vite default port **3000** (override with `VITE_DEV_PORT`, see `packages/frontend/vite.config.ts`).

- **Playwright**: From repo root: `npm install` then `npx playwright install chromium`.



## Run



```bash

# Terminal 1 — backend (example with E2E flag)

$env:E2E_AUTO_APPROVE_MERCHANT='true'; npm run dev:backend



# Terminal 2 — frontend

npm run dev:frontend



# Terminal 3 — tests

npm run test:e2e

```



Override UI base URL if needed:



```bash

$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; npm run test:e2e

```



API calls from tests use `E2E_API_URL` (default `http://localhost:3001`).



## Notes



- Registration tests accept either `/merchant/pending` (manual approval) or `/merchant` when `E2E_AUTO_APPROVE_MERCHANT=true`.

- Root `playwright.config.ts` defaults `baseURL` to `http://localhost:3000` to match Vite.

## Backlog / manual QA (chưa có spec Playwright tự động)

Các luồng sau nên được QA thủ công hoặc bổ sung file spec khi có fixture API ổn định. Hiện `tests/e2e/orders-support.spec.ts` chỉ cover pipeline đơn cơ bản (guest order + staff), không bao gồm các bước dưới.

- Merge table flow:
  - Merge table `06` into table `05`.
  - Create new order from table `06`.
  - Verify order is routed into table `05` active bill group.
- Split table flow:
  - Split table `06` out from table `05`.
  - Verify next new order from table `06` stays in `06`.
- Split bill by items:
  - From one order, move selected `order_items` into a new bill.
  - Verify source/new totals are recalculated correctly.
- Notes compatibility:
  - Submit with `note`, `notes`, and `customerNote`.
  - Verify all merchant screens show notes using `note ?? notes`.
- Loyalty:
  - Complete payment for a customer with phone number.
  - Verify points increase and transaction history is created.
- Public table label (ghép bàn):
  - Sau khi merge, gọi `GET /api/public/table/:merchantId/06` (bàn phụ) và kiểm tra `displayName` / `isMerged`.

