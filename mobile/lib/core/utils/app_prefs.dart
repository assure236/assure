import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Global reactive preferences — changes reflect across the app instantly.
class AppPrefs {
  AppPrefs._();

  static final chatbotVisible = ValueNotifier<bool>(true);

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    chatbotVisible.value = prefs.getBool('chatbot_visible') ?? true;
  }
}
