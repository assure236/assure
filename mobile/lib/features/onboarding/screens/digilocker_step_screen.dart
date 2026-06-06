import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

/// Step 1 – KYC via Cashfree VRS
/// Sub-step A: PAN verification (text only, no photo)
/// Sub-step B: Aadhaar OTP (send OTP → enter OTP → verify)
class DigilockerStepScreen extends StatefulWidget {
  // kept same class name so routing doesn't break
  final String? digilockerStatus;
  const DigilockerStepScreen({super.key, this.digilockerStatus});

  @override
  State<DigilockerStepScreen> createState() => _DigilockerStepScreenState();
}

enum _KycSubStep { pan, aadhaar, otpEntry }

class _DigilockerStepScreenState extends State<DigilockerStepScreen> {
  _KycSubStep _subStep = _KycSubStep.pan;
  bool _busy = false;

  // PAN
  final _panCtrl = TextEditingController();
  bool _panVerified = false;
  String? _panName;

  // Aadhaar OTP
  final _aadhaarCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  bool _otpSent = false;
  String? _refId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncStep());
  }

  Future<void> _syncStep() async {
    try {
      final res = await OnboardingApi.getStatus();
      if (!mounted) return;
      final data = res['data'] as Map<String, dynamic>?;
      if (data == null) return;
      if (data['completed'] == true) { context.go('/onboarding/done'); return; }
      final next = data['next_step']?.toString();
      if (next != null && next != 'digilocker') context.go(onboardingNextRoute(next));
    } catch (_) {}
  }

  @override
  void dispose() {
    _panCtrl.dispose();
    _aadhaarCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700));
  }

  void _showSuccess(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.green.shade700));
  }

  // ── PAN ─────────────────────────────────────────────────────────────────

  Future<void> _verifyPan() async {
    final pan = _panCtrl.text.toUpperCase().trim();
    if (pan.length != 10 || !RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]$').hasMatch(pan)) {
      _showError('Enter a valid PAN (e.g. ABCDE1234F)');
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.verifyPanKyc(pan);
      if (!mounted) return;
      if (res['success'] == true) {
        final name = res['data']?['name']?.toString();
        setState(() { _panVerified = true; _panName = name; });
        _showSuccess(res['message']?.toString() ?? 'PAN verified.');
      } else {
        _showError(res['message']?.toString() ?? 'PAN verification failed.');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ── Aadhaar OTP ─────────────────────────────────────────────────────────

  Future<void> _sendOtp() async {
    final aadhaar = _aadhaarCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (aadhaar.length != 12) {
      _showError('Enter a valid 12-digit Aadhaar number.');
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.sendAadhaarOtp(aadhaar);
      if (!mounted) return;
      if (res['success'] == true) {
        _refId = res['data']?['ref_id']?.toString();
        setState(() { _otpSent = true; _subStep = _KycSubStep.otpEntry; });
        _showSuccess('OTP sent to your Aadhaar-linked mobile number.');
      } else {
        _showError(res['message']?.toString() ?? 'Failed to send OTP.');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text.trim();
    final aadhaar = _aadhaarCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (otp.length != 6) { _showError('Enter the 6-digit OTP.'); return; }
    if (_refId == null) { _showError('Session expired. Resend OTP.'); return; }
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.verifyAadhaarOtp(
        aadhaarNumber: aadhaar,
        refId: _refId!,
        otp: otp,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        _showSuccess('Aadhaar verified! Proceeding to face verification.');
        await Future.delayed(const Duration(milliseconds: 600));
        if (mounted) context.go('/onboarding/face');
      } else {
        _showError(res['message']?.toString() ?? 'OTP verification failed.');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 0,
      title: 'Verify your identity',
      subtitle: 'Enter your PAN and Aadhaar to complete KYC instantly.',
      loading: _busy,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _StepIndicator(current: _subStep == _KycSubStep.pan ? 0 : 1),
        const SizedBox(height: 24),
        if (_subStep == _KycSubStep.pan) _buildPanStep(),
        if (_subStep == _KycSubStep.aadhaar || _subStep == _KycSubStep.otpEntry) _buildAadhaarStep(),
      ]),
    );
  }

  Widget _buildPanStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('Step 1: PAN Verification', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      const SizedBox(height: 6),
      const Text('Enter your PAN card number for real-time verification.', style: TextStyle(fontSize: 13, color: Colors.grey)),
      const SizedBox(height: 16),
      TextField(
        controller: _panCtrl,
        enabled: !_panVerified,
        textCapitalization: TextCapitalization.characters,
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')), LengthLimitingTextInputFormatter(10)],
        decoration: InputDecoration(
          labelText: 'PAN Number',
          hintText: 'ABCDE1234F',
          suffixIcon: _panVerified ? const Icon(Icons.verified, color: Colors.green) : null,
          border: const OutlineInputBorder(),
        ),
        onChanged: (v) => _panCtrl.text = v.toUpperCase(),
      ),
      if (_panName != null) ...[
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.green.shade200)),
          child: Row(children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 18),
            const SizedBox(width: 8),
            Expanded(child: Text('Verified: $_panName', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w500))),
          ]),
        ),
      ],
      const SizedBox(height: 16),
      if (!_panVerified)
        ElevatedButton(
          onPressed: _busy ? null : _verifyPan,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Verify PAN', style: TextStyle(fontSize: 15))),
        )
      else
        ElevatedButton.icon(
          icon: const Icon(Icons.arrow_forward),
          label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Next: Aadhaar Verification', style: TextStyle(fontSize: 15))),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          onPressed: () => setState(() => _subStep = _KycSubStep.aadhaar),
        ),
    ]);
  }

  Widget _buildAadhaarStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        GestureDetector(
          onTap: _busy ? null : () => setState(() { _subStep = _KycSubStep.pan; _otpSent = false; _refId = null; _otpCtrl.clear(); }),
          child: const Icon(Icons.arrow_back, size: 20),
        ),
        const SizedBox(width: 8),
        const Text('Step 2: Aadhaar Verification', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      ]),
      const SizedBox(height: 6),
      const Text("We'll send an OTP to your Aadhaar-linked mobile number.", style: TextStyle(fontSize: 13, color: Colors.grey)),
      const SizedBox(height: 16),
      TextField(
        controller: _aadhaarCtrl,
        enabled: !_otpSent,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(12)],
        decoration: const InputDecoration(labelText: 'Aadhaar Number (12 digits)', hintText: '123456789012', border: OutlineInputBorder()),
      ),
      const SizedBox(height: 12),
      if (_otpSent) ...[
        TextField(
          controller: _otpCtrl,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          decoration: const InputDecoration(labelText: 'Enter OTP', hintText: '6-digit OTP', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 6),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: _busy ? null : () => setState(() { _otpSent = false; _refId = null; _otpCtrl.clear(); _subStep = _KycSubStep.aadhaar; }),
            child: const Text('Resend OTP'),
          ),
        ),
        const SizedBox(height: 10),
        ElevatedButton(
          onPressed: _busy ? null : _verifyOtp,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Verify OTP & Continue', style: TextStyle(fontSize: 15))),
        ),
      ] else
        ElevatedButton(
          onPressed: _busy ? null : _sendOtp,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Send OTP', style: TextStyle(fontSize: 15))),
        ),
    ]);
  }
}

// ─── Step indicator chip ─────────────────────────────────────────────────────

class _StepIndicator extends StatelessWidget {
  final int current; // 0 = PAN, 1 = Aadhaar
  const _StepIndicator({required this.current});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      _chip(0, 'PAN'),
      Expanded(child: Divider(color: current >= 1 ? const Color(0xFF0B1F3B) : Colors.grey.shade300, thickness: 2)),
      _chip(1, 'Aadhaar'),
    ]);
  }

  Widget _chip(int idx, String label) {
    final done = current > idx;
    final active = current == idx;
    return Column(children: [
      CircleAvatar(
        radius: 14,
        backgroundColor: done ? Colors.green : (active ? const Color(0xFF0B1F3B) : Colors.grey.shade300),
        child: done
            ? const Icon(Icons.check, color: Colors.white, size: 14)
            : Text('${idx + 1}', style: TextStyle(color: active ? Colors.white : Colors.grey.shade600, fontSize: 12, fontWeight: FontWeight.bold)),
      ),
      const SizedBox(height: 4),
      Text(label, style: TextStyle(fontSize: 11, color: active ? const Color(0xFF0B1F3B) : Colors.grey, fontWeight: active ? FontWeight.bold : FontWeight.normal)),
    ]);
  }
}
