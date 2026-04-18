import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class PaymentProvider with ChangeNotifier {
  List<Map<String, dynamic>> _payments = [];
  List<Map<String, dynamic>> _duePayments = [];
  bool _isLoading = false;
  String? _error;

  static const _paidCacheKey = 'payments_paid_cache';
  static const _dueCacheKey = 'payments_due_cache';
  static const _cacheTsKey = 'payments_cache_ts';

  bool get isLoading => _isLoading;
  String? get error => _error;

  // Paid/refunded history
  List<Map<String, dynamic>> get paidPayments => _payments
      .where((p) => p['payment_status'] == 'success' || p['payment_status'] == 'refunded')
      .toList();

  // Due payments from /due-payments (calculated schedule)
  List<Map<String, dynamic>> get duePayments => _duePayments;

  // Upcoming = overdue + current (can_pay = true)
  List<Map<String, dynamic>> get upcomingPayments {
    if (_duePayments.isNotEmpty) return _duePayments;
    return _payments
        .where((p) => p['payment_status'] == 'pending' || p['payment_status'] == 'overdue')
        .toList();
  }

  // Only payable (overdue + current month, not future)
  List<Map<String, dynamic>> get payablePayments => _duePayments
      .where((p) => p['payment_status'] == 'overdue' || p['payment_status'] == 'pending')
      .toList();

  // Future months
  List<Map<String, dynamic>> get futurePayments => _duePayments
      .where((p) => p['payment_status'] == 'upcoming')
      .toList();

  Future<void> fetchPayments() async {
    // Load from cache for instant UI
    if (_payments.isEmpty && _duePayments.isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final paidCache = prefs.getString(_paidCacheKey);
        final dueCache = prefs.getString(_dueCacheKey);
        if (paidCache != null) _payments = List<Map<String, dynamic>>.from(jsonDecode(paidCache));
        if (dueCache != null) _duePayments = List<Map<String, dynamic>>.from(jsonDecode(dueCache));
        if (_payments.isNotEmpty || _duePayments.isNotEmpty) notifyListeners();
      } catch (_) {}
    }

    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        ApiService.get('/payments/my-payments'),
        ApiService.get('/payments/due-payments'),
      ]);

      final histRes = results[0];
      if (histRes['success'] == true) {
        final data = histRes['data'];
        _payments = List<Map<String, dynamic>>.from(
          (data is Map ? (data['all'] ?? data['payments'] ?? data) : data) ?? [],
        );
      }

      final dueRes = results[1];
      if (dueRes['success'] == true) {
        _duePayments = List<Map<String, dynamic>>.from(dueRes['data'] ?? []);
      }

      // Persist to cache
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_paidCacheKey, jsonEncode(_payments));
        await prefs.setString(_dueCacheKey, jsonEncode(_duePayments));
        await prefs.setInt(_cacheTsKey, DateTime.now().millisecondsSinceEpoch);
      } catch (_) {}
    } catch (e) {
      _error = 'Could not connect to server';
      debugPrint('PaymentProvider error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Create a Cashfree payment order for a due installment.
  /// Returns the full response data including payment_url, payment_session_id, order_id.
  Future<Map<String, dynamic>> createOrder({
    required String chitGroupId,
    required int monthNumber,
    required double amount,
    double lateFee = 0,
  }) async {
    try {
      final res = await ApiService.post('/payments/create-order', {
        'chit_group_id': chitGroupId,
        'month_number': monthNumber,
        'amount': amount,
        'late_fee': lateFee,
        'payment_type': 'installment',
      });
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  /// Verify a Cashfree payment order by order_id.
  Future<Map<String, dynamic>> verifyOrder(String orderId, {String? paymentId}) async {
    try {
      final body = <String, dynamic>{'order_id': orderId};
      if (paymentId != null) body['payment_id'] = paymentId;
      final res = await ApiService.post('/payments/verify', body);
      if (res['success'] == true) {
        // Refresh payments list after successful verification
        fetchPayments();
      }
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
