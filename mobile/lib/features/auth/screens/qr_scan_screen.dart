import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/active_member_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';

class QrScanScreen extends StatefulWidget {
  /// When opened via deep link `assurechitfunds://qr-login?session=...`
  final String? initialSessionId;

  const QrScanScreen({super.key, this.initialSessionId});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  static const _channel = MethodChannel('com.assure.chitfunds/qr_scanner');
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final preset = widget.initialSessionId?.trim();
      if (preset != null && preset.isNotEmpty) {
        setState(() => _isProcessing = true);
        _showConfirmDialog(preset);
      } else {
        _startScan();
      }
    });
  }

  String? _parseSessionId(String raw) {
    final value = raw.trim();
    // Support both legacy assure:// and registered assurechitfunds:// schemes.
    final patterns = [
      RegExp(r'^(?:assurechitfunds|assure)://qr-login\?session=([^&\s]+)', caseSensitive: false),
      RegExp(r'[?&]session=([^&\s]+)', caseSensitive: false),
    ];
    for (final re in patterns) {
      final m = re.firstMatch(value);
      if (m != null && (m.group(1)?.isNotEmpty ?? false)) {
        return Uri.decodeComponent(m.group(1)!);
      }
    }
    try {
      final normalized = value
          .replaceFirst('assurechitfunds://', 'https://')
          .replaceFirst('assure://', 'https://');
      final uri = Uri.parse(normalized);
      final session = uri.queryParameters['session'];
      if (session != null && session.isNotEmpty) return session;
    } catch (_) {}
    return null;
  }

  Future<void> _startScan() async {
    if (_isProcessing) return;
    final auth = context.read<AuthProvider>();
    auth.beginExternalActivity();
    try {
      final raw = await _channel.invokeMethod<String>('scanQR');
      auth.endExternalActivity();
      if (raw == null || !mounted) {
        if (mounted) Navigator.of(context).pop();
        return;
      }
      final sessionId = _parseSessionId(raw);
      if (sessionId == null) {
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

      setState(() => _isProcessing = true);
      if (mounted) _showConfirmDialog(sessionId);
    } on PlatformException catch (e) {
      auth.endExternalActivity();
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
              'This will log in the website on your computer as '
              '$loginLabel.\n\n'
              'Your phone stays on the same account — only the browser logs in.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Colors.black54),
            ),
            const SizedBox(height: 12),
            const Row(
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
              if (context.canPop()) {
                Navigator.of(context).pop();
              } else {
                context.go('/dashboard');
              }
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
            label: const Text('Confirm Web Login'),
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
        title: Text(success ? 'Website Login Confirmed' : 'Login Failed'),
        content: Text(
          success
              ? 'Switch back to your computer browser — it should now be logged in. Your phone is unchanged.'
              : message,
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              if (success) {
                if (context.canPop()) {
                  Navigator.of(context).pop();
                } else {
                  context.go('/dashboard');
                }
              } else {
                setState(() => _isProcessing = false);
                if (widget.initialSessionId != null) {
                  context.go('/dashboard');
                } else {
                  _startScan();
                }
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
                  Text('Confirming website login...',
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
