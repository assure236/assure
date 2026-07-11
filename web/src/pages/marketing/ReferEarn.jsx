import React from 'react';
import { Box, Button, Typography, Grid, Stack, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand, fmtINR } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const STEPS = [
  { title: 'Share your code', body: 'After login, find your referral code on the Referrals page. Share it with friends who are considering a chit.' },
  { title: 'Friend registers', body: 'Your friend creates an account using your referral code during registration or from your invite link.' },
  { title: 'Friend joins a chit', body: 'When your friend enrolls in a chit group and pays their first subscription, the referral qualifies.' },
  { title: 'You earn ₹500', body: `${fmtINR(500)} is credited to your Assure wallet. Use it toward installments or withdraw per wallet rules in the portal.` },
];

export default function ReferEarn() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Learn"
      title="Refer & earn"
      subtitle={`Earn ${fmtINR(500)} in your Assure wallet when a referred friend joins a chit and pays their first subscription.`}
      actions={(
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" color="secondary" onClick={() => navigate('/register')}>
            Create account
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}
          >
            Login for your code
          </Button>
        </Stack>
      )}
    >
      <Grid container spacing={2.5} mb={4}>
        {STEPS.map((s, i) => (
          <Grid item xs={12} sm={6} key={s.title}>
            <Box
              sx={{
                p: 3,
                height: '100%',
                borderRadius: 3,
                border: `1px solid ${brand.line}`,
                bgcolor: '#fff',
              }}
            >
              <Typography sx={{ color: brand.goldDark, fontWeight: 800, fontSize: 13, mb: 1 }}>
                Step {i + 1}
              </Typography>
              <Typography variant="h6" sx={{ color: brand.navy, mb: 1 }}>{s.title}</Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.75}>{s.body}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: brand.canvas,
          border: `1px solid ${brand.line}`,
        }}
      >
        <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Good to know</Typography>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
            Referral rewards apply when the referred member completes a qualifying first subscription payment on an active chit.
          </Typography>
          <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
            Pending and completed earnings are visible on the Referrals page after login. Terms may be updated — check the portal for current rules.
          </Typography>
        </Stack>
        <Divider sx={{ my: 2, borderColor: brand.line }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" onClick={() => navigate('/login')}>Login to refer</Button>
          <Button variant="outlined" onClick={() => navigate('/register')}>Register first</Button>
        </Stack>
      </Box>
    </MarketingPage>
  );
}
