import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

export default function FamilyMarketing() {
  const navigate = useNavigate();
  return (
    <MarketingPage
      eyebrow="Members"
      title="Family accounts"
      subtitle="One primary login can switch into verified family member profiles — so household chits stay organised."
      narrow
    >
      <Typography color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
        After you register, open Family Members in the portal. Add a relative with their details and OTP
        verification. Then use the member switcher in the top bar to view that person’s chits, payments,
        and auctions without sharing passwords.
      </Typography>
      <Typography color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
        Each profile still needs its own KYC where required. Switching never mixes payments across members.
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <Button variant="contained" onClick={() => navigate('/register')}>Create account</Button>
        <Button variant="outlined" onClick={() => navigate('/login')}>Login</Button>
      </Stack>
    </MarketingPage>
  );
}
