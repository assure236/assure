import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/active_member_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';

class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  static const _channel = MethodChannel('com.assure.chitfunds/qr_scanner');
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startScan());
  }

  Future<void> _startScan() async {
    if (_isProcessing) return;
    try {
      final raw = await _channel.invokeMethod<String>('scanQR');
      if (raw == null || !mounted) {
        if (mounted) Navigator.of(context).pop();
        return;
      }
      if (!raw.startsWith('assure://qr-login?session=')) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Invalid QR code. Please scan the Assure web portal QR.'),
              backgroundColor: AppTheme.errorColor,
            ),
          );
          Navigator.of(context).pop();
        }
        return;
      }

      final uri = Uri.parse(raw.replaceFirst('assure://', 'https://'));
      final sessionId = uri.queryParameters['session'];
      if (sessionId == null || sessionId.isEmpty) {
        if (mounted) Navigator.of(context).pop();
        return;
      }

      setState(() => _isProcessing = true);
      if (mounted) _showConfirmDialog(sessionId);
    } on PlatformException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Scan error: ${e.message}'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
        Navigator.of(context).pop();
      }
    }
  }

  void _showConfirmDialog(String sessionId) {
    final auth = context.read<AuthProvider>();
    final activeMemberId = context.read<ActiveMemberProvider>().activeMemberId;
    final loginLabel = (activeMemberId != null && activeMemberId.isNotEmpty)
        ? 'family member $activeMemberId'
        : (auth.user?.fullName ?? 'your account');

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        icon: const Icon(Icons.computer, color: AppTheme.primaryColor, size: 52),
        title: const Text('Login to Web Portal?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'You are about to log in to the Assure Chit Funds web portal as '
              '$loginLabel — the same account currently selected on your home screen.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Colors.black54),
            ),
            SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.shield, color: AppTheme.successColor, size: 16),
                SizedBox(width: 4),
                Text('Secure login via QR code',
                    style: TextStyle(fontSize: 12, color: AppTheme.successColor)),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop();
            },
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              Navigator.of(context).pop();
              final auth = context.read<AuthProvider>();
              final res = await auth.confirmQrLogin(sessionId);
              if (!mounted) return;
              _showResult(res['success'] == true, res['message'] ?? 'Unknown error');
            },
            icon: const Icon(Icons.check_circle, size: 18),
            label: const Text('Confirm Login'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ],
      ),
    );
  }

  void _showResult(bool success, String message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        icon: Icon(
          success ? Icons.check_circle_outline : Icons.error_outline,
          color: success ? AppTheme.successColor : AppTheme.errorColor,
          size: 52,
        ),
        title: Text(success ? 'Web Login Confirmed' : 'Login Failed'),
        content: Text(
          success
              ? 'Your web browser is now logged in. You can switch back to the browser.'
              : message,
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              if (success) {
                Navigator.of(context).pop();
              } else {
                setState(() => _isProcessing = false);
                _startScan();
              }
            },
            child: Text(success ? 'Done' : 'Try Again'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan Web QR Code'),
      ),
      body: Center(
        child: _isProcessing
            ? const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Colors.white),
                  SizedBox(height: 16),
                  Text('Confirming login...',
                      style: TextStyle(color: Colors.white, fontSize: 16)),
                ],
              )
            : const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_scanner, color: Colors.white54, size: 80),
                  SizedBox(height: 16),
                  Text('Opening scanner...',
                      style: TextStyle(color: Colors.white54, fontSize: 16)),
                ],
              ),
      ),
    );
  }
}
