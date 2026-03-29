import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

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

class _CashfreePaymentScreenState extends State<CashfreePaymentScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _isLoading = true),
          onPageFinished: (_) => setState(() => _isLoading = false),
          onNavigationRequest: (req) {
            // Intercept Cashfree return URL pattern
            final url = req.url;
            if (_isReturnUrl(url)) {
              _handleReturn();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.paymentUrl));
  }

  bool _isReturnUrl(String url) {
    // Intercept our return URL patterns
    return url.contains('order_id=${widget.orderId}') ||
        url.contains('localhost:3000/payments') ||
        url.contains('assurechitfunds://payment-return');
  }

  Future<void> _handleReturn() async {
    if (_verifying) return;
    setState(() => _verifying = true);
    await _verifyPayment();
  }

  Future<void> _verifyPayment() async {
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
        _showResultAndPop(
          success: true,
          title: 'Payment Successful!',
          message: 'Your installment has been recorded. Thank you!',
        );
      } else if (payStatus == 'failed') {
        _showResultAndPop(
          success: false,
          title: 'Payment Failed',
          message: 'Your payment could not be processed. Please try again.',
        );
      } else {
        _showResultAndPop(
          success: null,
          title: 'Payment Pending',
          message: 'Payment status: ${payStatus ?? 'Pending'}. We will update you once confirmed.',
        );
      }
    } catch (e) {
      if (!mounted) return;
      _showResultAndPop(
        success: null,
        title: 'Verification Pending',
        message: 'Could not verify payment automatically. Check your payment history.',
      );
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
                // Return result to caller
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
        actions: [
          if (_verifying)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.verified_outlined),
              tooltip: 'Verify Payment',
              onPressed: _handleReturn,
            ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading || _verifying)
            Container(
              color: Colors.white.withOpacity(0.85),
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const CircularProgressIndicator(color: AppTheme.primaryColor),
                  const SizedBox(height: 16),
                  Text(
                    _verifying ? 'Verifying payment...' : 'Loading payment page...',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}
