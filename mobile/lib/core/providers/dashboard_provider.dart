import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';

class DashboardProvider with ChangeNotifier {
  Map<String, dynamic>? _data;
  bool _isLoading = false;
  String? _error;

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

  Future<void> fetchDashboard() async {
    // Skip API call if no token (dev/test mode — show empty dashboard)
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      _isLoading = false;
      _data = {};
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiService.get('/dashboard/member');
      if (res['success'] == true) {
        _data = Map<String, dynamic>.from(res['data']);
      } else {
        _error = res['message'] ?? 'Failed to load dashboard';
        _data = {};
      }
    } catch (e) {
      _error = 'Could not connect to server';
      _data = {};
      debugPrint('DashboardProvider error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

}
