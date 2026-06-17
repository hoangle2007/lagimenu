# API updates (merge/split/loyalty)

## Public table label (QR khách)

- `GET /api/public/table/:merchantId/:tableNumber`
  - Trả về nhãn hiển thị cho UI khách.
  - Nếu có phiên `table_sessions` **active** cho bàn đó với `parent_table_number` (bàn đã ghép vào bàn chính):
    - `displayName`: dạng `Bàn {master} (ghép Bàn {slave})` (số bàn hiển thị không có leading zero).
    - `isMerged`: `true`
    - `parentTableNumber`: mã bàn chính (đã pad, ví dụ `01`)
    - `scannedTableNumber`: mã bàn trên URL/QR (đã pad)
  - Nếu không ghép: `displayName` là `Bàn {n}`, `isMerged`: `false`, `parentTableNumber`: `null`.

## Order note normalization

- `POST /api/orders` now accepts order-level aliases: `note`, `notes`, `customerNote`.
- Item-level note is normalized from `item.note` / `item.notes`.
- Order item responses expose both keys in transition period:
  - `note` (canonical)
  - `notes` (backward-compatible)

## Merge / split tables and bills

- `POST /api/orders/tables/merge`
  - Body: `{ masterTableNumber: string, sourceTableNumbers: string[] }`
  - Behavior:
    - Sets source table active sessions to parent of `masterTableNumber`.
    - Routes active source orders into master table.
    - Unifies `bill_group_id` for active orders in the merged group.

- `POST /api/orders/tables/split`
  - Body: `{ masterTableNumber: string, sourceTableNumber: string }`
  - Behavior:
    - Removes parent link from source active session.
    - Restores merged active orders that came from the source table.

- `POST /api/orders/bills/merge`
  - Body: `{ targetOrderId: number, sourceOrderIds: number[] }`
  - Behavior:
    - Marks source bills as merged into target bill.
    - Unifies bill group.

- `POST /api/orders/bills/split-items`
  - Body: `{ sourceOrderId: number, itemIds: number[], newTableNumber?: string }`
  - Behavior:
    - Creates a new order.
    - Moves selected `order_items` to new order.
    - Recomputes totals of source and new order.

- `GET /api/orders/bills/table/:tableNumber`
  - Returns active bill details and grouping info for table-level UI.

## Loyalty points

- Points are auto-added when an order transitions to `paid`.
- Earn rule is per merchant: `floor(total_price / N)` points, where **N** is `merchants.loyalty_vnd_per_point` (VNĐ per 1 point). Default **N = 1000** (same as the historical hard-coded rule).
- `GET /api/orders/loyalty/settings` (JWT `merchant` or `EMPLOYEE`)
  - Returns `{ vndPerPoint, earnRuleLabel }` for the authenticated shop.
- `PATCH /api/orders/loyalty/settings` (JWT **`merchant` only**)
  - Body: `{ "vndPerPoint": number }` — integer from 1 to 10_000_000.
  - Updates `loyalty_vnd_per_point` and returns the same shape as GET.
- `GET /api/orders/loyalty/account/:phone`
  - Returns current points, `earnRuleLabel`, and `vndPerPoint` for merchant + customer phone (public table flow uses `/api/public/loyalty/:merchantId/account` with the same response fields where applicable).
- `GET /api/orders/loyalty/transactions/:phone?limit=50`
  - Returns loyalty history entries.
- `GET /api/orders/loyalty/overview`
  - Includes `earnRuleLabel` and `vndPerPoint` reflecting the shop setting.
- `POST /api/orders/loyalty/adjust` (JWT **`merchant` only**)
  - Body: `{ "phone": string, "deltaPoints": number, "note"?: string }` — `deltaPoints` must be a non-zero integer between **-500_000** and **500_000** (cộng hoặc trừ điểm thủ công; ghi `loyalty_transactions` với `reason = manual_adjust`).
- Loyalty rewards may optionally reference a menu product: column `loyalty_rewards.product_id` → `products.id`. Create/patch reward bodies accept optional `productId` (or `null` on patch to clear). Public list `GET /api/public/loyalty/:merchantId/rewards` includes `productId` and `productName` when linked.
- `GET /api/public/loyalty/:merchantId/program` — `{ rewardCount, hasActiveRewards, earnRuleLabel }` cho UI giới thiệu chương trình (không cần SĐT).
