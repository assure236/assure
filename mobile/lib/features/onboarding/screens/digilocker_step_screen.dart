import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

class DigilockerStepScreen extends StatefulWidget {
  final String? digilockerStatus;
  const DigilockerStepScreen({super.key, this.digilockerStatus});

  @override
  State<DigilockerStepScreen> createState() => _DigilockerStepScreenState();
}

enum _KycSubStep { chooser, pan, aadhaar, otpEntry }

class _DigilockerStepScreenState extends State<DigilockerStepScreen> {
  _KycSubStep _subStep = _KycSubStep.chooser;
  bool _busy = false;

  final _panCtrl = TextEditingController();
  bool _panVerified = false;
  String? _panName;

  final _aadhaarCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  bool _otpSent = false;
  String? _refId;

  String? _digilockerVerificationId;
  int? _digilockerReferenceId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncStep());
  }

  @override
  void dispose() {
    _panCtrl.dispose();
    _aadhaarCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _syncStep() async {
    try {
      final res = await OnboardingApi.getStatus();
      if (!mounted) return;
      final data = res['data'] as Map<String, dynamic>?;
      if (data == null) return;
      if (data['completed'] == true) {
        context.go('/onboarding/done');
        return;
      }
      final next = data['next_step']?.toString();
      if (next != null && next != 'digilocker') {
        context.go(onboardingNextRoute(next));
      }
    } catch (_) {}
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700),
    );
  }

  void _showSuccess(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.green.shade700),
    );
  }

  Future<void> _startCashfreeDigilocker() async {
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.createCashfreeDigilockerUrl(userFlow: 'signup');
      if (res['success'] != true) {
        _showError(res['message']?.toString() ?? 'Unable to start DigiLocker flow.');
        return;
      }

      final data = (res['data'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      final url = data['url']?.toString();
      _digilockerVerificationId = data['verification_id']?.toString();
      _digilockerReferenceId = data['reference_id'] is int
          ? data['reference_id'] as int
          : int.tryParse('${data['reference_id'] ?? ''}');

      if (url == null || url.isEmpty) {
        _showError('DigiLocker URL missing from server response.');
        return;
      }

      final uri = Uri.parse(url);
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) {
        _showError('Could not open DigiLocker URL.');
        return;
      }
      _showSuccess('Complete DigiLocker consent, then return and tap Check Status.');
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkCashfreeDigilockerStatus() async {
    if ((_digilockerVerificationId ?? '').isEmpty && _digilockerReferenceId == null) {
      _showError('Start DigiLocker flow first.');
      return;
    }

    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.syncCashfreeDigilocker(
        verificationId: _digilockerVerificationId,
        referenceId: _digilockerReferenceId,
      );
      if (res['success'] != true) {
        _showError(res['message']?.toString() ?? 'Failed to check DigiLocker status.');
        return;
      }
      if (res['completed'] == true) {
        _showSuccess('DigiLocker verified successfully. Proceeding to face step.');
        if (mounted) context.go('/onboarding/face');
      } else {
        final status = res['data']?['status']?.toString() ?? 'PENDING';
        _showError('DigiLocker status: $status. Please complete consent and retry.');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyPan() async {
    final pan = _panCtrl.text.toUpperCase().trim();
    if (pan.length != 10 || !RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]$').hasMatch(pan)) {
      _showError('Enter a valid PAN (example: ABCDE1234F)');
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.verifyPanKyc(pan);
      if (!mounted) return;
      if (res['success'] == true) {
        final name = res['data']?['name']?.toString();
        setState(() {
          _panVerified = true;
          _panName = name;
        });
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
        setState(() {
          _otpSent = true;
          _subStep = _KycSubStep.otpEntry;
        });
        _showSuccess('OTP sent to Aadhaar-linked mobile number.');
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
    if (otp.length != 6) {
      _showError('Enter the 6-digit OTP.');
      return;
    }
    if (_refId == null) {
      _showError('Session expired. Resend OTP.');
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.verifyAadhaarOtp(
        aadhaarNumber: aadhaar,
        refId: _refId!,
        otp: otp,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        _showSuccess('Aadhaar verified. Proceeding to face step.');
        context.go('/onboarding/face');
      } else {
        _showError(res['message']?.toString() ?? 'OTP verification failed.');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 0,
      title: 'Verify your identity',
      subtitle: 'Use Cashfree DigiLocker or Cashfree PAN plus Aadhaar OTP.',
      loading: _busy,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_subStep == _KycSubStep.chooser) _buildChooser(),
          if (_subStep == _KycSubStep.pan) ...[
            _StepIndicator(current: 0),
            const SizedBox(height: 20),
            _buildPanStep(),
          ],
          if (_subStep == _KycSubStep.aadhaar || _subStep == _KycSubStep.otpEntry) ...[
            _StepIndicator(current: 1),
            const SizedBox(height: 20),
            _buildAadhaarStep(),
          ],
        ],
      ),
    );
  }

  Widget _buildChooser() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 1: Cashfree DigiLocker',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 8),
        const Text(
          'Recommended: verify Aadhaar and PAN using Cashfree DigiLocker consent flow.',
          style: TextStyle(fontSize: 13, color: Colors.grey),
        ),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: _busy ? null : _startCashfreeDigilocker,
          icon: const Icon(Icons.verified_user),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          label: const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('Start Cashfree DigiLocker Verification'),
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _busy ? null : _checkCashfreeDigilockerStatus,
          icon: const Icon(Icons.refresh),
          label: const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('Check DigiLocker Status'),
          ),
        ),
        const SizedBox(height: 16),
        const Row(
          children: [
            Expanded(child: Divider()),
            Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('or')),
            Expanded(child: Divider()),
          ],
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: _busy ? null : () => setState(() => _subStep = _KycSubStep.pan),
          child: const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('Use Cashfree PAN + Aadhaar OTP'),
          ),
        ),
      ],
    );
  }

  Widget _buildPanStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(
        children: [
          IconButton(
            onPressed: _busy ? null : () => setState(() => _subStep = _KycSubStep.chooser),
            icon: const Icon(Icons.arrow_back),
          ),
          const Text('PAN Verification', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        ],
      ),
      const SizedBox(height: 6),
      const Text('Enter your PAN card number for verification.', style: TextStyle(fontSize: 13, color: Colors.grey)),
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
        onChanged: (v) {
          final up = v.toUpperCase();
          if (up != v) {
            _panCtrl.value = _panCtrl.value.copyWith(
              text: up,
              selection: TextSelection.collapsed(offset: up.length),
            );
          }
        },
      ),
      if (_panName != null) ...[
        const SizedBox(height: 8),
        Text('Verified Name: $_panName', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w600)),
      ],
      const SizedBox(height: 16),
      if (!_panVerified)
        ElevatedButton(
          onPressed: _busy ? null : _verifyPan,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Verify PAN')),
        )
      else
        ElevatedButton.icon(
          onPressed: _busy ? null : () => setState(() => _subStep = _KycSubStep.aadhaar),
          icon: const Icon(Icons.arrow_forward),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          label: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Next: Aadhaar OTP')),
        ),
    ]);
  }

  Widget _buildAadhaarStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(
        children: [
          IconButton(
            onPressed: _busy
                ? null
                : () => setState(() {
                      _subStep = _KycSubStep.pan;
                      _otpSent = false;
                      _refId = null;
                      _otpCtrl.clear();
                    }),
            icon: const Icon(Icons.arrow_back),
          ),
          const Text('Aadhaar Verification', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        ],
      ),
      const SizedBox(height: 6),
      const Text('We will send OTP to your Aadhaar-linked mobile.', style: TextStyle(fontSize: 13, color: Colors.grey)),
      const SizedBox(height: 16),
      TextField(
        controller: _aadhaarCtrl,
        enabled: !_otpSent,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(12)],
        decoration: const InputDecoration(
          labelText: 'Aadhaar Number (12 digits)',
          hintText: '123456789012',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 12),
      if (_otpSent) ...[
        TextField(
          controller: _otpCtrl,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          decoration: const InputDecoration(labelText: 'Enter OTP', hintText: '6-digit OTP', border: OutlineInputBorder()),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: _busy
                ? null
                : () => setState(() {
                      _otpSent = false;
                      _refId = null;
                      _otpCtrl.clear();
                      _subStep = _KycSubStep.aadhaar;
                    }),
            child: const Text('Resend OTP'),
          ),
        ),
        ElevatedButton(
          onPressed: _busy ? null : _verifyOtp,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Verify OTP and Continue')),
        ),
      ] else
        ElevatedButton(
          onPressed: _busy ? null : _sendOtp,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Send OTP')),
        ),
    ]);
  }
}

class _StepIndicator extends StatelessWidget {
  final int current;
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
