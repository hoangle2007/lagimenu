# Fix Real-time Table Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the table status matching logic in the mobile app to correctly map "Bàn X" strings to numbered tables.

**Architecture:** Update the normalization logic in `TableInfo` to handle prefixes and numeric conversions, ensuring robust string comparison.

**Tech Stack:** Flutter/Dart

---

### Task 1: Robust Table Normalization logic
**Files:**
- Modify: `packages/mobile/lib/models/table_info.dart`
- Create: `packages/mobile/test/table_normalization_test.dart` (Scratch test script)

- [ ] **Step 1: Create a scratch Dart script to verify the new normalization logic**
Create `packages/mobile/test/table_normalization_test.dart`:
```dart
void main() {
  String normalize(String? num) {
    if (num == null) return '';
    final cleaned = num.trim().toLowerCase()
        .replaceAll('bàn', '')
        .replaceAll('table', '')
        .replaceAll('#', '')
        .trim();
    
    final parsed = int.tryParse(cleaned);
    if (parsed != null) {
      return parsed.toString();
    }
    return cleaned;
  }

  final testCases = {
    '02': '2',
    'Bàn 2': '2',
    'Table 2': '2',
    '#2': '2',
    '2 ': '2',
    'Mang về': 'mang về',
  };

  testCases.forEach((input, expected) {
    final result = normalize(input);
    if (result == expected) {
      print('✅ PASS: "$input" -> "$result"');
    } else {
      print('❌ FAIL: "$input" -> "$result" (expected "$expected")');
    }
  });
}
```

- [ ] **Step 2: Run the test script**
Run: `dart packages/mobile/test/table_normalization_test.dart`
Expected: All test cases pass.

- [ ] **Step 3: Update `TableInfo.fromOrders` in `packages/mobile/lib/models/table_info.dart`**
Modify the `normalizeTableNumber` function within `TableInfo.fromOrders`:

```dart
    String normalizeTableNumber(String? num) {
      if (num == null) return '';
      final cleaned = num.trim().toLowerCase()
          .replaceAll('bàn', '')
          .replaceAll('table', '')
          .replaceAll('#', '')
          .trim();
      
      final parsed = int.tryParse(cleaned);
      if (parsed != null) {
        return parsed.toString();
      }
      return cleaned;
    }
```

- [ ] **Step 4: Commit the changes**
```bash
git add packages/mobile/lib/models/table_info.dart
git commit -m "fix: improve table number normalization to handle prefixes and padding"
```

### Task 2: Verify and Cleanup
**Files:**
- Remove: `packages/mobile/test/table_normalization_test.dart`

- [ ] **Step 1: Remove the scratch test file**
```bash
rm packages/mobile/test/table_normalization_test.dart
```

- [ ] **Step 2: Final manual verification instructions**
Instruct the user to check "Bàn 2" on the mobile app to see if the status reflects correctly.
