import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';

class DashboardProvider with ChangeNotifier {
  Map<String, dynamic>? _data;
  bool _isLoading = false;
  String? _error;

  static const _cacheKey = 'dashboard_cache';
  static const _cacheTsKey = 'dashboard_cache_ts';
  static const _profileCacheKey = 'profile_completion_cache';
  static const _cacheTtl = Duration(minutes: 5);

  Map<String, dynamic>? get data => _data;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get totalGroups => (_data?['totalGroups'] ?? 0) as int;
  int get activeGroups => (_data?['activeGroups'] ?? 0) as int;
  double get totalInvested =>
      double.tryParse(_data?['totalInvested']?.toString() ?? '0') ?? 0;
  int get creditScore =>
      (_data?['user']?['credit_score'] ?? 500) as int;
  String get kycStatus => _data?['user']?['kyc_status'] ?? 'pending';
  List get memberships => (_data?['memberships'] as List?) ?? [];
  List get recentPayments => (_data?['recentPayments'] as List?) ?? [];
  List get upcomingAuctions => (_data?['upcomingAuctions'] as List?) ?? [];

  // Profile completion
  Map<String, dynamic>? _profileCompletion;
  Map<String, dynamic>? get profileCompletion => _profileCompletion;
  int get profilePercentage => (_profileCompletion?['percentage'] ?? 0) as int;
  bool get isProfileComplete => _profileCompletion?['isComplete'] == true;
  List get missingFields => ((_profileCompletion?['fields'] as List?) ?? [])
      .where((f) => f['filled'] != true)
      .toList();

  Future<void> fetchDashboard() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      _isLoading = false;
      _data = {};
      notifyListeners();
      return;
    }

    // Load from cache immediately for fast UI
    if (_data == null) {
      final cached = prefs.getString(_cacheKey);
      if (cached != null) {
        try {
          _data = Map<String, dynamic>.from(jsonDecode(cached));
        } catch (_) {}
      }
    }
    if (_profileCompletion == null) {
      final cachedProfile = prefs.getString(_profileCacheKey);
      if (cachedProfile != null) {
        try {
          _profileCompletion = Map<String, dynamic>.from(jsonDecode(cachedProfile));
        } catch (_) {}
      }
    }
    if (_data != null || _profileCompletion != null) notifyListeners();

    // Check if cache is still fresh — skip API if so
    final cacheTs = prefs.getInt(_cacheTsKey) ?? 0;
    if (_data != null && DateTime.now().millisecondsSinceEpoch - cacheTs < _cacheTtl.inMilliseconds) {
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiService.get('/dashboard/member');
      if (res['success'] == true) {
        _data = Map<String, dynamic>.from(res['data']);
        // Persist to cache
        await prefs.setString(_cacheKey, jsonEncode(_data));
        await prefs.setInt(_cacheTsKey, DateTime.now().millisecondsSinceEpoch);
      } else {
        _error = res['message'] ?? 'Failed to load dashboard';
        if (_data == null) _data = {};
      }

      // Fetch profile completion
      try {
        final profileRes = await ApiService.get('/dashboard/profile-completion');
        if (profileRes['success'] == true) {
          _profileCompletion = Map<String, dynamic>.from(profileRes['data']);
          await prefs.setString(_profileCacheKey, jsonEncode(_profileCompletion));
        }
      } catch (_) {}
    } catch (e) {
      _error = 'Could not connect to server';
      if (_data == null) _data = {};
      debugPrint('DashboardProvider error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Force refresh — bypasses cache TTL.
  Future<void> refresh() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheTsKey);
    await fetchDashboard();
  }
}
