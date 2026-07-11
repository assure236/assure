import React from 'react';
import { Box, Button, Typography, Grid, Stack, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const TIERS = [
  {
    name: 'Starter',
    range: '₹25,000 – ₹1,00,000',
    monthly: 'Roughly ₹1,250 – ₹5,000',
    tenure: 'Typically 20–40 months',
    note: 'Smaller ticket groups for first-time members or short-term goals.',
  },
  {
    name: 'Growth',
    range: '₹2,00,000 – ₹5,00,000',
    monthly: 'Roughly ₹10,000 – ₹25,000',
    tenure: 'Typically 20–50 months',
    note: 'Mid-range groups popular for education, home improvement, or family needs.',
    highlight: true,
  },
  {
    name: 'Prime',
    range: '₹5,00,000+',
    monthly: 'Varies by group size',
    tenure: 'Typically 30–60 months',
    note: 'Larger chit values for members with higher monthly saving capacity.',
  },
];

export default function ChitPlans() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Chit Plans"
      title="Browse chit plans"
      subtitle="Plan tiers by chit value — actual installment depends on group size, tenure, and company charges shown at enrollment."
      actions={(
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" color="secondary" onClick={() => navigate('/register')}>
            Register to enroll
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}
          >
            Login to view open groups
          </Button>
        </Stack>
      )}
    >
      <Grid container spacing={2.5} mb={4}>
        {TIERS.map((t) => (
          <Grid item xs={12} md={4} key={t.name}>
            <Box
              sx={{
                height: '100%',
                p: 3,
                borderRadius: 3,
                bgcolor: '#fff',
                border: t.highlight ? `2px solid ${brand.gold}` : `1px solid ${brand.line}`,
                boxShadow: t.highlight ? brand.shadowSoft : 'none',
              }}
            >
              <Typography variant="overline" sx={{ color: brand.muted }}>{t.name}</Typography>
              <Typography
                sx={{
                  fontFamily: brand.fontDisplay,
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  color: brand.navy,
                  my: 0.75,
                }}
              >
                {t.range}
              </Typography>
              <Stack spacing={0.75} mb={2}>
                <Typography variant="body2"><strong>Est. monthly:</strong> {t.monthly}</Typography>
                <Typography variant="body2"><strong>Tenure:</strong> {t.tenure}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{t.note}</Typography>
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
          mb: 4,
        }}
      >
        <Typography variant="h6" sx={{ color: brand.navy, mb: 1.5 }}>Vacant vs active groups</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography fontWeight={700} sx={{ color: brand.navy, mb: 0.5 }}>Vacant groups</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75}>
              A group still filling members. You can enroll if KYC is complete and a seat is available. The chit typically starts once all members are confirmed and the first installment date is set.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography fontWeight={700} sx={{ color: brand.navy, mb: 0.5 }}>Active groups</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75}>
              A group already running with monthly installments and auctions underway. Enrollment may be closed or limited to replacement seats — check the portal for current availability.
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ mb: 3, borderColor: brand.line }} />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <Button onClick={() => navigate('/plans/calculator')}>Try the calculator</Button>
        <Button onClick={() => navigate('/plans/how-chits-work')}>How chits work</Button>
        <Typography variant="body2" color="text.secondary">
          Logged-in members see live groups under Chit Groups in the dashboard.
        </Typography>
      </Stack>
    </MarketingPage>
  );
}
