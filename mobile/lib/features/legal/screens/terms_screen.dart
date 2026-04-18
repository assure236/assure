import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Terms & Conditions'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Terms & Conditions',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            SizedBox(height: 4),
            Text('Last updated: April 2026',
                style: TextStyle(color: Colors.grey, fontSize: 12)),
            SizedBox(height: 20),

            _Section(title: '1. Acceptance of Terms',
              body: 'By downloading, installing, or using the Assure Chit Funds mobile application ("App"), you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the App.'),

            _Section(title: '2. Registration & Eligibility',
              body: 'You must be at least 18 years of age and a resident of India to register. You agree to provide accurate, current, and complete information during registration and to keep your account information updated. Each user may maintain only one account.'),

            _Section(title: '3. KYC Verification',
              body: 'To participate in chit groups, you must complete Know Your Customer (KYC) verification by submitting valid identity documents (Aadhaar, PAN) and a live selfie. Assure Chit Funds reserves the right to reject or suspend accounts that fail verification.'),

            _Section(title: '4. Chit Fund Participation',
              body: 'Chit fund groups are governed by the Chit Funds Act, 1982, and applicable state regulations. By enrolling in a chit group, you commit to making monthly installment payments for the entire duration of the chit. Failure to make timely payments may result in penalties, suspension from the group, and impact on your credit score.'),

            _Section(title: '5. Auction & Bidding',
              body: 'Monthly auctions are conducted online through the App. Each member may bid once per auction. The lowest bidder wins the prize amount. Auction results are final and binding. Members who have already received the prize cannot bid again in the same chit group.'),

            _Section(title: '6. Payments & Late Fees',
              body: 'Payments are processed securely through Cashfree payment gateway. Late payments attract a penalty calculated on a tiered basis. Repeated defaults may lead to forfeiture of membership and legal action as per the Chit Funds Act.'),

            _Section(title: '7. Dividends',
              body: 'Dividends are the difference between the chit value and the winning bid, distributed equally among all members. Dividends are adjusted against monthly installments automatically.'),

            _Section(title: '8. Referral Program',
              body: 'Referral rewards are credited after the referred user completes their first successful payment. Assure Chit Funds reserves the right to modify or discontinue the referral program at any time.'),

            _Section(title: '9. Intellectual Property',
              body: 'All content, logos, trademarks, and software within the App are the property of Assure Chit Funds. You may not reproduce, distribute, or create derivative works without written consent.'),

            _Section(title: '10. Limitation of Liability',
              body: 'Assure Chit Funds shall not be liable for any indirect, incidental, or consequential damages arising from the use of the App. Our total liability shall not exceed the amounts paid by you in the preceding 12 months.'),

            _Section(title: '11. Termination',
              body: 'We may suspend or terminate your account if you violate these terms, commit fraud, or default on payments. Upon termination, any outstanding obligations remain enforceable.'),

            _Section(title: '12. Governing Law',
              body: 'These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana.'),

            _Section(title: '13. Contact Us',
              body: 'For any questions regarding these terms, please contact us at support@assure.fund or through the in-app support chat.'),

            SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final String body;
  const _Section({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 6),
          Text(body,
              style: const TextStyle(
                  fontSize: 14, color: Colors.black87, height: 1.6)),
        ],
      ),
    );
  }
}
