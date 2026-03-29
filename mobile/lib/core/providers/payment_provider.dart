import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class PaymentProvider with ChangeNotifier {
  List<Map<String, dynamic>> _payments = [];
  List<Map<String, dynamic>> _duePayments = [];
  bool _isLoading = false;
  String? _error;

  bool get isLoading => _isLoading;
  String? get error => _error;

  // Paid/refunded history
  List<Map<String, dynamic>> get paidPayments => _payments
      .where((p) => p['payment_status'] == 'success' || p['payment_status'] == 'refunded')
      .toList();

  // Due payments from /due-payments (calculated schedule)
  List<Map<String, dynamic>> get duePayments => _duePayments;

  // Fallback: upcoming from raw payment list
  List<Map<String, dynamic>> get upcomingPayments {
    if (_duePayments.isNotEmpty) return _duePayments;
    return _payments
        .where((p) => p['payment_status'] == 'pending' || p['payment_status'] == 'overdue')
        .toList();
  }

  Future<void> fetchPayments() async {
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
