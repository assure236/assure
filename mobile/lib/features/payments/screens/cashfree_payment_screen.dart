import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

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
      ..enableZoom(false)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            setState(() => _isLoading = true);
            // Check if this is a return URL while loading
            if (_isReturnUrl(url)) {
              _handleReturn();
            }
          },
          onPageFinished: (url) {
            setState(() => _isLoading = false);
            // Also check on finish in case redirect happened
            if (_isReturnUrl(url)) {
              _handleReturn();
            }
          },
          onWebResourceError: (error) {
            debugPrint('WebView error: ${error.description} (${error.errorCode})');
          },
          onNavigationRequest: (req) {
            final url = req.url;
            // Allow UPI intent URLs to be handled by external apps
            if (url.startsWith('upi://') ||
                url.startsWith('intent://') ||
                url.startsWith('phonepe://') ||
                url.startsWith('gpay://') ||
                url.startsWith('paytmmp://') ||
                url.startsWith('credpay://') ||
                url.startsWith('whatsapp://')) {
              launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)
                  .catchError((_) {});
              return NavigationDecision.prevent;
            }
            // Intercept Cashfree return URL pattern
            if (_isReturnUrl(url)) {
              _handleReturn();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      );

    // Enable third-party cookies on Android (required by Cashfree)
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      platform.setOnShowFileSelector((_) async => []);
    }
    final cookieManager = WebViewCookieManager();
    if (cookieManager.platform is AndroidWebViewCookieManager) {
      (cookieManager.platform as AndroidWebViewCookieManager)
          .setAcceptThirdPartyCookies(platform as AndroidWebViewController, true);
    }

    // Load payment URL after cookies are configured
    _controller.loadRequest(Uri.parse(widget.paymentUrl));
  }

  bool _isReturnUrl(String url) {
    // Intercept our checkout-return URL or Cashfree success/failure pages
    return url.contains('/checkout-return') ||
        url.contains('order_id=${widget.orderId}') ||
        url.contains('assure.fund/payments') ||
        url.contains('assurechitfunds://payment-return') ||
        url.contains('/order/pay/status') ||
        url.contains('cashfree.com/pg/orders');
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
              color: Colors.white.withAlpha(217),
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
