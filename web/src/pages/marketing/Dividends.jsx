import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

export default function Dividends() {
  const navigate = useNavigate();
  return (
    <MarketingPage
      eyebrow="Auctions"
      title="Dividends explained"
      subtitle="When someone wins at a discount, the difference is shared with other members as dividend."
      narrow
    >
      <Typography color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
        Example: chit value ₹1,00,000. Winning bid ₹80,000. Discount ₹20,000. If 19 other members share
        that discount, each receives about ₹1,053 that month (illustrative — exact rules follow your
        group agreement and company charges).
      </Typography>
      <Typography color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
        Dividends usually reduce what you pay that month or appear as a credit you can track under
        Transactions and Analytics after login.
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <Button variant="contained" onClick={() => navigate('/plans/calculator')}>Try calculator</Button>
        <Button variant="outlined" onClick={() => navigate('/plans/auction-guide')}>Auction guide</Button>
      </Stack>
    </MarketingPage>
  );
}
