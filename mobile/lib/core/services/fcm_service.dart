import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

/// Top-level background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message: ${message.messageId}');
}

class FcmService {
  static final FcmService _instance = FcmService._();
  factory FcmService() => _instance;
  FcmService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;

    // Request notification permission
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    debugPrint('FCM permission: ${settings.authorizationStatus}');

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('Push notifications denied by user');
      return;
    }

    // Set up local notification display for foreground messages
    const androidChannel = AndroidNotificationChannel(
      'assure_chitfunds',
      'Assure ChitFunds',
      description: 'Payment reminders, auction alerts, and more',
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle notification taps when app is in background/terminated
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if app was opened from a notification
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }

    // Listen for token refresh
    _messaging.onTokenRefresh.listen(_onTokenRefresh);

    _initialized = true;
    debugPrint('FCM Service initialized');
  }

  /// Get the current FCM token
  Future<String?> getToken() async {
    try {
      final token = await _messaging.getToken();
      debugPrint('FCM Token: ${token?.substring(0, 20)}...');
      return token;
    } catch (e) {
      debugPrint('Failed to get FCM token: $e');
      return null;
    }
  }

  /// Register the FCM token with the backend
  Future<void> registerTokenWithBackend() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final authToken = prefs.getString('token');
      if (authToken == null) return; // Not logged in

      final fcmToken = await getToken();
      if (fcmToken == null) return;

      // Check if token already registered
      final savedToken = prefs.getString('fcm_token');
      if (savedToken == fcmToken) return; // Already registered

      final res = await ApiService.post('/notifications/register-token', {
        'fcm_token': fcmToken,
      });

      if (res['success'] == true) {
        await prefs.setString('fcm_token', fcmToken);
        debugPrint('FCM token registered with backend');
      }
    } catch (e) {
      debugPrint('Failed to register FCM token: $e');
    }
  }

  /// Handle token refresh
  void _onTokenRefresh(String newToken) async {
    debugPrint('FCM token refreshed');
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('fcm_token'); // Force re-registration
    await registerTokenWithBackend();
  }

  /// Handle foreground message — DO NOT show local notification here.
  /// Firebase automatically shows the push notification in the system tray.
  /// We only update the last notification check time so the polling service
  /// doesn't re-show it.
  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('Foreground message: ${message.notification?.title}');
    // Update last check time so LocalNotificationService doesn't duplicate
    SharedPreferences.getInstance().then((prefs) {
      prefs.setString('last_notification_check', DateTime.now().toUtc().toIso8601String());
    });
  }

  /// Handle notification tap (app opened from notification)
  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('Notification tapped: ${message.data}');
    // Navigation can be handled here based on message.data['type']
  }

  /// Clear stored FCM token on logout
  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('fcm_token');
    // Optionally delete the token from Firebase
    try {
      await _messaging.deleteToken();
    } catch (_) {}
  }
}
