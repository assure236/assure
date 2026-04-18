import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class ReferralsScreen extends StatefulWidget {
  const ReferralsScreen({super.key});

  @override
  State<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends State<ReferralsScreen> {
  bool _loading = false;
  Map<String, dynamic>? _stats;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.get('/referrals/referral-stats');
      if (res['success'] == true) {
        setState(() => _stats = res['data']);
      } else {
        setState(() => _error = res['message'] ?? 'Failed to load referral stats');
      }
    } catch (e) {
      setState(() => _error = 'Could not connect to server');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Referral code copied!'),
        backgroundColor: AppTheme.successColor,
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _shareCode(String code) {
    Share.share(
      'Join Assure Chit Funds and invest smartly!\n'
      'Use my referral code: $code\n'
      'Sign up at: https://assurechitfunds.com/register',
      subject: 'Assure Chit Funds - Referral Invitation',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Refer & Earn'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchStats),
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
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _fetchStats, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final code = _stats?['referral_code'] ?? 'N/A';
    final totalReferrals = _stats?['totalReferrals'] ?? _stats?['total_referrals'] ?? 0;
    final successfulReferrals = _stats?['successfulReferrals'] ?? _stats?['successful_referrals'] ?? 0;
    final pendingReferrals = (totalReferrals is int ? totalReferrals : 0) - (successfulReferrals is int ? successfulReferrals : 0);
    final totalRewards = (_stats?['total_earnings'] ?? _stats?['total_rewards'] ?? 0.0).toDouble();
    final pendingRewards = (_stats?['pending_earnings'] ?? _stats?['pending_rewards'] ?? 0.0).toDouble();
    final referredMembers = List<Map<String, dynamic>>.from(_stats?['referrals'] ?? _stats?['referred_members'] ?? []);

    return RefreshIndicator(
      onRefresh: _fetchStats,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildReferralCodeCard(code),
            const SizedBox(height: 16),
            _buildStatsRow(totalReferrals, successfulReferrals, pendingReferrals),
            const SizedBox(height: 16),
            _buildRewardsCard(totalRewards, pendingRewards),
            const SizedBox(height: 20),
            _buildHowItWorksCard(),
            const SizedBox(height: 20),
            if (referredMembers.isNotEmpty) ...[
              const Text('Referred Members',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              ...referredMembers.map((m) => _buildMemberTile(m)).toList(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildReferralCodeCard(String code) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primaryDark, AppTheme.primaryColor],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Text('Your Referral Code',
              style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          Text(code,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 4)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildActionButton(Icons.copy, 'Copy', () => _copyCode(code)),
              const SizedBox(width: 16),
              _buildActionButton(Icons.share, 'Share', () => _shareCode(code)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white24,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow(int total, int successful, int pending) {
    return Row(
      children: [
        Expanded(child: _buildStatCard('Total', total.toString(), Icons.people, AppTheme.primaryColor)),
        const SizedBox(width: 8),
        Expanded(child: _buildStatCard('Joined', successful.toString(), Icons.check_circle, AppTheme.successColor)),
        const SizedBox(width: 8),
        Expanded(child: _buildStatCard('Pending', pending.toString(), Icons.hourglass_empty, AppTheme.secondaryColor)),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildRewardsCard(double total, double pending) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Rewards Earned',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildRewardItem('Total Earned', total, AppTheme.successColor),
                ),
                Container(width: 1, height: 50, color: Colors.grey.shade200),
                Expanded(
                  child: _buildRewardItem('Pending', pending, AppTheme.secondaryColor),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRewardItem(String label, double amount, Color color) {
    return Column(
      children: [
        Text('₹${amount.toStringAsFixed(0)}',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
      ],
    );
  }

  Widget _buildHowItWorksCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('How It Works',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _buildStep('1', 'Share your referral code with friends & family'),
            _buildStep('2', 'They register using your code'),
            _buildStep('3', 'Once they join a chit group, you earn rewards'),
            _buildStep('4', 'Rewards credited to your account within 7 days'),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(String num, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: AppTheme.primaryColor,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(num,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }

  Widget _buildMemberTile(Map<String, dynamic> member) {
    final name = member['full_name'] ?? 'Unknown';
    final status = member['reward_status'] ?? member['status'] ?? 'pending';
    final joinedAt = member['created_at'];

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppTheme.primaryColor.withAlpha(26),
          child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: const TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold)),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: joinedAt != null
            ? Text('Joined ${_formatDate(joinedAt)}',
                style: const TextStyle(fontSize: 12))
            : null,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: (status == 'active' ? AppTheme.successColor : AppTheme.secondaryColor)
                .withAlpha(26),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            status == 'credited' ? 'Active' : 'Pending',
            style: TextStyle(
                color: status == 'credited' ? AppTheme.successColor : AppTheme.secondaryColor,
                fontSize: 11,
                fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return isoDate;
    }
  }
}
