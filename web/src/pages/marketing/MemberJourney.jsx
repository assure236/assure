import React from 'react';
import { Box, Button, Typography, Grid, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const JOURNEY = [
  { step: 'Register', detail: 'Sign up with your mobile number and basic profile details.' },
  { step: 'DigiLocker', detail: 'Verify Aadhaar and identity documents through DigiLocker.' },
  { step: 'Face verification', detail: 'Complete a quick face match to confirm identity.' },
  { step: 'Bank details', detail: 'Add and verify your bank account for payouts and refunds.' },
  { step: 'Cheque', detail: 'Upload a cancelled cheque or bank proof as required.' },
  { step: 'Address', detail: 'Confirm your residential address with supporting proof.' },
  { step: 'Dashboard', detail: 'Land on your member dashboard with KYC status and next steps.' },
  { step: 'Enroll', detail: 'Browse open chit groups and enroll in one that fits your budget.' },
  { step: 'Pay', detail: 'Pay monthly installments through the portal before due dates.' },
  { step: 'Auction', detail: 'Join the live auction room when your group session opens.' },
];

export default function MemberJourney() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Learn"
      title="Member journey"
      subtitle="The path from registration to your first auction — same steps on web and mobile app."
    >
      <Stack spacing={1.5}>
        {JOURNEY.map((j, i) => (
          <Box
            key={j.step}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '40px 1fr', sm: '48px 140px 1fr' },
              gap: { xs: 1.5, sm: 2 },
              alignItems: 'center',
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${brand.line}`,
              bgcolor: i < 6 ? '#fff' : brand.canvas,
            }}
          >
            <Typography fontWeight={800} sx={{ color: brand.goldDark, fontSize: 14 }}>
              {String(i + 1).padStart(2, '0')}
            </Typography>
            <Typography fontWeight={700} sx={{ color: brand.navy }}>{j.step}</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.65} sx={{ gridColumn: { xs: '2 / -1', sm: 'auto' } }}>
              {j.detail}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Grid container spacing={2} mt={4}>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" color="text.secondary" lineHeight={1.75}>
            Onboarding steps 1–6 typically take one session if documents are ready. You can pause and resume — progress is saved to your profile.
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent={{ md: 'flex-end' }}>
            <Button variant="contained" color="secondary" onClick={() => navigate('/register')}>
              Start registration
            </Button>
            <Button onClick={() => navigate('/plans/how-chits-work')}>How chits work</Button>
          </Stack>
        </Grid>
      </Grid>
    </MarketingPage>
  );
}
