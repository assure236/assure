import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

/// Polls the backend for new notifications and shows them as local push notifications.
/// No Firebase needed — purely Flutter + backend polling.
class LocalNotificationService {
  static final LocalNotificationService _instance = LocalNotificationService._();
  factory LocalNotificationService() => _instance;
  LocalNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
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
      'Assure ChitFunds',
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
      final token = prefs.getString('token');
      if (token == null) return; // Not logged in

      final lastCheck = prefs.getString('last_notification_check') ?? '2000-01-01T00:00:00Z';
      
      final res = await ApiService.get('/notifications?unread=true&limit=10');
      if (res['success'] != true) return;

      final rawData = res['data'];
      final List<Map<String, dynamic>> notifications;
      if (rawData is Map && rawData['notifications'] is List) {
        notifications = List<Map<String, dynamic>>.from(rawData['notifications']);
      } else if (rawData is List) {
        notifications = List<Map<String, dynamic>>.from(rawData);
      } else {
        return;
      }

      // Filter only notifications newer than last check
      final lastCheckTime = DateTime.tryParse(lastCheck) ?? DateTime(2000);
      int shown = 0;
      for (final n in notifications) {
        final createdAt = DateTime.tryParse(n['created_at']?.toString() ?? '');
        if (createdAt != null && createdAt.isAfter(lastCheckTime)) {
          await _showNotification(
            id: n['_id'].hashCode,
            title: n['title']?.toString() ?? 'Assure ChitFunds',
            body: n['message']?.toString() ?? '',
            payload: jsonEncode(n),
          );
          shown++;
          if (shown >= 3) break; // Don't spam — max 3 at a time
        }
      }

      // Update last check time
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
      'Assure ChitFunds',
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
