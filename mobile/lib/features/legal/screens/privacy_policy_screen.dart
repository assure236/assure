import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Privacy Policy'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Privacy Policy',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            SizedBox(height: 4),
            Text('Last updated: April 2026',
                style: TextStyle(color: Colors.grey, fontSize: 12)),
            SizedBox(height: 20),

            _Section(title: '1. Information We Collect',
              body: 'We collect the following information when you use our App:\n\n'
                  '• Personal Information: Full name, email, mobile number, date of birth, gender, address, PAN number, Aadhaar number\n'
                  '• Financial Information: Bank account details, payment history, chit group enrollment data\n'
                  '• Identity Documents: Aadhaar card, PAN card, cancelled cheque, selfie photo for KYC verification\n'
                  '• Device Information: Device type, operating system, app version\n'
                  '• Usage Data: Features used, pages visited, interaction patterns'),

            _Section(title: '2. How We Use Your Information',
              body: '• Account registration and identity verification (KYC)\n'
                  '• Processing monthly payments and auction bids\n'
                  '• Sending notifications about payments, auctions, and account updates\n'
                  '• Calculating credit scores and eligibility\n'
                  '• Customer support and dispute resolution\n'
                  '• Legal compliance with Chit Funds Act and RBI guidelines\n'
                  '• Improving our services and user experience'),

            _Section(title: '3. Data Sharing',
              body: 'We do not sell your personal data. We may share information with:\n\n'
                  '• Payment gateway providers (Cashfree) for processing transactions\n'
                  '• Government authorities as required by the Chit Funds Act\n'
                  '• DigiLocker for Aadhaar/PAN verification\n'
                  '• SMS and email service providers for sending notifications\n\n'
                  'All third-party partners are contractually obligated to protect your data.'),

            _Section(title: '4. Data Security',
              body: 'We implement industry-standard security measures including:\n\n'
                  '• End-to-end encryption for data in transit (SSL/TLS)\n'
                  '• Encrypted storage for sensitive documents and credentials\n'
                  '• Secure authentication with OTP verification and biometric login\n'
                  '• Regular security audits and vulnerability assessments\n'
                  '• Access controls limiting employee access to user data'),

            _Section(title: '5. Data Retention',
              body: 'We retain your data for the duration of your account plus 8 years after the last chit group completion, as required by the Chit Funds Act and applicable tax laws. KYC documents are retained as per RBI guidelines. You may request account deletion, subject to legal retention requirements.'),

            _Section(title: '6. Your Rights',
              body: 'You have the right to:\n\n'
                  '• Access and download your personal data\n'
                  '• Correct inaccurate information via Edit Profile\n'
                  '• Request deletion of your account (subject to legal obligations)\n'
                  '• Opt out of promotional communications\n'
                  '• Withdraw consent for data processing (may affect service availability)'),

            _Section(title: '7. Cookies & Analytics',
              body: 'The App may collect anonymous usage analytics to improve performance. No advertising cookies or third-party trackers are used.'),

            _Section(title: '8. Children\'s Privacy',
              body: 'The App is not intended for individuals under 18 years of age. We do not knowingly collect data from minors.'),

            _Section(title: '9. Changes to This Policy',
              body: 'We may update this Privacy Policy periodically. Material changes will be communicated via in-app notification. Continued use after changes constitutes acceptance.'),

            _Section(title: '10. Contact Us',
              body: 'For privacy-related inquiries:\n\n'
                  'Email: privacy@assure.fund\n'
                  'Support: In-app chat or Help Center\n'
                  'Registered Office: Assure ChitFunds Pvt. Ltd., Hyderabad, Telangana, India'),

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
