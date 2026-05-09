import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../widgets/pin_input_row.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

// Step 0 = enter phone, Step 1 = verify OTP (logs in directly)
class _LoginScreenState extends State<LoginScreen> {
  int _step = 0;
  final _phoneCtrl = TextEditingController();
  String _mobile = '';
  String _otp = '';
  bool _isLoading = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppTheme.errorColor,
      behavior: SnackBarBehavior.floating,
    ));
  }

  void _showSuccess(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.green,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 10),
    ));
  }

  // Step 0 → send OTP
  Future<void> _sendOtp() async {
    final mobile = _phoneCtrl.text.trim();
    if (mobile.length != 10) return _showError('Enter a valid 10-digit mobile number');
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().sendPhoneOtp(mobile);
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (res['success'] == true) {
      _mobile = mobile;
      _showSuccess('OTP sent to +91 $mobile');
      setState(() => _step = 1);
    } else {
      _showError(res['message'] ?? 'Failed to send OTP');
    }
  }

  // Step 1 → verify OTP & login directly
  Future<void> _verifyOtp() async {
    if (_otp.length != 6) return _showError('Enter the 6-digit OTP');
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().loginWithOtp(
          mobile: _mobile,
          otp: _otp,
        );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (res['success'] == true) {
      // Save OTP auth timestamp for 2-day cycle
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('last_otp_auth_time', DateTime.now().millisecondsSinceEpoch);
      context.go('/dashboard');
    } else {
      _showError(res['message'] ?? 'Invalid OTP');
    }
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryColor, // navy
              AppTheme.accentBlue, // deep blue
            ],
          ),
        ),
        child: Stack(
          children: [
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Center(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                          // Logo
                          Container(
                            width: 100,
                            height: 100,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                    color: Colors.black26,
                                    blurRadius: 16,
                                    offset: Offset(0, 4)),
                              ],
                            ),
                            child: ClipOval(
                              child: Image.asset(
                                'assets/images/logo.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          // Card form
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withAlpha(25),
                                  blurRadius: 20,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: _step == 0
                                ? _buildPhoneStep()
                                : _buildOtpStep(),
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Step 0: Enter phone number ──────────────────────────────────────────────
  Widget _buildPhoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Welcome Back',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        const Text('Enter your registered mobile number',
            style: TextStyle(fontSize: 14, color: Colors.black54)),
        const SizedBox(height: 40),

        TextFormField(
          controller: _phoneCtrl,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _isLoading ? null : _sendOtp(),
          decoration: InputDecoration(
            labelText: 'Mobile Number',
            prefixText: '+91  ',
            prefixIcon: const Icon(Icons.phone_outlined, size: 20, color: Colors.black45),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: Colors.grey.shade50,
            counterText: '',
          ),
        ),
        const SizedBox(height: 32),

        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton(
            onPressed: _isLoading ? null : _sendOtp,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _isLoading
                ? const SizedBox(width: 22, height: 22,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : const Text('Send OTP', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 20),

        Center(
          child: GestureDetector(
            onTap: () => context.go('/register'),
            child: RichText(
              text: const TextSpan(
                text: "Don't have an account? ",
                style: TextStyle(color: Colors.black54, fontSize: 14),
                children: [
                  TextSpan(
                    text: 'Register',
                    style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Step 1: Enter OTP ───────────────────────────────────────────────────────
  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Verify OTP', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Enter the 6-digit OTP sent to +91 $_mobile',
            style: const TextStyle(fontSize: 14, color: Colors.black54)),
        const SizedBox(height: 40),

        PinInputRow(
          key: const ValueKey('login_otp'),
          onCompleted: (v) => setState(() => _otp = v),
        ),
        const SizedBox(height: 32),

        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton(
            onPressed: _isLoading ? null : _verifyOtp,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _isLoading
                ? const SizedBox(width: 22, height: 22,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : const Text('Verify OTP', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 16),

        Center(
          child: TextButton(
            onPressed: _isLoading ? null : _sendOtp,
            child: const Text('Resend OTP'),
          ),
        ),
      ],
    );
  }
}
