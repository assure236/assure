import React from 'react';
import { Box, Button, Typography, Grid, Stack, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const BADGES = [
  { src: '/assets/images/trusted_dpiit.png', label: 'DPIIT registered startup' },
  { src: '/assets/images/trusted_telangana.png', label: 'Telangana registered' },
  { src: '/assets/images/trusted_data_secured.png', label: 'Data security practices' },
];

const SAFEGUARDS = [
  {
    title: 'Registered company operations',
    body: 'Assure ChitFunds operates as a registered entity with chit fund activities conducted in line with applicable law. Group terms, installment schedules, and auction rules are documented before members enroll.',
  },
  {
    title: 'KYC and member verification',
    body: 'Members complete identity verification through DigiLocker, face match, bank account validation, and address proof. Enrollment is blocked until mandatory checks are satisfied.',
  },
  {
    title: 'Auction records',
    body: 'Each monthly auction records bids, the winning discount, payout to the prize winner, and dividend distribution to other members. Members can review outcomes in the portal after the session closes.',
  },
  {
    title: 'Chit Fund Act awareness',
    body: 'Chit funds in India are governed by state-level regulation under the Chit Funds Act. We maintain registration requirements, prescribed formats, and member disclosures as applicable to our operations. This page is informational — refer to your group agreement and Terms of Service for binding terms.',
  },
];

export default function TrustCompliance() {
  return (
    <MarketingPage
      eyebrow="Company"
      title="Trust & compliance"
      subtitle="How Assure handles registration, member verification, and auction records — stated plainly, without overstating guarantees."
    >
      <Grid container spacing={3} justifyContent="center" mb={5}>
        {BADGES.map((b) => (
          <Grid item xs={4} sm={3} key={b.label}>
            <Box textAlign="center">
              <Box
                component="img"
                src={b.src}
                alt={b.label}
                sx={{ height: 56, objectFit: 'contain', mb: 1 }}
              />
              <Typography variant="caption" fontWeight={700} display="block" sx={{ color: brand.navy }}>
                {b.label}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Stack spacing={2.5}>
        {SAFEGUARDS.map((s) => (
          <Box
            key={s.title}
            sx={{
              p: 3,
              borderRadius: 3,
              border: `1px solid ${brand.line}`,
              bgcolor: '#fff',
            }}
          >
            <Typography variant="h6" sx={{ color: brand.navy, mb: 1 }}>{s.title}</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75}>{s.body}</Typography>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ my: 4, borderColor: brand.line }} />

      <Typography variant="body2" color="text.secondary" lineHeight={1.75} mb={2}>
        Chit funds involve financial commitment across the full tenure of a group. Returns depend on auction outcomes, timely payments by all members, and applicable company charges. Read the plan details and legal documents before enrolling.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button component={RouterLink} to="/terms" variant="contained">
          Terms of Service
        </Button>
        <Button component={RouterLink} to="/privacy-policy" variant="outlined">
          Privacy Policy
        </Button>
      </Stack>
    </MarketingPage>
  );
}
