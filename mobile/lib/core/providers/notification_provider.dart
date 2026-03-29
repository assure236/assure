import 'package:flutter/foundation.dart';

import '../services/api_service.dart';

class NotificationProvider with ChangeNotifier {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = false;
  String? _error;

  bool get isLoading => _isLoading;
  String? get error => _error;
  List<Map<String, dynamic>> get notifications => _notifications;
  int get unreadCount => _notifications.where((n) => n['is_read'] != true).length;

  Future<void> fetchNotifications() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await ApiService.get('/notifications?page=1&limit=50');
      if (res['success'] == true) {
        // Handle both wrapped {notifications: [...]} and flat array response
        final rawData = res['data'];
        if (rawData is List) {
          _notifications = List<Map<String, dynamic>>.from(rawData);
        } else if (rawData is Map && rawData['notifications'] is List) {
          _notifications = List<Map<String, dynamic>>.from(rawData['notifications']);
        } else {
          _notifications = [];
        }
      } else {
        _error = res['message'] ?? 'Failed to load notifications';
      }
    } catch (e) {
      _error = 'Could not connect to server';
      debugPrint('NotificationProvider error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> markRead(String id) async {
    try {
      await ApiService.put('/notifications/$id/mark-read', {});
      final idx = _notifications.indexWhere((n) => n['id'].toString() == id);
      if (idx != -1) {
        _notifications[idx] = {..._notifications[idx], 'is_read': true};
        notifyListeners();
      }
    } catch (e) {
      debugPrint('NotificationProvider markRead error: $e');
    }
  }

  Future<void> markAllRead() async {
    try {
      await ApiService.put('/notifications/mark-all-read', {});
      _notifications = _notifications.map((n) => {...n, 'is_read': true}).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('NotificationProvider markAllRead error: $e');
    }
  }
}

