import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../widgets/pin_input_row.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

// Step 0 = enter phone, Step 1 = verify OTP, Step 2 = enter MPIN
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

  // Step 1 → verify OTP
  Future<void> _verifyOtp() async {
    if (_otp.length != 6) return _showError('Enter the 6-digit OTP');
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().verifyPhoneOtp(_mobile, _otp);
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (res['success'] == true) {
      setState(() { _step = 2; _otp = ''; });
    } else {
      _showError(res['message'] ?? 'Invalid OTP');
    }
  }

  // Step 2 → login with MPIN
  Future<void> _loginWithMpin(String mpin) async {
    if (mpin.length != 6) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().loginWithPhoneAndMpin(
          mobile: _mobile,
          mpin: mpin,
        );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (res['success'] == true) {
      context.go('/dashboard');
    } else {
      _showError(res['message'] ?? 'Invalid MPIN');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () {
            if (_step > 0) {
              setState(() { _step--; _otp = ''; });
            } else {
              context.go('/welcome');
            }
          },
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: _step == 0
              ? _buildPhoneStep()
              : _step == 1
                  ? _buildOtpStep()
                  : _buildMpinStep(),
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

  // ── Step 2: Enter MPIN ──────────────────────────────────────────────────────
  Widget _buildMpinStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Enter MPIN', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        const Text('Enter your 6-digit MPIN to login',
            style: TextStyle(fontSize: 14, color: Colors.black54)),
        const SizedBox(height: 40),

        PinInputRow(
          key: const ValueKey('login_mpin'),
          onCompleted: _loginWithMpin,
        ),
        const SizedBox(height: 16),

        if (_isLoading)
          const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}
