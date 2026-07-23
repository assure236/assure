import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';
import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

// ─── HOW THIS WORKS ─────────────────────────────────────────────────────────
// 1. User taps "Verify with Cashfree DigiLocker"
// 2. We call POST /onboarding/digilocker/create-url → get {url, verification_id}
// 3. We open that URL in external browser via url_launcher
// 4. User logs into DigiLocker on Cashfree's page, gives consent
// 5. Cashfree redirects to https://assure.fund/onboarding/digilocker?verification_id=xxx
// 6. When user returns to our app (AppLifecycleState.resumed), we auto-poll
//    POST /onboarding/digilocker/sync with the verification_id
// 7. If completed → navigate to /onboarding/face
// ────────────────────────────────────────────────────────────────────────────

class DigilockerStepScreen extends StatefulWidget {
  final String? initialVerificationId;

  const DigilockerStepScreen({
    super.key,
    this.initialVerificationId,
  });

  @override
  State<DigilockerStepScreen> createState() => _DigilockerStepScreenState();
}

class _DigilockerStepScreenState extends State<DigilockerStepScreen>
    with WidgetsBindingObserver {
  // Phase: idle | creating | waiting | syncing | done | error
  String _phase = 'idle';
  String? _verificationId;
  String? _digilockerUrl;
  String? _error;
  bool _alreadyDone = false;
  bool _syncingStatus = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // If app was opened via deep-link callback from Cashfree redirect,
      // continue syncing immediately instead of waiting for manual action.
      final incoming = widget.initialVerificationId?.trim();
      if (incoming != null && incoming.isNotEmpty) {
        setState(() {
          _verificationId = incoming;
          _phase = 'syncing';
          _error = null;
        });
        await _syncStatus();
        return;
      }
      await _checkAlreadyDone();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // ── Auto-poll when user returns from browser ──────────────────────────────
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _phase == 'waiting') {
      _syncStatus();
    }
  }

  // ── Check if step already complete ───────────────────────────────────────
  Future<void> _checkAlreadyDone() async {
    try {
      final res = await OnboardingApi.getStatus();
      if (!mounted) return;
      final data = res['data'] as Map<String, dynamic>?;
      if (data == null) return;

      // Already finished onboarding entirely
      if (data['completed'] == true) {
        context.go('/onboarding/done');
        return;
      }

      // Skip forward if not on digilocker step
      final next = data['next_step']?.toString();
      if (next != null && next != 'digilocker') {
        context.go(onboardingNextRoute(next));
        return;
      }

      // Digilocker already verified
      final dlStatus = data['steps']?['digilocker']?['status']?.toString();
      if (dlStatus == 'completed' || dlStatus == 'manual') {
        setState(() => _alreadyDone = true);
      }
    } catch (_) {}
  }

  // ── Step 1: Get Cashfree DigiLocker URL and open in browser ──────────────
  Future<void> _startDigilocker() async {
    if (_phase == 'creating') return;
    setState(() {
      _phase = 'creating';
      _error = null;
    });

    try {
      final res = await OnboardingApi.createCashfreeDigilockerUrl(userFlow: 'signup');

      if (res['success'] != true) {
        setState(() {
          _error = res['message']?.toString() ?? 'Unable to start DigiLocker verification.';
          _phase = 'error';
        });
        return;
      }

      final data = (res['data'] as Map?)?.cast<String, dynamic>() ?? {};
      final url = data['url']?.toString();
      _verificationId = data['verification_id']?.toString();
      _digilockerUrl = url;

      if (url == null || url.isEmpty) {
        setState(() {
          _error = 'DigiLocker URL not received from server. Please try again.';
          _phase = 'error';
        });
        return;
      }

      // Open in external browser
      final uri = Uri.parse(url);
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);

      if (!opened) {
        setState(() {
          _error = 'Could not open browser. Please check your device settings.';
          _phase = 'error';
        });
        return;
      }

      // Now waiting — auto-polls when user returns (didChangeAppLifecycleState)
      setState(() => _phase = 'waiting');
    } catch (e) {
      setState(() {
        _error = 'Error: ${e.toString()}';
        _phase = 'error';
      });
    }
  }

  // ── Step 2: Sync result from Cashfree ────────────────────────────────────
  Future<void> _syncStatus() async {
    if (_syncingStatus) return;
    if ((_verificationId ?? '').isEmpty) {
      setState(() {
        _error = 'Please start DigiLocker first.';
        _phase = 'error';
      });
      return;
    }

    setState(() {
      _syncingStatus = true;
      _phase = 'syncing';
    });

    try {
      final res = await OnboardingApi.syncCashfreeDigilocker(
        verificationId: _verificationId,
      );

      if (!mounted) return;

      if (res['success'] == true && res['completed'] == true) {
        setState(() => _phase = 'done');
        await Future.delayed(const Duration(milliseconds: 800));
        if (mounted) context.go('/onboarding/face');
        return;
      }

      // Not yet completed — go back to waiting
      final status = res['data']?['status']?.toString() ?? 'PENDING';
      if (status == 'CONSENT_DENIED') {
        setState(() {
          _error = 'DigiLocker consent was denied. Please try again and approve all requested permissions.';
          _phase = 'error';
        });
      } else if (status == 'EXPIRED') {
        setState(() {
          _error = 'The DigiLocker session expired. Please start again.';
          _phase = 'error';
        });
      } else {
        // Still pending — let user check manually or wait
        setState(() => _phase = 'waiting');
        _showSnack('Status: $status — Please complete DigiLocker in the browser and return here.', isError: false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Sync failed: ${e.toString()}';
        _phase = 'error';
      });
    } finally {
      if (mounted) {
        setState(() => _syncingStatus = false);
      } else {
        _syncingStatus = false;
      }
    }
  }

  void _retry() {
    setState(() {
      _phase = 'idle';
      _error = null;
      _verificationId = null;
      _digilockerUrl = null;
      _syncingStatus = false;
    });
  }

  Future<void> _showPreflightConfirm() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: _phase != 'creating',
      builder: (ctx) => AlertDialog(
        title: const Text('Before you proceed'),
        content: const Text(
          'You will now be redirected to DigiLocker. Please keep your Aadhaar-linked mobile number ready.',
        ),
        actions: [
          TextButton(
            onPressed: _phase == 'creating' ? null : () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: _phase == 'creating'
                ? null
                : () async {
                    Navigator.of(ctx).pop();
                    await _startDigilocker();
                  },
            child: _phase == 'creating'
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Proceed'),
          ),
        ],
      ),
    );
  }

  Future<void> _reopenDigilocker() async {
    final url = _digilockerUrl;
    if (url == null || url.isEmpty) return;
    final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      _showSnack('Could not reopen DigiLocker in browser.', isError: true);
    }
  }

  void _showSnack(String msg, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppTheme.errorColor : AppTheme.accentBlue,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 0,
      title: 'Verify your identity',
      subtitle: 'We use Cashfree DigiLocker to instantly verify your Aadhaar & PAN — no uploads needed.',
      loading: _phase == 'creating' || _phase == 'syncing',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Already done banner ──────────────────────────────────────────
          if (_alreadyDone)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.successColor.withAlpha(20),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.successColor.withAlpha(80)),
              ),
              child: Row(children: [
                const Icon(Icons.verified, color: AppTheme.successColor, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Identity already verified!', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.successColor)),
                    const SizedBox(height: 4),
                    TextButton(
                      onPressed: () => context.go('/onboarding/face'),
                      style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero),
                      child: const Text('Continue to Face Verification →'),
                    ),
                  ]),
                ),
              ]),
            ),

          // ── How it works ─────────────────────────────────────────────────
          if (_phase == 'idle' || _phase == 'creating') ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F4FF),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('How it works', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0B1F3B))),
                const SizedBox(height: 10),
                ...[
                  '1. Tap "Verify with Cashfree DigiLocker" below',
                  '2. A secure Cashfree page opens in your browser',
                  '3. Log in to DigiLocker & approve sharing Aadhaar + PAN',
                  '4. Return to this app — verification completes automatically',
                ].map((s) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text(s, style: const TextStyle(fontSize: 13, color: Colors.black87)),
                )),
              ]),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _phase == 'creating' ? null : _showPreflightConfirm,
              icon: _phase == 'creating'
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.verified_user),
              label: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(
                  _phase == 'creating' ? 'Opening Cashfree DigiLocker...' : 'Verify with Cashfree DigiLocker',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B1F3B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],

          // ── Waiting state (user is in browser) ───────────────────────────
          if (_phase == 'waiting') ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Column(children: [
                const Icon(Icons.hourglass_empty, color: AppTheme.accentBlue, size: 36),
                const SizedBox(height: 10),
                const Text(
                  'Waiting for DigiLocker...',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.accentBlue),
                ),
                const SizedBox(height: 6),
                Text(
                  'Complete the verification in the browser, then come back to this app.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Colors.blue.shade700),
                ),
                const SizedBox(height: 14),
                const LinearProgressIndicator(),
              ]),
            ),
            const SizedBox(height: 16),
            // Manual check button (if auto-resume doesn't fire)
            OutlinedButton.icon(
              onPressed: _syncingStatus ? null : _syncStatus,
              icon: _syncingStatus
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
              label: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(_syncingStatus ? 'Checking...' : "I'm done — Check Status"),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF0B1F3B)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: (_digilockerUrl == null || _digilockerUrl!.isEmpty) ? null : _reopenDigilocker,
              child: const Text('Reopen DigiLocker'),
            ),
            TextButton(
              onPressed: _retry,
              child: Text('Start Over', style: TextStyle(color: Colors.red.shade600)),
            ),
          ],

          // ── Syncing ──────────────────────────────────────────────────────
          if (_phase == 'syncing') ...[
            const SizedBox(height: 20),
            const Center(child: CircularProgressIndicator()),
            const SizedBox(height: 12),
            const Center(
              child: Text('Fetching your verified documents...', style: TextStyle(color: Colors.grey)),
            ),
          ],

          // ── Done ─────────────────────────────────────────────────────────
          if (_phase == 'done') ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.successColor.withAlpha(20),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.successColor.withAlpha(80)),
              ),
              child: const Row(children: [
                Icon(Icons.check_circle, color: AppTheme.successColor, size: 28),
                SizedBox(width: 10),
                Expanded(child: Text(
                  'Aadhaar & PAN verified successfully!',
                  style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.successColor),
                )),
              ]),
            ),
          ],

          // ── Error ─────────────────────────────────────────────────────────
          if (_phase == 'error') ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                  const SizedBox(width: 8),
                  const Text('Verification failed', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.errorColor)),
                ]),
                const SizedBox(height: 6),
                Text(_error ?? 'Unknown error. Please try again.', style: const TextStyle(fontSize: 13)),
              ]),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _retry,
              icon: const Icon(Icons.refresh),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('Try Again', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B1F3B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
