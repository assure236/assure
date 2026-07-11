import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const TIERS = {
  starter: {
    eyebrow: 'Starter',
    title: 'Starter chit plans',
    subtitle: 'Smaller ticket groups — typically ₹25,000 to ₹1 Lakh — for members building the habit of monthly saving.',
    range: '₹25,000 – ₹1,00,000',
    points: [
      'Lower monthly installments while you learn auctions and dues.',
      'Ideal first enrollment after KYC is verified.',
      'Same portal tools as larger groups: pay, bid, track dividends.',
    ],
  },
  growth: {
    eyebrow: 'Growth',
    title: 'Growth chit plans',
    subtitle: 'Mid-range groups — typically ₹2 Lakh to ₹5 Lakh — for family goals and larger milestones.',
    range: '₹2,00,000 – ₹5,00,000',
    points: [
      'Balanced tenure and installment for serious savers.',
      'Auctions matter more — review the auction guide before bidding.',
      'Track each group separately under My Chit Groups after login.',
    ],
  },
  prime: {
    eyebrow: 'Prime',
    title: 'Prime chit plans',
    subtitle: 'Larger ticket groups — ₹5 Lakh and above — for members with higher monthly capacity.',
    range: '₹5,00,000+',
    points: [
      'Higher installments and prize pots; confirm cash flow before enrolling.',
      'Profile and KYC checks still required before Invest Now.',
      'Use Transactions and Analytics to monitor contribution over tenure.',
    ],
  },
};

export default function SchemeTier() {
  const navigate = useNavigate();
  const location = useLocation();
  const key = location.pathname.split('/').pop();
  const data = TIERS[key] || TIERS.starter;

  return (
    <MarketingPage eyebrow={`Schemes · ${data.eyebrow}`} title={data.title} subtitle={data.subtitle} narrow>
      <Box
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          border: `1px solid ${brand.line}`,
          bgcolor: brand.mist,
        }}
      >
        <Typography variant="overline" sx={{ color: brand.goldDark }}>Typical chit value</Typography>
        <Typography sx={{ fontFamily: brand.fontDisplay, fontWeight: 600, fontSize: '1.75rem', color: brand.navy }}>
          {data.range}
        </Typography>
      </Box>
      <Stack spacing={1.5} mb={3}>
        {data.points.map((p) => (
          <Typography key={p} variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            · {p}
          </Typography>
        ))}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button variant="contained" onClick={() => navigate('/register')}>Create account</Button>
        <Button variant="outlined" onClick={() => navigate('/plans')}>See all tiers</Button>
        <Button variant="text" onClick={() => navigate('/plans/calculator')}>Open calculator</Button>
      </Stack>
    </MarketingPage>
  );
}
