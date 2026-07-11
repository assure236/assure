import React from 'react';
import { Box, Button, Typography, Grid, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const CARDS = [
  {
    title: 'How chits work',
    desc: 'Enroll, pay monthly, auction, and dividend — the full cycle explained.',
    path: '/plans/how-chits-work',
  },
  {
    title: 'Auction guide',
    desc: 'Bidding, winners, dividends, and the live auction room.',
    path: '/plans/auction-guide',
  },
  {
    title: 'Member journey',
    desc: 'From registration through KYC to your first payment and auction.',
    path: '/learn/member-journey',
  },
  {
    title: 'Refer & earn',
    desc: 'Share Assure with friends and earn ₹500 when they join a chit.',
    path: '/learn/refer',
  },
];

export default function LearnHub() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Learn"
      title="Chit education hub"
      subtitle="Focused guides for members and first-time savers — read one topic at a time."
    >
      <Grid container spacing={2.5}>
        {CARDS.map((c) => (
          <Grid item xs={12} sm={6} key={c.path}>
            <Box
              onClick={() => navigate(c.path)}
              sx={{
                p: 3,
                height: '100%',
                borderRadius: 3,
                bgcolor: '#fff',
                border: `1px solid ${brand.line}`,
                cursor: 'pointer',
                transition: 'border-color 0.2s ease, transform 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(201,162,39,0.5)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Typography variant="h6" sx={{ color: brand.navy, mb: 1 }}>{c.title}</Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.7} mb={2}>{c.desc}</Typography>
              <Button size="small" sx={{ px: 0 }}>Read guide</Button>
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
        <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Also useful</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button onClick={() => navigate('/plans')}>Browse chit plans</Button>
          <Button onClick={() => navigate('/plans/calculator')}>Calculator</Button>
          <Button onClick={() => navigate('/support-center/faq')}>FAQs</Button>
        </Stack>
      </Box>
    </MarketingPage>
  );
}
