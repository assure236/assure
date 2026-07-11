import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

export default function GroupStatus() {
  const navigate = useNavigate();
  return (
    <MarketingPage
      eyebrow="Schemes"
      title="Vacant vs active groups"
      subtitle="Knowing the status of a group helps you enroll at the right time."
      narrow
    >
      <Typography variant="h6" gutterBottom>Vacant / filling</Typography>
      <Typography color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
        Seats are still open. You can enroll after KYC and profile checks pass. The group starts when
        membership is complete and the commencement schedule is set.
      </Typography>
      <Typography variant="h6" gutterBottom>Active</Typography>
      <Typography color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
        The chit is running — installments and auctions follow the group calendar. New seats appear only
        if the company opens a vacant replacement or a new group.
      </Typography>
      <Typography variant="h6" gutterBottom>Starting soon</Typography>
      <Typography color="text.secondary" paragraph sx={{ lineHeight: 1.75 }}>
        Enrollment may be closed while documents and first dues are finalised. Watch New Chits in the
        portal for the live list.
      </Typography>
      <Stack direction="row" spacing={1.5} mt={2}>
        <Button variant="contained" onClick={() => navigate('/login')}>Login to browse groups</Button>
        <Button variant="outlined" onClick={() => navigate('/plans')}>Back to plans</Button>
      </Stack>
    </MarketingPage>
  );
}
