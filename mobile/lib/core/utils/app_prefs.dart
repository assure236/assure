import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Global reactive preferences — changes reflect across the app instantly.
class AppPrefs {
  AppPrefs._();

  static const _tourPendingKey = 'post_onboarding_tour_pending';
  static const _tourDismissedKey = 'post_onboarding_dismissed';

  static final chatbotVisible = ValueNotifier<bool>(true);

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    chatbotVisible.value = prefs.getBool('chatbot_visible') ?? true;
  }

  /// Set when user leaves the onboarding "done" screen — tour should run once.
  static Future<void> setPostOnboardingTourPending(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_tourPendingKey, value);
  }

  static Future<bool> isPostOnboardingTourPending() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_tourPendingKey) ?? false;
  }

  /// Set after tour is skipped or finished — never show done screen / tour again.
  static Future<void> setPostOnboardingDismissed(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_tourDismissedKey, value);
    if (value) {
      await prefs.setBool(_tourPendingKey, false);
    }
  }

  static Future<bool> isPostOnboardingDismissed() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_tourDismissedKey) ?? false;
  }

  static Future<void> loadPostOnboardingFlags() async {
    final prefs = await SharedPreferences.getInstance();
    _tourPending = prefs.getBool(_tourPendingKey) ?? false;
    _tourDismissed = prefs.getBool(_tourDismissedKey) ?? false;
  }

  static bool _tourPending = false;
  static bool _tourDismissed = false;

  static bool get tourPendingSync => _tourPending;
  static bool get tourDismissedSync => _tourDismissed;
}
