import React from 'react';
import { Box, Button, Typography, Grid, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const REASONS = [
  {
    title: 'KYC before you enroll',
    body: 'DigiLocker verification, face match, bank details, and address checks are completed once during onboarding. You enroll in groups only after profile checks pass.',
  },
  {
    title: 'Live auctions',
    body: 'Join auction rooms from the web portal or mobile app. Bids, timers, and outcomes are visible to members in the group — no opaque phone calls.',
  },
  {
    title: 'Transactions in one view',
    body: 'Installments, dividends, penalties, and receipts appear in your Transactions history. You can reconcile what you paid and what was credited without chasing statements.',
  },
  {
    title: 'Family members on one account',
    body: 'Add family members under your profile and switch between them when paying or viewing groups. Useful for households managing more than one chit.',
  },
  {
    title: 'Support tickets',
    body: 'Raise a ticket from the member portal for payment issues, auction queries, or document requests. Track status instead of repeating the same call.',
  },
];

export default function WhyAssure() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Company"
      title="Why Assure"
      subtitle="Five practical reasons members use Assure — focused on what you can verify in the portal, not marketing claims."
      actions={(
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" color="secondary" onClick={() => navigate('/register')}>
            Create free account
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}
          >
            Member login
          </Button>
        </Stack>
      )}
    >
      <Grid container spacing={2.5}>
        {REASONS.map((r, i) => (
          <Grid item xs={12} md={6} key={r.title}>
            <Box
              sx={{
                height: '100%',
                p: 3,
                borderRadius: 3,
                border: `1px solid ${brand.line}`,
                bgcolor: '#fff',
              }}
            >
              <Typography sx={{ color: brand.goldDark, fontWeight: 800, fontSize: 13, mb: 1 }}>
                {String(i + 1).padStart(2, '0')}
              </Typography>
              <Typography variant="h6" sx={{ color: brand.navy, mb: 1 }}>{r.title}</Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.75}>{r.body}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          mt: 4,
          p: 3,
          borderRadius: 3,
          bgcolor: brand.canvas,
          border: `1px solid ${brand.line}`,
        }}
      >
        <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Ready to see it yourself?</Typography>
        <Typography variant="body2" color="text.secondary" lineHeight={1.7} mb={2}>
          Register takes a few minutes. Complete KYC, browse open groups, and enroll when a plan matches your monthly budget.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" onClick={() => navigate('/register')}>Join Assure</Button>
          <Button variant="outlined" onClick={() => navigate('/login')}>Already a member? Login</Button>
        </Stack>
      </Box>
    </MarketingPage>
  );
}
