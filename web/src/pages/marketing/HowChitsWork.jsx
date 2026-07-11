import React from 'react';
import { Box, Button, Typography, Grid, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const STEPS = [
  {
    n: 1,
    title: 'Enroll in a chit group',
    body: 'After registration and KYC, browse vacant or open groups. Choose a chit value and tenure that fits your monthly budget. Your enrollment is confirmed once the group terms are accepted and any required commitment is recorded.',
  },
  {
    n: 2,
    title: 'Pay monthly installments',
    body: 'Each month you pay your installment before the due date. The amount covers your share of the chit pot plus applicable company charges as defined in the group agreement. Pay through the member portal and keep receipts in Transactions.',
  },
  {
    n: 3,
    title: 'Join the monthly auction',
    body: 'Once per month the group holds an auction. Members who need funds early place bids by offering a discount on the chit value. The lowest valid bid wins the prize amount for that month.',
  },
  {
    n: 4,
    title: 'Receive dividend or payout',
    body: 'The auction discount is shared among non-winning members as a dividend, reducing their net installment for that month. If you win, you receive the prize payout (chit value minus your bid discount) per group rules.',
  },
];

export default function HowChitsWork() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Chit Plans"
      title="How chits work"
      subtitle="A straightforward cycle: enroll, pay monthly, bid when you need funds, and track dividends or payouts in your portal."
    >
      <Stack spacing={2.5}>
        {STEPS.map((s) => (
          <Box
            key={s.n}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'auto 1fr', md: '56px 1fr' },
              gap: 2,
              p: 3,
              borderRadius: 3,
              border: `1px solid ${brand.line}`,
              bgcolor: '#fff',
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: brand.navy,
                color: brand.goldSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              {s.n}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: brand.navy, mb: 1 }}>{s.title}</Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.75}>{s.body}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      <Grid container spacing={2} mt={4}>
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, borderRadius: 3, bgcolor: brand.canvas, border: `1px solid ${brand.line}`, height: '100%' }}>
            <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Example</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75}>
              A ₹1,00,000 chit with 20 members collects ₹5,000 per member each month. If the winner bids ₹75,000, the ₹25,000 discount is divided among the other 19 members — roughly ₹1,316 each as dividend that month.
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, borderRadius: 3, bgcolor: brand.canvas, border: `1px solid ${brand.line}`, height: '100%' }}>
            <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>What to read next</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75} mb={2}>
              Auctions have specific bidding rules and timing. The auction guide explains discounts, winners, and how live rooms work on web and app.
            </Typography>
            <Button variant="contained" onClick={() => navigate('/plans/auction-guide')}>
              Auction guide
            </Button>
          </Box>
        </Grid>
      </Grid>
    </MarketingPage>
  );
}
