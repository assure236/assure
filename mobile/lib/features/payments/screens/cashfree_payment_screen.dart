import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class CashfreePaymentScreen extends StatefulWidget {
  final String paymentUrl;
  final String orderId;
  final String paymentId;

  const CashfreePaymentScreen({
    super.key,
    required this.paymentUrl,
    required this.orderId,
    required this.paymentId,
  });

  @override
  State<CashfreePaymentScreen> createState() => _CashfreePaymentScreenState();
}

class _CashfreePaymentScreenState extends State<CashfreePaymentScreen>
    with WidgetsBindingObserver {
  bool _launched = false;
  bool _verifying = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _openPaymentPage();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// When the app comes back to foreground after browser payment, auto-verify
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _launched && !_verifying && !_done) {
      _verifyPayment();
    }
  }

  Future<void> _openPaymentPage() async {
    final uri = Uri.parse(widget.paymentUrl);
    try {
      // Open in Chrome Custom Tab (in-app browser) — not a WebView
      final ok = await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
      if (!ok) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      setState(() => _launched = true);
    } catch (_) {
      try {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        setState(() => _launched = true);
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open payment page'), backgroundColor: Colors.red),
          );
          Navigator.pop(context, {'success': false, 'status': 'FAILED'});
        }
      }
    }
  }

  Future<void> _verifyPayment() async {
    if (_verifying || _done) return;
    setState(() => _verifying = true);

    try {
      final res = await ApiService.post('/payments/verify', {
        'order_id': widget.orderId,
        'payment_id': widget.paymentId,
      });

      if (!mounted) return;

      final payStatus = res['data']?['payment_status'];
      final success = res['success'] == true;
      final alreadyVerified = res['message'] == 'Already verified';

      if ((success && (payStatus == 'success' || payStatus == 'paid')) || alreadyVerified) {
        setState(() => _done = true);
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
        // Still pending — user might not have completed payment yet
        setState(() => _verifying = false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _verifying = false);
    }
  }

  void _showResultAndPop({required bool? success, required String title, required String message}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(
            success == true
                ? Icons.check_circle_rounded
                : success == false
                    ? Icons.cancel_rounded
                    : Icons.info_rounded,
            size: 72,
            color: success == true
                ? Colors.green
                : success == false
                    ? Colors.red
                    : Colors.orange,
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
                  'status': success == true ? 'SUCCESS' : success == false ? 'FAILED' : 'PENDING',
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
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Cancel Payment?'),
                content: const Text('Are you sure you want to cancel this payment?'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('No')),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      Navigator.pop(context, {'success': false, 'status': 'CANCELLED'});
                    },
                    child: const Text('Yes, Cancel', style: TextStyle(color: Colors.red)),
                  ),
                ],
              ),
            );
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
              ] else ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(26),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.open_in_browser, size: 56, color: AppTheme.primaryColor),
                ),
                const SizedBox(height: 24),
                const Text('Complete Payment',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text(
                  'A secure payment page has been opened.\nComplete your payment there, then return here.',
                  style: TextStyle(color: Colors.black54, fontSize: 14),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _openPaymentPage,
                    icon: const Icon(Icons.payment, size: 20),
                    label: const Text('Open Payment Page Again'),
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
                  child: OutlinedButton.icon(
                    onPressed: _verifyPayment,
                    icon: const Icon(Icons.verified_outlined, size: 20),
                    label: const Text("I've Completed Payment"),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
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
