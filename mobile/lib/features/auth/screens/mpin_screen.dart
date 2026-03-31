import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../widgets/pin_input_row.dart';

/// Shown to returning users who have previously logged in on this device.
/// Skips phone + OTP — just asks for MPIN directly.
class MpinScreen extends StatefulWidget {
  const MpinScreen({super.key});

  @override
  State<MpinScreen> createState() => _MpinScreenState();
}

class _MpinScreenState extends State<MpinScreen> {
  String _maskedMobile = '';
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadMobile();
  }

  Future<void> _loadMobile() async {
    final prefs = await SharedPreferences.getInstance();
    final mobile = prefs.getString('mobile') ?? '';
    if (mobile.length == 10) {
      setState(() => _maskedMobile = '+91 XXXXXX${mobile.substring(6)}');
    }
  }

  Future<void> _login(String mpin) async {
    if (mpin.length != 6) return;

    if (!mounted) return;
    setState(() => _isLoading = true);
    final res = await context.read<AuthProvider>().loginWithMpin(mpin);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      context.go('/dashboard');
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['message'] ?? 'Incorrect MPIN'),
          backgroundColor: AppTheme.errorColor,
          behavior: SnackBarBehavior.floating,
        ));
      }
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
          TextButton(
            onPressed: () => context.go('/login'),
            child: Text(
              'Login differently',
              style: TextStyle(color: AppTheme.primaryColor, fontSize: 13),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 32),
              // Logo
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withAlpha(26),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.account_balance_rounded,
                  size: 36,
                  color: AppTheme.primaryColor,
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
                    ? 'Enter your MPIN to continue'
                    : 'Enter MPIN for $_maskedMobile',
                style: const TextStyle(fontSize: 14, color: Colors.black54),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              // PIN input with numpad
              PinInputRow(
                onCompleted: (v) {
                  if (v.length == 6) _login(v);
                },
              ),
              if (_isLoading) ...[
                const SizedBox(height: 20),
                const CircularProgressIndicator(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
