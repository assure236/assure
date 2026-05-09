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
            Text('Last updated: June 2026 · Version 2.0',
                style: TextStyle(color: Colors.grey, fontSize: 12)),
            SizedBox(height: 8),
            Text(
              'At Assure ChitFunds, your privacy is not a feature — it is a fundamental right. This Privacy Policy describes how we collect, use, process, store, and protect your personal data when you use our Platform, in full compliance with the Digital Personal Data Protection Act, 2023 (DPDP Act) and all applicable Indian laws.',
              style: TextStyle(fontSize: 13, color: Colors.black54, height: 1.6),
            ),
            SizedBox(height: 20),

            _Section(title: '1. Who We Are (Data Controller)',
              body: 'Assure ChitFunds ("Company", "we", "us") is the Data Fiduciary (Controller) responsible for processing your personal data. We are a registered chit fund operator in Telangana, India, compliant with the Chit Funds Act, 1982.\n\nGrievance/Data Protection Officer:\nEmail: privacy@assure.fund\nAddress: Assure ChitFunds, Hyderabad, Telangana — 500001\n\nFor any data-related requests, you may contact us at the above address and expect a response within 30 days.'),

            _Section(title: '2. Information We Collect',
              body: 'We collect only the minimum data necessary to deliver our services ("data minimisation principle"):\n\n'
                  'Identity & Contact Data:\n'
                  '• Full legal name, mobile number, email address, date of birth, gender\n'
                  '• Aadhaar number (masked), PAN number\n'
                  '• Residential address (current and permanent)\n\n'
                  'Financial & KYC Data:\n'
                  '• Bank account number, IFSC code, account holder name\n'
                  '• Payment history, chit group enrollment and installment records\n'
                  '• Identity documents: Aadhaar, PAN, live selfie photograph\n\n'
                  'DigiLocker & Government Data:\n'
                  '• Data retrieved through DigiLocker is used solely for KYC verification and is not retained beyond the KYC process unless required by law.\n\n'
                  'Device & Technical Data:\n'
                  '• Device ID, operating system version, app version\n'
                  '• IP address, Firebase push notification token (FCM token)\n'
                  '• App usage patterns and interaction logs (for service improvement only)\n\n'
                  'Communication Data:\n'
                  '• Messages exchanged with our support team\n'
                  '• In-app notifications and alert interactions'),

            _Section(title: '3. Lawful Basis for Processing',
              body: 'We process your personal data on the following lawful bases under the DPDP Act, 2023:\n\n'
                  '• Consent: You explicitly consent during registration and KYC.\n'
                  '• Contractual Necessity: Processing required to fulfill your chit group membership and payment obligations.\n'
                  '• Legal Obligation: Compliance with the Chit Funds Act, 1982, Income Tax Act, PMLA, 2002, and UIDAI regulations.\n'
                  '• Legitimate Interests: Security monitoring, fraud prevention, and platform improvement, balanced against your rights.'),

            _Section(title: '4. How We Use Your Information',
              body: '• Identity verification (KYC) to comply with the Chit Funds Act and anti-money laundering regulations\n'
                  '• Processing your enrollment in chit groups and managing your chit membership\n'
                  '• Facilitating monthly installment payments, dividend computation, and auction bidding\n'
                  '• Sending transactional notifications (payment reminders, auction alerts, receipts) via SMS, email, and push notifications\n'
                  '• Responding to your queries and resolving disputes through our support channels\n'
                  '• Detecting, preventing, and investigating fraudulent activity and security threats\n'
                  '• Complying with court orders, regulatory directives, and legal proceedings\n'
                  '• Improving the Platform through anonymised analytics (we never sell identifiable data)\n'
                  '• Sending promotional communications only if you have opted in (you may opt out at any time)'),

            _Section(title: '5. Data Sharing & Third Parties',
              body: 'We do not sell, rent, or trade your personal data. We share data only in these limited circumstances:\n\n'
                  '• Payment Processors: Cashfree Payments India Pvt. Ltd. for secure payment processing (PCI-DSS compliant).\n'
                  '• Government & Regulatory Bodies: Registrar of Chits (Telangana), Income Tax Department, Financial Intelligence Unit (FIU-IND), or any court of competent jurisdiction, when legally required.\n'
                  '• Notification Services: Twilio/Fast2SMS for SMS delivery; Google Firebase for push notifications; Resend for transactional emails.\n'
                  '• DigiLocker: For Aadhaar/PAN verification (data is not stored post-verification).\n'
                  '• Credit Bureaus: In case of loan applications or chronic payment defaults (as disclosed in Terms).\n'
                  '• Cloud Infrastructure: Secure hosting on industry-standard cloud platforms with contractual data processing agreements.\n\n'
                  'All third-party service providers are bound by Data Processing Agreements (DPAs) requiring them to protect your data and process it only for specified purposes.'),

            _Section(title: '6. Data Security',
              body: 'We implement robust, multi-layered security measures:\n\n'
                  '• TLS 1.2/1.3 encryption for all data in transit between your device and our servers\n'
                  '• AES-256 encryption for sensitive data at rest (documents, banking details)\n'
                  '• Secure OTP-based authentication and optional biometric login (fingerprint/face)\n'
                  '• JWT-based session management with automatic token invalidation on new login\n'
                  '• 10-minute inactivity auto-logout on web; session invalidation across all devices on new login\n'
                  '• Regular security audits, penetration testing, and vulnerability assessments\n'
                  '• Strict role-based access controls (RBAC) limiting internal access to your data\n'
                  '• Real-time fraud detection and suspicious activity alerts\n\n'
                  'Despite these measures, no system is completely immune to breaches. In the unlikely event of a data breach affecting your rights, we will notify you within 72 hours as required by law.'),

            _Section(title: '7. Data Retention',
              body: 'We retain your personal data for as long as necessary:\n\n'
                  '• Active accounts: For the duration of your membership plus 8 years after your last chit group completion (as mandated by the Chit Funds Act, 1982, and Income Tax Act).\n'
                  '• KYC documents: Minimum 5 years post account closure, as per PMLA and UIDAI requirements.\n'
                  '• Transaction records: 8 years as required by financial and tax regulations.\n'
                  '• Communication logs: 3 years for dispute resolution purposes.\n\n'
                  'After the applicable retention period, data is securely deleted or anonymised in accordance with our data disposal policy.'),

            _Section(title: '8. Your Rights Under the DPDP Act, 2023',
              body: 'As a Data Principal, you have the following rights:\n\n'
                  '• Right to Access: Request a copy of your personal data held by us.\n'
                  '• Right to Correction: Correct inaccurate or incomplete data via Edit Profile or by contacting us.\n'
                  '• Right to Erasure: Request deletion of your account and data, subject to legal retention obligations.\n'
                  '• Right to Grievance Redressal: Lodge a complaint with our Data Protection Officer at privacy@assure.fund.\n'
                  '• Right to Nominate: Nominate a person to exercise your rights in the event of your death or incapacity.\n'
                  '• Right to Withdraw Consent: Withdraw consent for processing (note: this may affect service availability).\n\n'
                  'To exercise any of these rights, email us at privacy@assure.fund with the subject "Data Rights Request". We will respond within 30 days.'),

            _Section(title: '9. Push Notifications & Marketing',
              body: 'We send push notifications for transactional purposes (payment reminders, auction alerts, KYC updates). You may manage notification preferences within the App settings.\n\n'
                  'Promotional communications (offers, new features) are sent only with your explicit consent. You may opt out at any time through:\n'
                  '• App Settings → Notifications → Promotional Notifications (OFF)\n'
                  '• Clicking "Unsubscribe" in any promotional email\n\n'
                  'Opting out of promotional communications will not affect transactional notifications essential to your membership.'),

            _Section(title: '10. Cookies & Analytics',
              body: 'The mobile App does not use browser cookies. The web portal uses minimal, strictly necessary cookies for session management only. We use anonymised analytics (aggregated data) to understand usage patterns and improve the Platform.\n\n'
                  'We do not use advertising cookies, third-party trackers, or behavioural profiling. No personal data is shared with advertising networks.'),

            _Section(title: '11. Cross-Border Data Transfers',
              body: 'Your data is primarily stored and processed within India. In limited circumstances, data may be transferred to cloud infrastructure providers with servers outside India solely for redundancy and disaster recovery. Such transfers comply with Section 16 of the DPDP Act, 2023, and are governed by appropriate contractual safeguards ensuring equivalent data protection.'),

            _Section(title: '12. Children\'s Privacy',
              body: 'The Platform is strictly intended for individuals 18 years of age and older. We do not knowingly collect or process personal data from minors. If we become aware that data from a minor has been collected, we will delete it immediately. Parents or guardians who believe their child\'s data has been collected should contact privacy@assure.fund immediately.'),

            _Section(title: '13. Changes to This Policy',
              body: 'We may update this Privacy Policy periodically to reflect changes in law, our practices, or the services we offer. Material changes will be communicated via in-app notification and/or email at least 7 days before they take effect. We encourage you to review this Policy regularly. The "Last Updated" date at the top indicates when the most recent changes were made. Continued use after the effective date constitutes acceptance of the revised Policy.'),

            _Section(title: '14. Complaints & Regulatory Authority',
              body: 'If you believe your data protection rights have been violated, you may:\n\n'
                  '1. First raise a complaint with our Data Protection Officer at privacy@assure.fund.\n'
                  '2. If unsatisfied, approach the Data Protection Board of India (once constituted under the DPDP Act, 2023).\n'
                  '3. For chit fund-specific complaints, contact the Registrar of Chits, Telangana.'),

            _Section(title: '15. Contact Us',
              body: 'Data Protection Officer / Privacy Officer:\nAssure ChitFunds\nEmail: privacy@assure.fund\nSupport: support@assure.fund\nPhone: Available via in-app Support\nAddress: Hyderabad, Telangana — 500001, India\n\nWe are committed to treating your personal data with the utmost respect and transparency. Your trust is the foundation of our business.'),

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
