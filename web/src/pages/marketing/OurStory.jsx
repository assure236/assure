import React from 'react';
import { Box, Button, Typography, Grid, Stack, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const TIMELINE = [
  { year: '2020', title: 'Founded in Hyderabad', body: 'Assure ChitFunds began with a simple goal: bring chit fund operations online for members who wanted clarity without visiting an office every month.' },
  { year: '2022', title: 'Member portal launched', body: 'Installments, auction schedules, and transaction history moved into one web portal — reducing paperwork and missed reminders.' },
  { year: '2024', title: 'Live auctions on web & app', body: 'Members could join auction rooms in real time, see bids as they happened, and receive dividend credits without manual follow-up.' },
  { year: 'Today', title: 'Digital-first, locally rooted', body: 'We serve Hyderabad and Telangana members with registered operations, DigiLocker KYC, and support during business hours.' },
];

export default function OurStory() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Company"
      title="Our story"
      subtitle="A Hyderabad-based digital chit platform built for members who want transparent auctions and a portal they can actually use."
    >
      <Grid container spacing={4}>
        <Grid item xs={12} md={7}>
          <Typography variant="h6" sx={{ color: brand.navy, mb: 1.5 }}>Who we are</Typography>
          <Typography color="text.secondary" lineHeight={1.8} mb={2}>
            Assure ChitFunds is a member-focused chit fund platform operating from Hyderabad, Telangana. We combine registered chit group operations with a digital member portal — so you can enroll, pay installments, join auctions, and track payouts without relying on scattered messages or paper receipts.
          </Typography>
          <Typography color="text.secondary" lineHeight={1.8}>
            Our team includes operations staff who understand local chit practices and engineers who maintain the portal members use every month. That combination keeps the process practical, not promotional.
          </Typography>
        </Grid>
        <Grid item xs={12} md={5}>
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: brand.canvas,
              border: `1px solid ${brand.line}`,
            }}
          >
            <Typography variant="overline" sx={{ color: brand.goldDark }}>Mission</Typography>
            <Typography sx={{ fontFamily: brand.fontDisplay, fontWeight: 600, fontSize: '1.35rem', color: brand.navy, mb: 1.5 }}>
              Transparent auctions. A portal members trust.
            </Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
              Every group should have clear installment schedules, recorded auction outcomes, and a single place to view transactions — before, during, and after you need funds from a chit.
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 5, borderColor: brand.line }} />

      <Typography variant="overline" sx={{ color: brand.goldDark, display: 'block', mb: 2 }}>Timeline</Typography>
      <Stack spacing={2}>
        {TIMELINE.map((item) => (
          <Box
            key={item.year}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '100px 1fr' },
              gap: 2,
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${brand.line}`,
              bgcolor: '#fff',
            }}
          >
            <Typography fontWeight={800} sx={{ color: brand.goldDark }}>{item.year}</Typography>
            <Box>
              <Typography fontWeight={700} sx={{ color: brand.navy, mb: 0.5 }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{item.body}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={4}>
        <Button variant="contained" color="secondary" onClick={() => navigate('/company/why-assure')}>
          Why choose Assure
        </Button>
        <Button onClick={() => navigate('/company/trust')}>Trust & compliance</Button>
      </Stack>
    </MarketingPage>
  );
}
