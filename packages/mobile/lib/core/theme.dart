import 'package:flutter/material.dart';

class GrabTheme {
  static const Color primary = Color(0xFF00B14F);
  static const Color secondary = Color(0xFF1E293B);
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF8FAFC);
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);
  static const Color success = Color(0xFF10B981);

  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        secondary: secondary,
        surface: background,
        error: error,
      ),
      scaffoldBackgroundColor: background,
      fontFamily: 'Roboto',
      textTheme: const TextTheme(
        displayLarge: TextStyle(fontWeight: FontWeight.w900, color: secondary),
        displayMedium: TextStyle(fontWeight: FontWeight.w900, color: secondary),
        displaySmall: TextStyle(fontWeight: FontWeight.w900, color: secondary),
        headlineLarge: TextStyle(fontWeight: FontWeight.w900, color: secondary),
        headlineMedium: TextStyle(fontWeight: FontWeight.w900, color: secondary),
        headlineSmall: TextStyle(fontWeight: FontWeight.w900, color: secondary),
        titleLarge: TextStyle(fontWeight: FontWeight.w800, color: secondary),
        titleMedium: TextStyle(fontWeight: FontWeight.w800, color: secondary),
        titleSmall: TextStyle(fontWeight: FontWeight.w800, color: secondary),
        bodyLarge: TextStyle(fontWeight: FontWeight.w600, color: secondary),
        bodyMedium: TextStyle(fontWeight: FontWeight.w500, color: secondary),
        labelLarge: TextStyle(fontWeight: FontWeight.w700, color: secondary),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: background,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        iconTheme: IconThemeData(color: secondary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
      ),
      cardTheme: CardTheme(
        elevation: 0,
        color: surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0xFFF1F5F9)),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: background,
        selectedItemColor: primary,
        unselectedItemColor: Colors.grey.shade400,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 10),
        type: BottomNavigationBarType.fixed,
        elevation: 20,
      ),
    );
  }
}
