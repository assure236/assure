import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class KycScreen extends StatefulWidget {
  final String? digilockerStatus;
  const KycScreen({super.key, this.digilockerStatus});
  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> with WidgetsBindingObserver {
  bool _loading = false;
  bool _awaitingDigilocker = false;
  Map<String, dynamic>? _kycData;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    if (widget.digilockerStatus != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _snack(widget.digilockerStatus == 'success'
            ? 'DigiLocker connected successfully!'
            : 'DigiLocker verification failed. Please try again.',
            isError: widget.digilockerStatus != 'success');
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingDigilocker) {
      _awaitingDigilocker = false;
      _load();
      _snack('Checking DigiLocker status...', isError: false);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await ApiService.get('/kyc/status');
      if (r['success'] == true && mounted) setState(() => _kycData = r['data']);
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String msg, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppTheme.errorColor : AppTheme.successColor,
    ));
  }

  // ── DigiLocker ─────────────────────────────────────────────────────────────
  Future<void> _openDigilocker() async {
    setState(() => _loading = true);
    try {
      final r = await ApiService.get('/kyc/digilocker/init?platform=mobile');
      if (r['success'] == true) {
        final url = (r['data']?['auth_url'] ?? r['auth_url'])?.toString();
        if (url != null && url.isNotEmpty) {
          final uri = Uri.parse(url);
          if (await canLaunchUrl(uri)) {
            _awaitingDigilocker = true;
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          } else _snack('Could not open DigiLocker');
        } else _snack('DigiLocker URL not received');
      } else _snack(r['message']?.toString() ?? 'DigiLocker init failed');
    } catch (_) { _snack('Network error. Please try again.'); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  // ── Manual upload sheet ────────────────────────────────────────────────────
  void _openManualSheet() {
    context.push('/documents');
  }

  // ── Cashfree KYC ──────────────────────────────────────────────────────────
  void _openCashfreeSheet() {
    context.push('/onboarding/digilocker');
  }

  @override
  Widget build(BuildContext context) {
    final kycStatus = (_kycData?['kyc_status'] ?? 'not_started').toString();
    final isVerified = kycStatus == 'verified' || kycStatus == 'approved';
    final isPending = kycStatus == 'pending';
    final isRejected = kycStatus == 'rejected';
    final digiConnected = _kycData?['digilocker_connected'] == true;

    Color statusColor = isVerified ? AppTheme.successColor
        : isPending ? AppTheme.secondaryColor
        : isRejected ? AppTheme.errorColor
        : AppTheme.warningColor;
    String statusLabel = isVerified ? 'KYC Verified'
        : isPending ? 'Under Review'
        : isRejected ? 'KYC Rejected'
        : 'KYC Not Verified';
    IconData statusIcon = isVerified ? Icons.verified_user
        : isPending ? Icons.hourglass_empty
        : isRejected ? Icons.cancel
        : Icons.pending_outlined;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('KYC Verification'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  // Status banner
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: statusColor.withAlpha(25),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: statusColor.withAlpha(80)),
                    ),
                    child: Row(children: [
                      Icon(statusIcon, color: statusColor, size: 36),
                      const SizedBox(width: 14),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 17, fontWeight: FontWeight.bold)),
                        if (isPending) const Text('We will notify you once approved', style: TextStyle(color: Colors.black54, fontSize: 12)),
                        if (isRejected) const Text('Please re-submit your documents', style: TextStyle(color: Colors.black54, fontSize: 12)),
                        if (!isVerified && !isPending && !isRejected)
                          const Text('Complete KYC to unlock all features', style: TextStyle(color: Colors.black54, fontSize: 12)),
                      ])),
                    ]),
                  ),
                  const SizedBox(height: 24),

                  if (isVerified) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: AppTheme.successColor.withAlpha(20),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Column(children: [
                        Icon(Icons.check_circle_rounded, color: AppTheme.successColor, size: 52),
                        SizedBox(height: 10),
                        Text('Your KYC is fully verified.', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        SizedBox(height: 4),
                        Text('All features are unlocked.', style: TextStyle(color: Colors.black54)),
                      ]),
                    ),
                  ] else ...[
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Choose Verification Method', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    ),
                    const SizedBox(height: 14),

                    // DigiLocker
                    _MethodCard(
                      icon: Icons.folder_special_rounded,
                      color: const Color(0xFF0066CC),
                      title: 'DigiLocker',
                      subtitle: 'Verify PAN & Aadhaar instantly via government DigiLocker portal.',
                      badge: digiConnected ? 'Connected' : null,
                      badgeColor: AppTheme.successColor,
                      buttonLabel: digiConnected ? 'Re-verify DigiLocker' : 'Open DigiLocker',
                      onTap: _openDigilocker,
                    ),
                    const SizedBox(height: 12),

                    // Cashfree
                    _MethodCard(
                      icon: Icons.verified_outlined,
                      color: const Color(0xFF00C853),
                      title: 'Cashfree Verification',
                      subtitle: 'Verify PAN & Aadhaar using Cashfree secure identity check.',
                      buttonLabel: 'Verify with Cashfree',
                      onTap: _openCashfreeSheet,
                    ),
                    const SizedBox(height: 12),

                    // Manual
                    _MethodCard(
                      icon: Icons.upload_file_rounded,
                      color: AppTheme.secondaryColor,
                      title: 'Manual Upload',
                      subtitle: 'Upload clear scans or photos of your PAN card and Aadhaar.',
                      buttonLabel: 'Upload Documents',
                      onTap: _openManualSheet,
                    ),
                  ],
                  const SizedBox(height: 32),
                ]),
              ),
            ),
    );
  }
}

class _MethodCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, subtitle, buttonLabel;
  final String? badge;
  final Color? badgeColor;
  final VoidCallback onTap;

  const _MethodCard({
    required this.icon, required this.color,
    required this.title, required this.subtitle, required this.buttonLabel,
    required this.onTap, this.badge, this.badgeColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(10), blurRadius: 8, offset: const Offset(0, 2))],
        border: Border.all(color: color.withAlpha(40)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: color.withAlpha(20), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              if (badge != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: (badgeColor ?? AppTheme.successColor).withAlpha(30), borderRadius: BorderRadius.circular(10)),
                  child: Text(badge!, style: TextStyle(color: badgeColor ?? AppTheme.successColor, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              ],
            ]),
            const SizedBox(height: 4),
            Text(subtitle, style: const TextStyle(color: Colors.black54, fontSize: 12)),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 38,
              child: ElevatedButton(
                onPressed: onTap,
                style: ElevatedButton.styleFrom(
                  backgroundColor: color,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  elevation: 0,
                ),
                child: Text(buttonLabel, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            ),
          ])),
        ]),
      ),
    );
  }
}
