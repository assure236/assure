import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/dashboard_provider.dart';
import '../../../core/theme/app_theme.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '\u20B9', decimalDigits: 0);

class TotalInvestmentScreen extends StatelessWidget {
  const TotalInvestmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final dash = context.watch<DashboardProvider>();
    final memberships = dash.memberships;
    final totalInvested = dash.totalInvested;

    // Calculate per-group investment from memberships
    final groups = <Map<String, dynamic>>[];
    double sumPaid = 0;
    for (final m in memberships) {
      final group = m['chit_group_id'];
      if (group == null) continue;
      final paid = (m['total_paid'] ?? 0).toDouble();
      sumPaid += paid;
      groups.add({
        'name': group['group_name'] ?? 'Unknown',
        'chit_value': (group['chit_value'] ?? 0).toDouble(),
        'monthly_installment': (group['monthly_installment'] ?? 0).toDouble(),
        'duration': group['duration_months'] ?? 0,
        'months_paid': m['months_paid'] ?? 0,
        'total_paid': paid,
        'status': group['status'] ?? 'active',
      });
    }
    // Use API total if available, else sum
    final displayTotal = totalInvested > 0 ? totalInvested : sumPaid;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Total Investment'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Total Investment Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primaryColor, Color(0xFF1A237E)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  const Icon(Icons.savings_rounded, color: Colors.white70, size: 40),
                  const SizedBox(height: 8),
                  const Text('Total Amount Invested',
                      style: TextStyle(color: Colors.white70, fontSize: 14)),
                  const SizedBox(height: 4),
                  Text(_inr.format(displayTotal),
                      style: const TextStyle(
                          color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('Across ${groups.length} chit group${groups.length != 1 ? 's' : ''}',
                      style: const TextStyle(color: Colors.white60, fontSize: 13)),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Per-Group Breakdown
            if (groups.isNotEmpty) ...[
              const Text('Group-wise Breakdown',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              ...groups.map((g) => _GroupInvestmentCard(group: g)),
            ] else ...[
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Column(
                    children: [
                      Icon(Icons.account_balance_wallet_outlined,
                          size: 64, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      Text('No active investments yet',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 16)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _GroupInvestmentCard extends StatelessWidget {
  final Map<String, dynamic> group;
  const _GroupInvestmentCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final name = group['name'] as String;
    final chitValue = (group['chit_value'] as double);
    final emi = (group['monthly_installment'] as double);
    final duration = group['duration'] as int;
    final monthsPaid = group['months_paid'] as int;
    final totalPaid = (group['total_paid'] as double);
    final progress = duration > 0 ? (monthsPaid / duration).clamp(0.0, 1.0) : 0.0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: AppTheme.accentBlue.withAlpha(30),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.group_work_rounded, color: AppTheme.accentBlue, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      Text('Chit Value: ${_inr.format(chitValue)}',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                    ],
                  ),
                ),
                Text(_inr.format(totalPaid),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primaryColor)),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _InfoChip(label: 'Subscription', value: _inr.format(emi)),
                const SizedBox(width: 12),
                _InfoChip(label: 'Paid', value: '$monthsPaid / $duration months'),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: Colors.grey.shade200,
                valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.successColor),
              ),
            ),
            const SizedBox(height: 4),
            Text('${(progress * 100).toStringAsFixed(0)}% complete',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final String label;
  final String value;
  const _InfoChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label: ', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
        ],
      ),
    );
  }
}
