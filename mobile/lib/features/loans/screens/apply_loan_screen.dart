import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class ApplyLoanScreen extends StatelessWidget {
  const ApplyLoanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Apply for Loan'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withAlpha(26),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.account_balance_wallet,
                    size: 64, color: AppTheme.primaryColor),
              ),
              const SizedBox(height: 24),
              const Text('Loan Against Chit',
                  style: TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Text(
                'Apply for a loan against your chit group holdings. Quick approval based on your payment history and credit score.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600], fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.withAlpha(76)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.construction, color: Colors.orange, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Loan facility is coming soon! We are working with financial partners to bring this feature to you.',
                        style: TextStyle(color: Colors.orange, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
