import 'package:flutter_test/flutter_test.dart';

import 'package:kivomenu_admin/main.dart';

void main() {
  testWidgets('App loads correctly', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const KivoMenuAdmin());

    // Verify the app loads
    expect(find.byType(KivoMenuAdmin), findsOneWidget);
  });
}
