import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../widgets/otp_input_row.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _step = 0;
  bool _isLoading = false;

  // Step 0
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  // Step 1
  String _phoneOtp = '';

  // Step 2
  final _emailController = TextEditingController();
  String _emailOtp = '';
  bool _emailOtpSent = false;

  // Verified data
  String _mobile = '';
  String _email = '';

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppTheme.errorColor,
      behavior: SnackBarBehavior.floating,
    ));
  }

  void _showSuccess(String msg, {Duration duration = const Duration(seconds: 3)}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.green,
      behavior: SnackBarBehavior.floating,
      duration: duration,
    ));
  }

  Future<void> _sendPhoneOtp() async {
    final name = _nameController.text.trim();
    final mobile = _phoneController.text.trim();
    if (name.isEmpty) return _showError('Please enter your full name');
    if (mobile.length != 10) return _showError('Enter a valid 10-digit mobile number');

    if (!mounted) return;
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

  Future<void> _verifyPhoneOtp() async {
    if (_phoneOtp.length != 6) return _showError('Enter the 6-digit OTP');

    if (!mounted) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().verifyPhoneOtp(_mobile, _phoneOtp);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      setState(() { _step = 2; _phoneOtp = ''; });
    } else {
      _showError(res['message'] ?? 'Invalid OTP');
    }
  }

  Future<void> _sendEmailOtp() async {
    final email = _emailController.text.trim();
    if (!RegExp(r'^[\w.+-]+@[\w-]+\.[a-z]{2,}$').hasMatch(email)) {
      return _showError('Enter a valid email address');
    }
    if (!mounted) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().sendEmailOtp(email);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      _email = email;
      _showSuccess('OTP sent to $email');
      setState(() => _emailOtpSent = true);
    } else {
      _showError(res['message'] ?? 'Failed to send email OTP');
    }
  }

  Future<void> _verifyEmailOtp() async {
    if (_emailOtp.length != 6) return _showError('Enter the 6-digit email OTP');

    if (!mounted) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().verifyEmailOtp(_email, _emailOtp);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      // Email verified — register directly (auto-generate MPIN for backend)
      _registerAccount();
    } else {
      _showError(res['message'] ?? 'Invalid email OTP');
    }
  }

  Future<void> _registerAccount() async {
    // Generate a random 6-digit value for backend compatibility
    final autoPin = (Random().nextInt(900000) + 100000).toString();

    if (!mounted) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().register(
      mobile: _mobile,
      email: _email,
      mpin: autoPin,
      fullName: _nameController.text.trim(),
    );
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      context.go('/dashboard');
    } else {
      _showError(res['message'] ?? 'Registration failed');
    }
  }

  // ─── Step UIs ─────────────────────────────────────────────────────────────

  Widget _buildStep0() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('Create Account',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      const Text('Enter your details to get started',
          style: TextStyle(fontSize: 14, color: Colors.black54)),
      const SizedBox(height: 36),
      TextField(
        controller: _nameController,
        textCapitalization: TextCapitalization.words,
        decoration: _decoration('Full Name', Icons.person_outline),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        maxLength: 10,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: _decoration('Mobile Number', Icons.phone_outlined, prefix: '+91 '),
      ),
      const SizedBox(height: 28),
      _primaryBtn('Send OTP', _sendPhoneOtp),
      const SizedBox(height: 20),
      _loginLink(),
    ],
  );

  Widget _buildStep1() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('Verify Mobile',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      Text('We sent a 6-digit OTP to +91 $_mobile',
          style: const TextStyle(fontSize: 14, color: Colors.black54)),
      const SizedBox(height: 40),
      OtpInputRow(key: const ValueKey('phone_otp'), onCompleted: (v) => setState(() => _phoneOtp = v)),
      const SizedBox(height: 36),
      _primaryBtn('Verify OTP', _verifyPhoneOtp),
      const SizedBox(height: 12),
      Center(
        child: TextButton(
          onPressed: _isLoading ? null : _sendPhoneOtp,
          child: const Text('Resend OTP'),
        ),
      ),
    ],
  );

  Widget _buildStep2() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('Verify Email',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      Text(
        _emailOtpSent
            ? 'Enter the OTP sent to $_email'
            : 'Enter your email to receive a verification code',
        style: const TextStyle(fontSize: 14, color: Colors.black54),
      ),
      const SizedBox(height: 36),
      if (!_emailOtpSent) ...[
        TextField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: _decoration('Email Address', Icons.email_outlined),
        ),
        const SizedBox(height: 28),
        _primaryBtn('Send Email OTP', _sendEmailOtp),
      ] else ...[
        OtpInputRow(key: const ValueKey('email_otp'), onCompleted: (v) => setState(() => _emailOtp = v)),
        const SizedBox(height: 36),
        _primaryBtn('Verify Email OTP', _verifyEmailOtp),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: _isLoading
                ? null
                : () => setState(() { _emailOtpSent = false; _emailOtp = ''; }),
            child: const Text('Change Email'),
          ),
        ),
      ],
    ],
  );

  Widget _buildStep3() => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: 16),
        const Text('Creating your account...',
            style: TextStyle(fontSize: 16, color: Colors.black54)),
      ],
    ),
  );

  // ─── Shared helpers ────────────────────────────────────────────────────────

  Widget _primaryBtn(String label, VoidCallback onTap) => SizedBox(
    width: double.infinity,
    height: 52,
    child: FilledButton(
      onPressed: _isLoading ? null : onTap,
      style: FilledButton.styleFrom(
        backgroundColor: AppTheme.primaryColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: _isLoading
          ? const SizedBox(
              width: 22, height: 22,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
          : Text(label,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
    ),
  );

  Widget _loginLink() => Center(
    child: GestureDetector(
      onTap: () => context.go('/login'),
      child: RichText(
        text: TextSpan(
          text: 'Already have an account? ',
          style: const TextStyle(color: Colors.black54, fontSize: 14),
          children: [
            TextSpan(
              text: 'Login',
              style: TextStyle(
                  color: AppTheme.primaryColor, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    ),
  );

  InputDecoration _decoration(String label, IconData icon, {String? prefix}) =>
      InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 20, color: Colors.black45),
        prefixText: prefix,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
        fillColor: Colors.grey.shade50,
        counterText: '',
      );

  Widget _progressBar() => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: List.generate(3, (i) {
      final active = i <= _step;
      return AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        margin: const EdgeInsets.symmetric(horizontal: 4),
        width: active ? 24 : 8,
        height: 8,
        decoration: BoxDecoration(
          color: active ? AppTheme.primaryColor : Colors.grey.shade300,
          borderRadius: BorderRadius.circular(4),
        ),
      );
    }),
  );

  @override
  Widget build(BuildContext context) {
    final steps = [_buildStep0(), _buildStep1(), _buildStep2(), _buildStep3()];

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: _step > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                onPressed: () {
                  if (_step == 2 && _emailOtpSent) {
                    setState(() => _emailOtpSent = false);
                  } else {
                    setState(() => _step--);
                  }
                },
              )
            : null,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 12),
              // App logo
              Center(
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(15),
                    shape: BoxShape.circle,
                  ),
                  padding: const EdgeInsets.all(8),
                  child: Image.asset('assets/images/logo.png', fit: BoxFit.contain),
                ),
              ),
              const SizedBox(height: 14),
              _progressBar(),
              const SizedBox(height: 20),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 280),
                  transitionBuilder: (child, anim) => SlideTransition(
                    position: Tween<Offset>(
                            begin: const Offset(0.3, 0), end: Offset.zero)
                        .animate(CurvedAnimation(
                            parent: anim, curve: Curves.easeOut)),
                    child: FadeTransition(opacity: anim, child: child),
                  ),
                  child: KeyedSubtree(
                    key: ValueKey('$_step${_emailOtpSent ? 1 : 0}'),
                    child: steps[_step],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
