import 'package:flutter/material.dart';
import 'package:flutter_cashfree_pg_sdk/api/cferrorresponse/cferrorresponse.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpayment/cfdropcheckoutpayment.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpaymentcomponents/cfpaymentcomponent.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpaymentgateway/cfpaymentgatewayservice.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfsession/cfsession.dart';
import 'package:flutter_cashfree_pg_sdk/api/cftheme/cftheme.dart';
import 'package:flutter_cashfree_pg_sdk/utils/cfenums.dart';
import 'package:flutter_cashfree_pg_sdk/utils/cfexceptions.dart';

import '../../../core/services/api_service.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/celebration_overlay.dart';

class CashfreePaymentScreen extends StatefulWidget {
  final String paymentSessionId;
  final String orderId;
  final String paymentId;

  const CashfreePaymentScreen({
    super.key,
    required this.paymentSessionId,
    required this.orderId,
    required this.paymentId,
  });

  @override
  State<CashfreePaymentScreen> createState() => _CashfreePaymentScreenState();
}

class _CashfreePaymentScreenState extends State<CashfreePaymentScreen> {
  final _cfService = CFPaymentGatewayService();
  bool _processing = true;
  bool _verifying = false;
  bool _done = false;
  String? _errorMsg;

  @override
  void initState() {
    super.initState();
    _cfService.setCallback(_onPaymentVerify, _onPaymentError);
    _startPayment();
  }

  void _startPayment() {
    try {
      final session = CFSessionBuilder()
          .setEnvironment(CFEnvironment.PRODUCTION)
          .setOrderId(widget.orderId)
          .setPaymentSessionId(widget.paymentSessionId)
          .build();

      final theme = CFThemeBuilder()
          .setNavigationBarBackgroundColorColor("#1565C0")
          .setPrimaryFont("Roboto")
          .setSecondaryFont("Roboto")
          .build();

      final paymentComponent = CFPaymentComponentBuilder()
          .setComponents(<CFPaymentModes>[
            CFPaymentModes.UPI,
            CFPaymentModes.CARD,
            CFPaymentModes.WALLET,
            CFPaymentModes.NETBANKING,
          ])
          .build();

      final dropPayment = CFDropCheckoutPaymentBuilder()
          .setSession(session)
          .setPaymentComponent(paymentComponent)
          .setTheme(theme)
          .build();

      _cfService.doPayment(dropPayment);
    } on CFException catch (e) {
      if (mounted) {
        setState(() {
          _processing = false;
          _errorMsg = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _processing = false;
          _errorMsg = 'Failed to start payment: $e';
        });
      }
    }
  }

  void _onPaymentVerify(String orderId) {
    if (!mounted) return;
    _verifyWithBackend();
  }

  void _onPaymentError(CFErrorResponse errorResponse, String orderId) {
    if (!mounted) return;
    final msg = errorResponse.getMessage() ?? 'Payment failed';
    if (msg.toLowerCase().contains('cancel')) {
      Navigator.pop(context, {'success': false, 'status': 'CANCELLED'});
      return;
    }
    setState(() {
      _processing = false;
      _errorMsg = msg;
    });
  }

  Future<void> _verifyWithBackend() async {
    if (_verifying || _done) return;
    setState(() {
      _processing = false;
      _verifying = true;
    });

    try {
      // Record location for audit trail
      final location = await LocationService.instance.getLocationData();

      final res = await ApiService.post('/payments/verify', {
        'order_id': widget.orderId,
        'payment_id': widget.paymentId,
        if (location != null) 'location': location,
      });

      if (!mounted) return;

      final payStatus = res['data']?['payment_status'];
      final success = res['success'] == true;
      final alreadyVerified = res['message'] == 'Already verified';

      if ((success && (payStatus == 'success' || payStatus == 'paid')) || alreadyVerified) {
        setState(() => _done = true);
        // Show celebration overlay
        CelebrationOverlay.showPaymentSuccess(context);
        _showResultAndPop(
          success: true,
          title: 'Payment Successful!',
          message: 'Your installment has been recorded. Thank you!',
        );
      } else if (payStatus == 'failed') {
        setState(() => _done = true);
        _showResultAndPop(
          success: false,
          title: 'Payment Failed',
          message: 'Your payment could not be processed. Please try again.',
        );
      } else {
        setState(() {
          _verifying = false;
          _errorMsg = 'Payment is still pending. Please try again.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _errorMsg = 'Could not verify payment. Please try again.';
      });
    }
  }

  void _showResultAndPop({required bool success, required String title, required String message}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(
            success ? Icons.check_circle_rounded : Icons.cancel_rounded,
            size: 72,
            color: success ? Colors.green : Colors.red,
          ),
          const SizedBox(height: 16),
          Text(title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(message,
              style: const TextStyle(color: Colors.black54),
              textAlign: TextAlign.center),
        ]),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pop({
                  'success': success,
                  'status': success ? 'SUCCESS' : 'FAILED',
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Done'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Secure Payment'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            if (_done) {
              Navigator.pop(context, {'success': true, 'status': 'SUCCESS'});
              return;
            }
            Navigator.pop(context, {'success': false, 'status': 'CANCELLED'});
          },
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_verifying) ...[
                const CircularProgressIndicator(color: AppTheme.primaryColor),
                const SizedBox(height: 24),
                const Text('Verifying payment...', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                const Text('Please wait while we confirm your payment.',
                    style: TextStyle(color: Colors.black54), textAlign: TextAlign.center),
              ] else if (_processing) ...[
                const CircularProgressIndicator(color: AppTheme.primaryColor),
                const SizedBox(height: 24),
                const Text('Opening payment...', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ] else if (_errorMsg != null) ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.red.withAlpha(26),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.error_outline, size: 56, color: Colors.red),
                ),
                const SizedBox(height: 24),
                Text(_errorMsg!, style: const TextStyle(fontSize: 16, color: Colors.red), textAlign: TextAlign.center),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _processing = true;
                        _errorMsg = null;
                      });
                      _startPayment();
                    },
                    icon: const Icon(Icons.refresh, size: 20),
                    label: const Text('Try Again'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, {'success': false, 'status': 'FAILED'}),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Go Back'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
