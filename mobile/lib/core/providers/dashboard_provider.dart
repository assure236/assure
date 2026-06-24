import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';

class DashboardProvider with ChangeNotifier {
  static const _secureStorage = FlutterSecureStorage();
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _kycFlowStatus;
  bool _isLoading = false;
  String? _error;
  int _availableChitsCount = 0;

  static const _cacheKey = 'dashboard_cache';
  static const _cacheTsKey = 'dashboard_cache_ts';
  static const _profileCacheKey = 'profile_completion_cache';
  static const _cacheTtl = Duration(minutes: 5);

  Map<String, dynamic>? get data => _data;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get totalGroups => (_data?['totalGroups'] ?? 0) as int;
  int get activeGroups => (_data?['activeGroups'] ?? 0) as int;
  int get availableChitsCount => _availableChitsCount;
  double get totalInvested =>
      double.tryParse(_data?['totalInvested']?.toString() ?? '0') ?? 0;
  int get creditScore => (_data?['user']?['credit_score'] ?? 500) as int;
  String get kycStatus => _data?['user']?['kyc_status'] ?? 'pending';
  List get memberships => (_data?['memberships'] as List?) ?? [];
  List get recentPayments => (_data?['recentPayments'] as List?) ?? [];
  List get upcomingAuctions => (_data?['upcomingAuctions'] as List?) ?? [];
  Map<String, dynamic>? get kycFlowStatus => _kycFlowStatus;
  String get profileApprovalStatus =>
      (_data?['user']?['profile_edit_status'] ?? 'none').toString();

  bool get digilockerConnected =>
      _kycFlowStatus?['digilocker_connected'] == true;
  bool get selfieVerified =>
      _kycFlowStatus?['selfie_verified'] == true ||
      _hasDocumentType('selfie_photo');
  bool get chequeUploaded => _hasDocumentType('cancelled_cheque');

  bool _hasDocumentType(String type) {
    final docs = (_kycFlowStatus?['documents'] as List?) ?? const [];
    for (final doc in docs) {
      if (doc is Map && doc['document_type']?.toString() == type) {
        return true;
      }
    }
    return false;
  }

  // Profile completion
  Map<String, dynamic>? _profileCompletion;
  Map<String, dynamic>? get profileCompletion => _profileCompletion;
  int get profilePercentage {
    final approved = profileApprovalStatus.toLowerCase() == 'approved';
    if (approved) return 100;
    return (_profileCompletion?['percentage'] ?? 0) as int;
  }

  bool get isProfileComplete {
    final approved = profileApprovalStatus.toLowerCase() == 'approved';
    if (approved) return true;
    return _profileCompletion?['isComplete'] == true;
  }

  List get missingFields {
    final approved = profileApprovalStatus.toLowerCase() == 'approved';
    if (approved) return const [];
    return ((_profileCompletion?['fields'] as List?) ?? [])
        .where((f) => f['filled'] != true)
        .toList();
  }

  Future<void> fetchDashboard() async {
    final prefs = await SharedPreferences.getInstance();
    // SECURITY FIX: read token from secure storage only.
    final token = await _secureStorage.read(key: 'access_token');
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
          _availableChitsCount = (_data?['availableChitsCount'] ?? 0) as int;
        } catch (_) {}
      }
    }
    if (_profileCompletion == null) {
      final cachedProfile = prefs.getString(_profileCacheKey);
      if (cachedProfile != null) {
        try {
          _profileCompletion =
              Map<String, dynamic>.from(jsonDecode(cachedProfile));
        } catch (_) {}
      }
    }
    if (_data != null || _profileCompletion != null) notifyListeners();

    // Check if cache is still fresh — skip API if so
    final cacheTs = prefs.getInt(_cacheTsKey) ?? 0;
    if (_data != null &&
        DateTime.now().millisecondsSinceEpoch - cacheTs <
            _cacheTtl.inMilliseconds) {
      if (_kycFlowStatus == null) {
        try {
          final kycRes = await ApiService.get('/kyc/status');
          if (kycRes['success'] == true && kycRes['data'] is Map) {
            _kycFlowStatus = Map<String, dynamic>.from(kycRes['data']);
            notifyListeners();
          }
        } catch (_) {}
      }
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiService.get('/dashboard/member');
      if (res['success'] == true) {
        _data = Map<String, dynamic>.from(res['data']);

        try {
          final kycRes = await ApiService.get('/kyc/status');
          if (kycRes['success'] == true && kycRes['data'] is Map) {
            _kycFlowStatus = Map<String, dynamic>.from(kycRes['data']);
          }
        } catch (_) {}

        final groupResponses = await Future.wait([
          ApiService.get('/chit-groups?status=not_started&limit=1'),
          ApiService.get('/chit-groups?status=active&limit=1'),
          ApiService.get('/chit-groups?status=vacant&limit=1'),
        ]);

        int availableCount = 0;
        for (final response in groupResponses) {
          if (response['success'] != true) continue;
          final data = response['data'];
          if (data is Map && data['total'] != null) {
            availableCount += int.tryParse(data['total'].toString()) ?? 0;
          }
        }

        _availableChitsCount = availableCount;
        _data?['availableChitsCount'] = _availableChitsCount;

        // Persist to cache
        await prefs.setString(_cacheKey, jsonEncode(_data));
        await prefs.setInt(_cacheTsKey, DateTime.now().millisecondsSinceEpoch);
      } else {
        _error = res['message'] ?? 'Failed to load dashboard';
        _data ??= {};
      }

      // Fetch profile completion
      try {
        final profileRes =
            await ApiService.get('/dashboard/profile-completion');
        if (profileRes['success'] == true) {
          _profileCompletion = Map<String, dynamic>.from(profileRes['data']);
          await prefs.setString(
              _profileCacheKey, jsonEncode(_profileCompletion));
        }
      } catch (_) {}
    } catch (e) {
      _error = 'Could not connect to server';
      _data ??= {};
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
