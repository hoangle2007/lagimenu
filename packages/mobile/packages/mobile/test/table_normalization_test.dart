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

  bool allPassed = true;
  testCases.forEach((input, expected) {
    final result = normalize(input);
    if (result == expected) {
      print('✅ PASS: "$input" -> "$result"');
    } else {
      print('❌ FAIL: "$input" -> "$result" (expected "$expected")');
      allPassed = false;
    }
  });

  if (allPassed) {
    print('\n✨ All stabilization tests passed!');
  } else {
    print('\n⚠️ Some tests failed.');
  }
}
