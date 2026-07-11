import React from 'react';
import { Box, Button, Typography, Stack, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const FAQS = [
  {
    q: 'What is a chit fund?',
    a: 'A chit fund is a group savings arrangement. Members contribute a fixed installment each month into a common pot. One member receives the prize through a monthly auction; others receive a dividend from the auction discount.',
  },
  {
    q: 'How do I complete KYC?',
    a: 'After registration, complete onboarding: DigiLocker for Aadhaar, face verification, bank account, cancelled cheque, and address proof. Enrollment in chit groups is available once mandatory checks pass.',
  },
  {
    q: 'What if I miss a payment?',
    a: 'Late or missed installments may attract penalties per your group agreement. Pay as soon as possible from the Payments section. If you expect a delay, raise a support ticket so the team can note your case.',
  },
  {
    q: 'How do auctions work?',
    a: 'Each month, eligible members bid by offering a discount on the chit value. The lowest valid bid wins the prize. The discount is shared as dividend among non-winners. Join the live auction room from Auctions when your session opens.',
  },
  {
    q: 'Can I be in multiple chit groups?',
    a: 'Yes, subject to profile limits and company policy. Each group has its own installment schedule and auction calendar. Use the family member switcher if managing chits for relatives on one account.',
  },
  {
    q: 'When does a vacant group become active?',
    a: 'A vacant group starts once all member seats are filled, agreements are in place, and the first installment date is announced. Until then, you can enroll if seats remain and your KYC is complete.',
  },
  {
    q: 'How do I see my transaction history?',
    a: 'Open Transactions from the dashboard. You will find installments, dividends, penalties, and wallet movements with dates and references.',
  },
  {
    q: 'Is my data secure?',
    a: 'We use encrypted connections and verified identity checks. Read our Privacy Policy for how personal and financial data is stored and used. Never share your OTP or password with anyone claiming to be support.',
  },
  {
    q: 'How do I contact support?',
    a: 'Logged-in members can raise tickets from the Support page. For general enquiries before login, use email, phone, or WhatsApp on the Contact page.',
  },
  {
    q: 'What documents do I need to enroll?',
    a: 'Completed KYC (Aadhaar via DigiLocker, bank proof, address proof) and acceptance of group terms. Some groups may require additional undertakings shown at enrollment.',
  },
];

export default function FaqPage() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Support"
      title="Frequently asked questions"
      subtitle="Straight answers about chits, KYC, payments, auctions, and membership."
      narrow
    >
      <Stack spacing={0}>
        {FAQS.map((f) => (
          <Accordion
            key={f.q}
            disableGutters
            elevation={0}
            sx={{
              border: `1px solid ${brand.line}`,
              borderRadius: '12px !important',
              mb: 1.5,
              '&:before': { display: 'none' },
              bgcolor: '#fff',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: brand.navy }} />}>
              <Typography fontWeight={700} sx={{ color: brand.navy }}>{f.q}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" lineHeight={1.75}>{f.a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      <Box
        sx={{
          mt: 4,
          p: 3,
          borderRadius: 3,
          bgcolor: brand.canvas,
          border: `1px solid ${brand.line}`,
          textAlign: 'center',
        }}
      >
        <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Still have questions?</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Reach our team by email, phone, or WhatsApp — or login to open a support ticket.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/support-center/contact')}>
          Contact us
        </Button>
      </Box>
    </MarketingPage>
  );
}
