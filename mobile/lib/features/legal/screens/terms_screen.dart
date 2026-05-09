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
            Text('Last updated: June 2026 · Version 2.0',
                style: TextStyle(color: Colors.grey, fontSize: 12)),
            SizedBox(height: 8),
            Text(
              'Please read these Terms & Conditions carefully before using the Assure ChitFunds platform. By accessing or using the App or any of our services, you acknowledge that you have read, understood, and agree to be bound by these terms.',
              style: TextStyle(fontSize: 13, color: Colors.black54, height: 1.6),
            ),
            SizedBox(height: 20),

            _Section(title: '1. About Assure ChitFunds',
              body: 'Assure ChitFunds ("Company", "we", "our") is a registered chit fund operator compliant with the Chit Funds Act, 1982, operating under the regulatory oversight of the Registrar of Chits, Telangana. Our platform digitizes the traditional chit fund experience, enabling secure enrollment, transparent auction-based bidding, and seamless payment management. By registering on the App, you enter into a legally binding agreement with Assure ChitFunds.'),

            _Section(title: '2. Acceptance of Terms',
              body: 'By downloading, installing, accessing, or using the Assure ChitFunds mobile application or web portal ("Platform"), you unconditionally agree to be bound by these Terms & Conditions, our Privacy Policy, and all applicable laws and regulations of India. These terms supersede all prior agreements. We may revise these terms periodically; continued use after publication of changes constitutes your acceptance. You are responsible for reviewing these terms regularly.'),

            _Section(title: '3. Eligibility & Registration',
              body: 'To register on our Platform:\n\n• You must be at least 18 years of age and legally competent to enter into contracts under Indian law.\n• You must be a resident citizen or resident of India with a valid Indian mobile number.\n• You may maintain only one (1) account per PAN/Aadhaar identity. Creating multiple accounts may result in immediate account suspension and forfeiture of any funds.\n• You agree to provide accurate, truthful, and complete information during registration and to promptly update any information that changes.\n• Assure ChitFunds reserves the right to reject or revoke any registration without providing reasons.'),

            _Section(title: '4. Know Your Customer (KYC)',
              body: 'Full participation in chit groups requires successful KYC verification, which includes:\n\n• A valid Aadhaar card (linked to your registered mobile number)\n• A valid PAN card\n• A live selfie captured through the App for biometric identity confirmation\n• DigiLocker-based Aadhaar/document linking (where applicable)\n\nAll KYC data is processed in compliance with UIDAI guidelines and applicable data protection laws. Failure to complete KYC within the stipulated time may result in suspension of participation rights. We reserve the right to request additional documents for enhanced due diligence.'),

            _Section(title: '5. Chit Fund Participation',
              body: 'Chit funds operated by Assure ChitFunds are governed by the Chit Funds Act, 1982, and the Chit Funds (Amendment) Act, 2019. By enrolling in a chit group, you:\n\n• Commit to paying monthly installments for the full duration of the chit group (which equals the number of members).\n• Acknowledge that your membership in the chit group is a legally binding contract under the Chit Funds Act, 1982.\n• Understand that each chit group has a defined chit value, monthly installment amount, auction mechanism, and duration, all disclosed in the group details prior to enrollment.\n• Agree that forfeiture of membership due to default will result in loss of any accumulated dividends, and the Company retains the right to recover outstanding dues through legal means.\n• Accept that the Chit Group Agreement (Chit Deed) executed digitally at the time of enrollment constitutes a valid legal document.'),

            _Section(title: '6. Auction & Bidding Process',
              body: 'Monthly auctions are conducted through the Platform in a transparent, online format:\n\n• Each eligible member may submit one bid per auction cycle.\n• The lowest bid (highest discount from chit value) determines the winner.\n• The winner receives the prize amount (chit value minus their bid amount).\n• Members who have previously won the prize (prized subscribers) are not eligible to bid again in the same chit group, but continue to pay monthly installments and receive dividends.\n• Auction results are published on the Platform and are final, binding, and subject to the Chit Funds Act, 1982.\n• Assure ChitFunds reserves the right to cancel, postpone, or reschedule an auction in extraordinary circumstances, with notice to members.\n• Digital confirmation of auction participation constitutes a valid record and shall be admissible as evidence.'),

            _Section(title: '7. Monthly Installments & Payment Obligations',
              body: 'Payment of monthly installments is a core obligation of membership:\n\n• Installments are due on the specified due date of each month as communicated via the Platform and push notifications.\n• Payments are processed through Cashfree Payments, a PCI-DSS compliant payment gateway. We do not store card details.\n• Late payments attract a late fee per the schedule displayed in the App, calculated on the outstanding principal.\n• Failure to pay for three (3) or more consecutive months may result in suspension of bidding rights and, in extreme cases, legal recovery proceedings.\n• All payment receipts are available in the App under Payment History.\n• In case of payment failure due to technical reasons, you must retry within 24 hours and report the issue to support@assure.fund.'),

            _Section(title: '8. Dividends & Prize Distribution',
              body: 'Dividends are benefits distributed to all members when a prized subscriber bids below the chit value:\n\n• The dividend is calculated as: (Chit Value − Winning Bid) ÷ Total Members.\n• Dividends are automatically credited toward your next monthly installment, reducing the amount payable.\n• Dividend credit is subject to the winning bid being below the par value.\n• We make no guarantees regarding the quantum of dividends, as they depend entirely on the bidding behavior of members in each auction cycle.'),

            _Section(title: '9. Forfeiture & Default',
              body: 'In the event of default:\n\n• If a member consistently fails to pay installments, the Company may declare the member a defaulter after issuing written (digital) notices.\n• A defaulter forfeits all dividends accrued and any right to participate in future auctions in the group.\n• The Company is entitled to recover all outstanding dues, including interest and costs, through legal proceedings under the Chit Funds Act, 1982, and the SARFAESI Act (if applicable).\n• The Company may report chronic defaulters to credit bureaus (CIBIL, CRIF, Experian, Equifax), which may adversely affect the defaulter\'s credit score.'),

            _Section(title: '10. Referral Program',
              body: 'The referral program offers rewards subject to the following:\n\n• Referral rewards are credited only after the referred user successfully completes KYC and makes their first payment.\n• Rewards are non-transferable, non-redeemable for cash, and expire after 12 months unless used.\n• Any attempt to game the referral system (e.g., self-referral, fabricated accounts) will result in immediate account termination and forfeiture of rewards.\n• Assure ChitFunds reserves the right to modify reward structures, suspend, or terminate the referral program at any time without prior notice.'),

            _Section(title: '11. Platform Usage & Prohibited Activities',
              body: 'You agree not to:\n\n• Use the Platform for any unlawful, fraudulent, or unauthorized purpose.\n• Attempt to gain unauthorized access to any system, database, or account.\n• Transmit any malware, spyware, or malicious code.\n• Impersonate any person or entity.\n• Use automated scripts or bots to interact with the Platform.\n• Engage in money laundering, terrorism financing, or any activity prohibited under the Prevention of Money Laundering Act (PMLA), 2002.\n\nViolation of these restrictions may result in immediate account termination, recovery of damages, and referral to law enforcement authorities.'),

            _Section(title: '12. Intellectual Property',
              body: 'All content on the Platform — including but not limited to the Assure ChitFunds name, logo, trademarks, designs, software code, text, graphics, user interface, and data compilations — is the exclusive intellectual property of Assure ChitFunds or its licensors, protected under applicable Indian and international intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes. Any reproduction, modification, distribution, or creation of derivative works without prior written consent is strictly prohibited.'),

            _Section(title: '13. Limitation of Liability',
              body: 'To the maximum extent permitted by applicable law:\n\n• Assure ChitFunds shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill.\n• We do not guarantee uninterrupted, error-free operation of the Platform.\n• Our total aggregate liability to you for any claims arising from or related to these terms shall not exceed the total installment amounts paid by you to Assure ChitFunds in the twelve (12) months preceding the claim.\n• Force majeure events (acts of God, government actions, internet failures, pandemics) shall not be grounds for liability.'),

            _Section(title: '14. Dispute Resolution & Grievance Redressal',
              body: 'In case of any dispute:\n\n• First, contact our support team at support@assure.fund or through the in-app Support section. We aim to resolve all grievances within 7 working days.\n• If unresolved, disputes shall first be referred to mediation/arbitration under the Arbitration and Conciliation Act, 1996.\n• The seat of arbitration shall be Hyderabad, Telangana, and proceedings shall be conducted in English.\n• For disputes related to chit fund operations, you may approach the Registrar of Chits, Telangana.\n• These terms shall be governed by and construed in accordance with the laws of India. Subject to arbitration, courts in Hyderabad, Telangana shall have exclusive jurisdiction.'),

            _Section(title: '15. Account Suspension & Termination',
              body: 'We may suspend or terminate your account with or without notice if:\n\n• You breach any provision of these Terms.\n• You provide false, fraudulent, or incomplete information.\n• You default on payment obligations.\n• We are required to do so by law or regulation.\n• Your account is involved in suspicious activity.\n\nUpon termination, all outstanding financial obligations remain enforceable. Active chit group memberships will be managed in accordance with the Chit Funds Act, 1982, and the terms of the respective chit deed.'),

            _Section(title: '16. Digital Consent & Electronic Records',
              body: 'By using the Platform, you consent to:\n\n• The use of electronic records and digital signatures under the Information Technology Act, 2000.\n• Receiving communications from Assure ChitFunds via SMS, WhatsApp, email, and push notifications.\n• The Chit Deed and other agreements executed digitally carrying the same legal validity as paper-based agreements.\n• Storage and use of your data as described in our Privacy Policy.'),

            _Section(title: '17. Amendments',
              body: 'Assure ChitFunds reserves the right to amend these Terms at any time. Material changes will be communicated via in-app notification or email at least 7 days before taking effect for existing users. Your continued use of the Platform after the effective date of changes constitutes your acceptance of the revised Terms.'),

            _Section(title: '18. Contact Us',
              body: 'For queries, complaints, or feedback regarding these Terms:\n\nEmail: legal@assure.fund\nSupport: support@assure.fund\nAddress: Assure ChitFunds, Hyderabad, Telangana — 500001\nGrievance Officer: support@assure.fund\n\nWe are committed to resolving all concerns promptly and fairly.'),

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
