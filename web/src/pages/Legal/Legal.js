import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';

const Section = ({ title, body }) => (
  <Box mb={3}>
    <Typography variant="h6" fontWeight={700} gutterBottom>{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
      {body}
    </Typography>
  </Box>
);

const LegalPage = ({ title, subtitle, children }) => (
  <Container maxWidth="md" sx={{ py: 3 }}>
    <Paper sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>{title}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" mb={3}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Paper>
  </Container>
);

export const Terms = () => (
  <LegalPage title="Terms & Conditions" subtitle="Last updated: June 2026 · Version 2.0">
    <Typography variant="body2" color="text.secondary" paragraph>
      Please read these Terms & Conditions carefully before using the Assure ChitFunds platform.
      By accessing or using the App or any of our services, you agree to be bound by these terms.
    </Typography>
    <Section title="1. About Assure ChitFunds"
      body="Assure ChitFunds is a registered chit fund operator compliant with the Chit Funds Act, 1982, operating under the regulatory oversight of the Registrar of Chits, Telangana." />
    <Section title="2. Acceptance of Terms"
      body="By using the mobile application or web portal, you agree to these Terms, our Privacy Policy, and applicable laws of India." />
    <Section title="3. Eligibility & Registration"
      body="You must be at least 18 years of age, a resident of India with a valid mobile number, and maintain only one account per PAN/Aadhaar identity." />
    <Section title="4. Know Your Customer (KYC)"
      body="Full participation requires KYC verification including Aadhaar, PAN, live selfie, and DigiLocker linking where applicable." />
    <Section title="5. Chit Fund Participation"
      body="By enrolling in a chit group you commit to paying monthly installments for the full duration. Membership is a legally binding contract under the Chit Funds Act, 1982." />
    <Section title="6. Auction & Bidding"
      body="Monthly auctions are conducted online. The lowest bid wins. Prized subscribers may not bid again in the same group but continue paying installments." />
    <Section title="7. Payments"
      body="Installments are due monthly. Late fees apply per group terms. Payments are processed via Cashfree Payments." />
    <Section title="8. Dispute Resolution"
      body="Contact support@assure.fund first. Unresolved disputes may be referred to arbitration in Hyderabad, Telangana under the Arbitration and Conciliation Act, 1996." />
    <Section title="9. Account Termination"
      body="We may suspend or terminate accounts for breach of terms, fraud, or regulatory requirements. Outstanding obligations remain enforceable." />
    <Section title="10. Digital Consent"
      body="You consent to electronic records and digital signatures under the Information Technology Act, 2000." />
  </LegalPage>
);

export const PrivacyPolicy = () => (
  <LegalPage title="Privacy Policy" subtitle="Last updated: June 2026 · Version 2.0 · DPDP Act compliant">
    <Typography variant="body2" color="text.secondary" paragraph>
      Assure ChitFunds respects your privacy and is committed to protecting your personal data in
      accordance with the Digital Personal Data Protection Act, 2023.
    </Typography>
    <Section title="1. Data We Collect"
      body="We collect identity data (name, PAN, Aadhaar), contact data (mobile, email, address), financial data (bank details, payment history), and device data (FCM tokens, IP address)." />
    <Section title="2. How We Use Your Data"
      body="Data is used for KYC verification, chit fund operations, payment processing, fraud prevention, customer support, and regulatory compliance." />
    <Section title="3. Data Sharing"
      body="We share data with payment gateways (Cashfree), KYC providers (DigiLocker), SMS/email services, and government authorities when legally required. We never sell your data." />
    <Section title="4. Data Security"
      body="We use encryption, secure servers, access controls, and regular security audits to protect your information." />
    <Section title="5. Your Rights"
      body="You may request access, correction, or deletion of your personal data by contacting support@assure.fund. Some data must be retained for legal compliance." />
    <Section title="6. Cookies & Analytics"
      body="The web portal uses session cookies for authentication. We do not use third-party advertising trackers." />
    <Section title="7. Children's Privacy"
      body="Our services are not intended for persons under 18 years of age." />
    <Section title="8. Contact"
      body="For privacy concerns: support@assure.fund | Assure ChitFunds, Hyderabad, Telangana." />
  </LegalPage>
);

export default LegalPage;
