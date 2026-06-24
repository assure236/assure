import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Polls the backend for new notifications and shows them as local push notifications.
/// No Firebase needed — purely Flutter + backend polling.
class LocalNotificationService {
  static final LocalNotificationService _instance = LocalNotificationService._();
  factory LocalNotificationService() => _instance;
  LocalNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  static const _secureStorage = FlutterSecureStorage();
  Timer? _pollTimer;
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _plugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (response) {
        debugPrint('Notification tapped: ${response.payload}');
      },
    );

    // Create notification channel for Android
    const channel = AndroidNotificationChannel(
      'assure_chitfunds',
      'Assure Chit Funds',
      description: 'Payment reminders, auction alerts, and more',
      importance: Importance.high,
    );
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    _initialized = true;
  }

  /// Start polling for new notifications every [interval] seconds.
  void startPolling({int intervalSeconds = 30}) {
    stopPolling();
    _pollTimer = Timer.periodic(
      Duration(seconds: intervalSeconds),
      (_) => _checkForNewNotifications(),
    );
    // Also check immediately
    _checkForNewNotifications();
  }

  void stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _checkForNewNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // SECURITY FIX: read token from secure storage only.
      final token = await _secureStorage.read(key: 'access_token');
      if (token == null) return; // Not logged in

      // Just update the last check timestamp — push notifications are handled by FCM
      // This service only tracks unread count for the badge, not for showing popups
      await prefs.setString('last_notification_check', DateTime.now().toUtc().toIso8601String());
    } catch (e) {
      debugPrint('Notification poll error: $e');
    }
  }

  Future<void> _showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'assure_chitfunds',
      'Assure Chit Funds',
      channelDescription: 'Payment reminders, auction alerts, and more',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
      showWhen: true,
    );
    const details = NotificationDetails(android: androidDetails);
    await _plugin.show(id, title, body, details, payload: payload);
  }

  /// Show a notification immediately (for testing or manual triggers).
  Future<void> showNow({
    required String title,
    required String body,
  }) async {
    await _showNotification(
      id: DateTime.now().millisecondsSinceEpoch % 100000,
      title: title,
      body: body,
    );
  }
}
