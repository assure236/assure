import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const TIPS = [
  'Know your max discount before the room opens — decide calmly, not mid-bid.',
  'Watch the live countdown and highest bid; late panic bids often overshoot.',
  'If you do not need funds early, you can skip bidding and collect dividends.',
  'Keep installments current — overdue dues can block auction eligibility.',
  'Use the same verified bank account for payouts that you registered in KYC.',
];

export default function BidTips() {
  const navigate = useNavigate();
  return (
    <MarketingPage
      eyebrow="Auctions"
      title="Bidding tips"
      subtitle="Practical habits used by members who treat auctions as a tool, not a gamble."
      narrow
    >
      {TIPS.map((t) => (
        <Typography key={t} color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
          · {t}
        </Typography>
      ))}
      <Stack direction="row" spacing={1.5} mt={1}>
        <Button variant="contained" onClick={() => navigate('/login')}>Login to auctions</Button>
        <Button variant="outlined" onClick={() => navigate('/auctions-info')}>Auction overview</Button>
      </Stack>
    </MarketingPage>
  );
}
