import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';

class NotificationProvider with ChangeNotifier {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = false;
  String? _error;

  static const _cacheKey = 'notifications_cache';
  static const _cacheTsKey = 'notifications_cache_ts';
  static const _cacheTtl = Duration(minutes: 3);

  bool get isLoading => _isLoading;
  String? get error => _error;
  List<Map<String, dynamic>> get notifications => _notifications;
  int get unreadCount => _notifications.where((n) => n['is_read'] != true).length;

  Future<void> fetchNotifications() async {
    final prefs = await SharedPreferences.getInstance();

    // Load from cache immediately for fast UI
    if (_notifications.isEmpty) {
      final cached = prefs.getString(_cacheKey);
      if (cached != null) {
        try {
          _notifications = List<Map<String, dynamic>>.from(
            (jsonDecode(cached) as List).map((e) => Map<String, dynamic>.from(e)),
          );
          notifyListeners();
        } catch (_) {}
      }
    }

    // Check TTL — skip network call if cache is fresh
    final lastTs = prefs.getInt(_cacheTsKey) ?? 0;
    final age = DateTime.now().millisecondsSinceEpoch - lastTs;
    if (age < _cacheTtl.inMilliseconds && _notifications.isNotEmpty) {
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await ApiService.get('/notifications?page=1&limit=50');
      if (res['success'] == true) {
        final rawData = res['data'];
        if (rawData is List) {
          _notifications = List<Map<String, dynamic>>.from(rawData);
        } else if (rawData is Map && rawData['notifications'] is List) {
          _notifications = List<Map<String, dynamic>>.from(rawData['notifications']);
        } else {
          _notifications = [];
        }
        // Persist to cache
        await prefs.setString(_cacheKey, jsonEncode(_notifications));
        await prefs.setInt(_cacheTsKey, DateTime.now().millisecondsSinceEpoch);
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

  /// Force refresh from server (bypass TTL)
  Future<void> refresh() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheTsKey);
    _notifications = [];
    await fetchNotifications();
  }

  Future<void> markRead(String id) async {
    try {
      await ApiService.put('/notifications/$id/mark-read', {});
      final idx = _notifications.indexWhere((n) => (n['_id'] ?? n['id']).toString() == id);
      if (idx != -1) {
        _notifications[idx] = {..._notifications[idx], 'is_read': true};
        _persistCache();
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
      _persistCache();
      notifyListeners();
    } catch (e) {
      debugPrint('NotificationProvider markAllRead error: $e');
    }
  }

  /// Update local state only (when API was already called externally)
  void markReadLocal(String id) {
    final idx = _notifications.indexWhere((n) => (n['_id'] ?? n['id']).toString() == id);
    if (idx != -1) {
      _notifications[idx] = {..._notifications[idx], 'is_read': true};
      _persistCache();
      notifyListeners();
    }
  }

  /// Update local state only (when API was already called externally)
  void markAllReadLocal() {
    _notifications = _notifications.map((n) => {...n, 'is_read': true}).toList();
    _persistCache();
    notifyListeners();
  }

  Future<void> _persistCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, jsonEncode(_notifications));
      await prefs.setInt(_cacheTsKey, DateTime.now().millisecondsSinceEpoch);
    } catch (_) {}
  }
}
