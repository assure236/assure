import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  bool _loading = false;
  bool _digilockerLoading = false;
  Map<String, dynamic>? _kycStatus;
  String? _error;

  final _panController = TextEditingController();
  String? _panError;

  @override
  void initState() {
    super.initState();
    _fetchKycStatus();
  }

  @override
  void dispose() {
    _panController.dispose();
    super.dispose();
  }

  Future<void> _fetchKycStatus() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.get('/kyc/status');
      if (res['success'] == true) {
        setState(() => _kycStatus = res['data']);
      } else {
        setState(() => _error = res['message'] ?? 'Failed to load KYC status');
      }
    } catch (e) {
      setState(() => _error = 'Could not connect to server');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitPan() async {
    final pan = _panController.text.trim().toUpperCase();
    final panRegex = RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$');
    if (!panRegex.hasMatch(pan)) {
      setState(() => _panError = 'Enter a valid PAN (e.g., ABCDE1234F)');
      return;
    }
    setState(() {
      _panError = null;
      _loading = true;
    });
    try {
      final res = await ApiService.post('/kyc/verify-pan', {'pan_number': pan});
      if (res['success'] == true) {
        final verified = res['data']?['verified'] == true;
        final name = res['data']?['name'];
        _showSnackBar(
          verified 
            ? 'PAN verified! Name: $name' 
            : 'PAN saved. Will be verified during review.',
          isError: false,
        );
        await _fetchKycStatus();
      } else {
        _showSnackBar(res['message'] ?? 'PAN verification failed');
      }
    } catch (e) {
      _showSnackBar('Could not connect to server');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _initDigilocker() async {
    setState(() => _digilockerLoading = true);
    try {
      final res = await ApiService.get('/kyc/digilocker/init');
      if (res['success'] == true) {
        final url = res['data']?['auth_url'] ?? res['auth_url'];
        if (url != null) {
          final uri = Uri.parse(url);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          } else {
            _showSnackBar('Could not open DigiLocker');
          }
        } else {
          _showSnackBar('DigiLocker URL not received');
        }
      } else {
        _showSnackBar(res['message'] ?? 'DigiLocker init failed');
      }
    } catch (e) {
      _showSnackBar('Could not connect to server');
    } finally {
      setState(() => _digilockerLoading = false);
    }
  }

  void _showSnackBar(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppTheme.errorColor : AppTheme.successColor,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('KYC Verification'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchKycStatus,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _buildContent(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppTheme.errorColor),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _fetchKycStatus, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final status = _kycStatus?['kyc_status'] ?? 'not_started';
    final panVerified = _kycStatus?['pan_verified'] == true;
    final aadhaarVerified = _kycStatus?['aadhaar_verified'] == true;

    return RefreshIndicator(
      onRefresh: _fetchKycStatus,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusBanner(status),
            const SizedBox(height: 20),
            _buildStepsCard(panVerified, aadhaarVerified),
            const SizedBox(height: 20),
            if (!panVerified) ...[
              _buildPanCard(),
              const SizedBox(height: 20),
            ],
            if (panVerified && !aadhaarVerified) ...[
              _buildDigilockerCard(),
              const SizedBox(height: 20),
            ],
            _buildInfoCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBanner(String status) {
    Color color;
    IconData icon;
    String label;

    switch (status) {
      case 'approved':
        color = AppTheme.successColor;
        icon = Icons.verified_user;
        label = 'KYC Verified';
        break;
      case 'pending':
        color = AppTheme.secondaryColor;
        icon = Icons.hourglass_empty;
        label = 'KYC Under Review';
        break;
      case 'rejected':
        color = AppTheme.errorColor;
        icon = Icons.cancel;
        label = 'KYC Rejected';
        break;
      default:
        color = Colors.grey;
        icon = Icons.info_outline;
        label = 'KYC Not Started';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withAlpha(26),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(76)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 40),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: TextStyle(
                      color: color, fontSize: 18, fontWeight: FontWeight.bold)),
              if (status == 'pending')
                const Text('We\'ll notify you once it\'s approved',
                    style: TextStyle(color: Colors.grey)),
              if (status == 'rejected')
                const Text('Please re-submit your documents',
                    style: TextStyle(color: Colors.grey)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStepsCard(bool panVerified, bool aadhaarVerified) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Verification Steps',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _buildStep(1, 'PAN Card Verification',
                'Link your PAN card for identity verification', panVerified),
            const Divider(height: 24),
            _buildStep(2, 'Aadhaar via DigiLocker',
                'Verify Aadhaar using official DigiLocker', aadhaarVerified),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(int step, String title, String subtitle, bool done) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: done ? AppTheme.successColor : AppTheme.primaryColor.withAlpha(26),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: done
                ? const Icon(Icons.check, color: Colors.white, size: 20)
                : Text('$step',
                    style: TextStyle(
                        color: AppTheme.primaryColor, fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      decoration: done ? TextDecoration.lineThrough : null,
                      color: done ? Colors.grey : Colors.black87)),
              Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
        ),
        if (done) const Icon(Icons.check_circle, color: AppTheme.successColor),
      ],
    );
  }

  Widget _buildPanCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.credit_card, color: AppTheme.primaryColor),
                SizedBox(width: 8),
                Text('PAN Card', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 4),
            const Text('Enter your 10-digit PAN number',
                style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 16),
            TextField(
              controller: _panController,
              textCapitalization: TextCapitalization.characters,
              maxLength: 10,
              decoration: InputDecoration(
                labelText: 'PAN Number',
                hintText: 'ABCDE1234F',
                errorText: _panError,
                prefixIcon: const Icon(Icons.badge),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _submitPan,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                ),
                child: _loading
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Verify PAN'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDigilockerCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.folder_special, color: Color(0xFF0066CC)),
                SizedBox(width: 8),
                Text('DigiLocker Verification',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Connect your DigiLocker account to verify Aadhaar. '
              'You\'ll be redirected to the official DigiLocker portal.',
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.security, color: Colors.blue, size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Your data is securely fetched from government servers',
                      style: TextStyle(color: Colors.blue, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _digilockerLoading ? null : _initDigilocker,
                icon: _digilockerLoading
                    ? const SizedBox(height: 16, width: 16,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.open_in_browser),
                label: const Text('Connect DigiLocker'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0066CC),
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard() {
    return Card(
      color: Colors.amber.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.info, color: Colors.amber),
              const SizedBox(width: 8),
              Text('Why KYC?',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, color: Colors.amber.shade900)),
            ]),
            const SizedBox(height: 8),
            const Text(
              '• Required by RBI regulations for chit fund operations\n'
              '• Ensures secure transactions and fraud prevention\n'
              '• One-time process — valid for life of your account\n'
              '• Mandatory to participate in auctions',
              style: TextStyle(fontSize: 13, height: 1.6),
            ),
          ],
        ),
      ),
    );
  }
}
