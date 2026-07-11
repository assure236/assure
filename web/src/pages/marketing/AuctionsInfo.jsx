import React from 'react';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const LINKS = [
  { title: 'Auction Guide', path: '/plans/auction-guide', body: 'Discount bids, who wins, and how payout works.' },
  { title: 'Dividends Explained', path: '/plans/dividends', body: 'What non-winners receive each auction month.' },
  { title: 'Bidding Tips', path: '/plans/bid-tips', body: 'Habits that keep bidding calm and informed.' },
  { title: 'Member Login', path: '/login', body: 'Enter the live auction room from your portal.' },
];

export default function AuctionsInfo() {
  const navigate = useNavigate();
  return (
    <MarketingPage
      eyebrow="Auctions"
      title="Transparent monthly auctions"
      subtitle="Like leading digital chit platforms, Assure runs auctions where members compete on discount — not favour. Every session is visible in the member portal."
      actions={
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" color="secondary" onClick={() => navigate('/plans/auction-guide')}>
            Read auction guide
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
          >
            Login to bid
          </Button>
        </Stack>
      }
    >
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 680, lineHeight: 1.75 }}>
        Each month, eligible members can bid to take the prize pot early. The winning bid is typically the
        lowest amount a member is willing to accept; the discount is shared as dividend among other members.
        You join from Auctions on web or in the mobile app — no offline-only room.
      </Typography>
      <Grid container spacing={2}>
        {LINKS.map((l) => (
          <Grid item xs={12} sm={6} key={l.path}>
            <Box
              onClick={() => navigate(l.path)}
              sx={{
                p: 2.5,
                height: '100%',
                borderRadius: 3,
                border: `1px solid ${brand.line}`,
                bgcolor: '#fff',
                cursor: 'pointer',
                '&:hover': { borderColor: 'rgba(201,162,39,0.5)' },
              }}
            >
              <Typography fontWeight={800} color={brand.navy}>{l.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{l.body}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </MarketingPage>
  );
}
