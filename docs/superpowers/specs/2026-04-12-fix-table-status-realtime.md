# Design Doc: Fix Real-time Table Status Update

## Problem
The mobile app's table map (sơ đồ bàn) does not correctly display table statuses even when relevant orders are present in the system. This is primarily due to a string matching mismatch between the generated table numbers (e.g., "01", "02") and the table names returned by the API (e.g., "Bàn 2").

## Objectives
- Ensure orders with prefixes like "Bàn " or "Table " correctly map to the corresponding numbered tables in the UI.
- Maintain real-time updates when new orders arrive via WebSockets.

## Proposed Changes

### 1. Robust Table Number Normalization
Update `TableInfo.fromOrders` in `packages/mobile/lib/models/table_info.dart` to improve the `normalizeTableNumber` helper function.

**Target Logic:**
```dart
String normalizeTableNumber(String? num) {
  if (num == null) return '';
  // 1. Lowercase and trim
  final cleaned = num.trim().toLowerCase()
    // 2. Remove common prefixes
    .replaceAll('bàn', '')
    .replaceAll('table', '')
    .replaceAll('#', '')
    .trim();
  
  // 3. Convert to integer to handle "01" vs "1"
  final parsed = int.tryParse(cleaned);
  if (parsed != null) {
    return parsed.toString();
  }
  return cleaned;
}
```

### 2. Provider/UI Sync
Verify that `TablesScreen` correctly triggers `TablesProvider.refreshTables` when `OrdersProvider.orders` changes. The current implementation uses `WidgetsBinding.instance.addPostFrameCallback`, which is functional but requires accurate matching logic to be effective.

## Verification Plan
1. Manually verify that an order with `"table_number": "Bàn 2"` correctly highlights table "02" in the mobile app.
2. Verify that changing the status of an order (e.g., from "pending" to "ready") correctly updates the table color in real-time.
