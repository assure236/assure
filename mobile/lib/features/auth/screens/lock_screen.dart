import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../widgets/otp_input_row.dart';

/// Lock screen for returning users — biometric first, OTP fallback.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  String _maskedMobile = '';
  String _mobile = '';
  bool _isLoading = false;
  final LocalAuthentication _localAuth = LocalAuthentication();
  bool _biometricsAvailable = false;
  bool _showOtpFallback = false;
  String _otp = '';
  bool _otpSent = false;

  @override
  void initState() {
    super.initState();
    _loadMobile();
    _checkBiometrics();
  }

  Future<void> _loadMobile() async {
    final prefs = await SharedPreferences.getInstance();
    final mobile = prefs.getString('mobile') ?? '';
    if (mobile.length == 10) {
      setState(() {
        _mobile = mobile;
        _maskedMobile = '+91 XXXXXX${mobile.substring(6)}';
      });
    }
  }

  Future<void> _checkBiometrics() async {
    final auth = context.read<AuthProvider>();

    // OTP is required only after 48h of no app usage.
    final prefs = await SharedPreferences.getInstance();
    final lastActivityMs = prefs.getInt('last_activity_at') ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    final reauthMs = 2 * 24 * 60 * 60 * 1000;
    final otpRequiredByInactivity =
        lastActivityMs > 0 && (now - lastActivityMs) >= reauthMs;
    final otpRequiredBySession = auth.otpRequiredForUnlock;
    final otpRequired = otpRequiredByInactivity || otpRequiredBySession;

    if (otpRequired) {
      // Long idle re-auth requires OTP.
      if (mounted) {
        setState(() {
          _biometricsAvailable = false;
          _showOtpFallback = true;
        });
      }
      return;
    }

    // For normal inactivity locks, use biometrics only.
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isSupported = await _localAuth.isDeviceSupported();
      if (mounted) {
        setState(() => _biometricsAvailable = canCheck || isSupported);
        if (_biometricsAvailable) {
          _authenticateWithBiometrics();
        } else {
          setState(() => _showOtpFallback = true);
        }
      }
    } catch (e) {
      debugPrint('Biometric check error: \$e');
      if (mounted) setState(() => _showOtpFallback = true);
    }
  }

  Future<void> _authenticateWithBiometrics() async {
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Unlock Assure Chit Funds',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
          useErrorDialogs: true,
          sensitiveTransaction: false,
        ),
      );
      if (authenticated && mounted) {
        setState(() => _isLoading = true);
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('token');
        if (!mounted) return;

        if (token != null) {
          final auth = context.read<AuthProvider>();
          try {
            await auth.refreshProfile();
            if (auth.user != null && mounted) {
              auth.authenticateFromBiometric();
              context.go('/dashboard');
              return;
            }
          } catch (_) {}
        }

        if (mounted) {
          setState(() {
            _isLoading = false;
            _showOtpFallback = true;
          });
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Session expired. Please verify with OTP.'),
            behavior: SnackBarBehavior.floating,
          ));
        }
      }
    } catch (e) {
      debugPrint('Biometric auth error: $e');
      if (mounted) setState(() => _showOtpFallback = true);
    }
  }

  Future<void> _sendOtp() async {
    if (_mobile.isEmpty) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().sendPhoneOtp(_mobile);
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (res['success'] == true) {
      setState(() => _otpSent = true);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('OTP sent to $_maskedMobile'),
        backgroundColor: AppTheme.successColor,
        behavior: SnackBarBehavior.floating,
      ));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(res['message'] ?? 'Failed to send OTP'),
        backgroundColor: AppTheme.errorColor,
        behavior: SnackBarBehavior.floating,
      ));
    }
  }

  Future<void> _verifyOtp() async {
    if (_otp.length != 6) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().loginWithOtp(
          mobile: _mobile,
          otp: _otp,
        );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (res['success'] == true) {
      // Save OTP auth timestamp for audit/visibility.
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('last_otp_auth_time', DateTime.now().millisecondsSinceEpoch);
      if (!mounted) return;
      context.go('/dashboard');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(res['message'] ?? 'Invalid OTP'),
        backgroundColor: AppTheme.errorColor,
        behavior: SnackBarBehavior.floating,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          TextButton.icon(
            onPressed: () async {
              await context.read<AuthProvider>().logout();
              if (context.mounted) context.go('/login');
            },
            icon: Icon(Icons.swap_horiz, size: 18, color: AppTheme.primaryColor),
            label: Text(
              'Switch User',
              style: TextStyle(color: AppTheme.primaryColor, fontSize: 13),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: AppTheme.primaryColor.withAlpha(40),
                        blurRadius: 12,
                        offset: const Offset(0, 3)),
                  ],
                ),
                child: ClipOval(
                  child: Image.asset(
                    'assets/images/logo.png',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Welcome Back!',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                _maskedMobile.isEmpty
                    ? 'Authenticate to continue'
                    : _maskedMobile,
                style: const TextStyle(fontSize: 14, color: Colors.black54),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),

              if (_isLoading)
                const Center(child: CircularProgressIndicator())
              else if (_showOtpFallback) ...[
                if (!_otpSent) ...[
                  const Text(
                    'Verify your identity with OTP',
                    style: TextStyle(fontSize: 14, color: Colors.black54),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton.icon(
                      onPressed: _sendOtp,
                      icon: const Icon(Icons.sms_outlined),
                      label: const Text('Send OTP',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ] else ...[
                  Text(
                    'Enter the 6-digit OTP sent to $_maskedMobile',
                    style: const TextStyle(fontSize: 14, color: Colors.black54),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  OtpInputRow(
                    key: const ValueKey('lock_otp'),
                    onCompleted: (v) {
                      setState(() => _otp = v);
                      if (v.length == 6) _verifyOtp();
                    },
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _sendOtp,
                    child: const Text('Resend OTP'),
                  ),
                ],
              ] else ...[
                const Text(
                  'Use biometrics to unlock',
                  style: TextStyle(fontSize: 14, color: Colors.black54),
                ),
              ],

              if (_biometricsAvailable && !_isLoading) ...[
                const SizedBox(height: 32),
                GestureDetector(
                  onTap: _authenticateWithBiometrics,
                  child: Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor.withAlpha(26),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.fingerprint_rounded,
                          size: 32,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Tap to use biometrics',
                        style: TextStyle(fontSize: 12, color: AppTheme.primaryColor),
                      ),
                    ],
                  ),
                ),
              ],

              if (!_showOtpFallback && !_isLoading) ...[
                const SizedBox(height: 24),
                TextButton(
                  onPressed: () => setState(() => _showOtpFallback = true),
                  child: const Text('Use OTP instead'),
                ),
              ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
