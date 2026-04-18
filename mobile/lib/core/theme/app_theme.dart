import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // ─── Brand Colors ───
  static const Color primaryColor = Color(0xFF0B1F3B);     // Deep Navy
  static const Color primaryDark = Color(0xFF071428);       // Gradient dark
  static const Color secondaryColor = Color(0xFFD4AF37);   // Gold
  static const Color accentBlue = Color(0xFF1E3A8A);       // Royal Blue
  static const Color successColor = Color(0xFF16A34A);
  static const Color errorColor = Color(0xFFDC2626);
  static const Color warningColor = Color(0xFFF59E0B);
  static const Color backgroundColor = Color(0xFFF8F9FB);  // Soft Off-White

  // ─── Extended Palette ───
  static const Color liveGreen = Color(0xFF4CAF50);
  static const Color countdownRed = Color(0xFFFF5252);
  static const Color digilockerBlue = Color(0xFF0066CC);
  static const Color purpleAccent = Color(0xFF7B1FA2);

  // ─── Light Backgrounds ───
  static const Color lightBlueBg = Color(0xFFE3F2FD);
  static const Color lightGreenBg = Color(0xFFE8F5E9);
  static const Color lightOrangeBg = Color(0xFFFFF3E0);
  static const Color lightYellowBg = Color(0xFFFFF8E1);
  static const Color surfaceLight = Color(0xFFF0F4F8);

  // ─── Shared Styles ───
  static const double cardRadius = 14;
  static List<BoxShadow> get cardShadow => [
    BoxShadow(color: Colors.black.withAlpha(12), blurRadius: 6, offset: const Offset(0, 2)),
  ];
  
  // Light Theme
  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryColor,
      primary: primaryColor,
      secondary: secondaryColor,
      tertiary: accentBlue,
      error: errorColor,
      surface: Colors.white,
      background: backgroundColor,
      onPrimary: Colors.white,
      onSecondary: primaryColor,
    ),
    scaffoldBackgroundColor: backgroundColor,
    textTheme: GoogleFonts.interTextTheme(),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: true,
      backgroundColor: primaryColor,
      foregroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: CardTheme(
      elevation: 0,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE2E8F0), width: 1),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primaryColor,
        side: const BorderSide(color: primaryColor),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: secondaryColor,
      foregroundColor: primaryColor,
      elevation: 4,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF1F5F9),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: primaryColor, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Colors.white,
      selectedItemColor: primaryColor,
      unselectedItemColor: Color(0xFF94A3B8),
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: const Color(0xFFF1F5F9),
      labelStyle: const TextStyle(color: primaryColor, fontWeight: FontWeight.w500),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFFE2E8F0),
      thickness: 1,
    ),
  );
  
  // Dark Theme
  static ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryColor,
      brightness: Brightness.dark,
      primary: accentBlue,
      secondary: secondaryColor,
    ),
    scaffoldBackgroundColor: const Color(0xFF0A0F1A),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: true,
      backgroundColor: Color(0xFF0A0F1A),
      foregroundColor: Colors.white,
    ),
  );
}
