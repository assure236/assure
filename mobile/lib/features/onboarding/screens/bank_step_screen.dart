import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

class BankStepScreen extends StatefulWidget {
  const BankStepScreen({super.key});
  @override
  State<BankStepScreen> createState() => _BankStepScreenState();
}

class _BankStepScreenState extends State<BankStepScreen> {
  final _acc = TextEditingController();
  final _confirm = TextEditingController();
  final _ifsc = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _holder;

  Future<void> _submit() async {
    setState(() { _error = null; _holder = null; });
    if (_acc.text != _confirm.text) { setState(() => _error = 'Account numbers do not match.'); return; }
    final ifsc = _ifsc.text.toUpperCase().trim();
    final ifscRe = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');
    if (!ifscRe.hasMatch(ifsc)) { setState(() => _error = 'Invalid IFSC. Format: ABCD0123456'); return; }

    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.saveBank(accountNumber: _acc.text, ifsc: ifsc);
      if (res['success'] == true) {
        setState(() => _holder = res['account_holder_name']?.toString());
        await Future.delayed(const Duration(milliseconds: 900));
        if (mounted) context.go('/onboarding/cheque');
      } else {
        setState(() => _error = res['message']?.toString() ?? 'Verification failed.');
      }
    } catch (e) {
      setState(() => _error = 'Failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 2,
      title: 'Add your bank account',
      subtitle: 'Prize money is paid here. Account holder name must match your KYC name.',
      loading: _busy,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        TextField(controller: _acc, decoration: const InputDecoration(labelText: 'Account Number'), keyboardType: TextInputType.number),
        const SizedBox(height: 10),
        TextField(controller: _confirm, decoration: const InputDecoration(labelText: 'Re-enter Account Number'), keyboardType: TextInputType.number),
        const SizedBox(height: 10),
        TextField(controller: _ifsc, decoration: const InputDecoration(labelText: 'IFSC Code', hintText: 'ABCD0123456'), textCapitalization: TextCapitalization.characters, maxLength: 11),
        if (_holder != null) Padding(padding: const EdgeInsets.only(top: 10), child: Card(color: const Color(0xFFD1FAE5), child: Padding(padding: const EdgeInsets.all(10), child: Text('Verified: $_holder')))),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: Colors.red))),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _busy ? null : _submit,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Verify & Continue')),
        ),
      ]),
    );
  }
}
