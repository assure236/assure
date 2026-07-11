import React from 'react';
import { Box, Button, Typography, Grid, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const LINKS = [
  {
    title: 'Our story',
    desc: 'Hyderabad roots, digital member portal, and our mission.',
    path: '/company/our-story',
  },
  {
    title: 'Why Assure',
    desc: 'KYC, live auctions, transactions, family members, and support.',
    path: '/company/why-assure',
  },
  {
    title: 'Trust & compliance',
    desc: 'Registration, verification, auction records, and legal links.',
    path: '/company/trust',
  },
];

export default function CompanyIndex() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Company"
      title="About Assure"
      subtitle="Learn who we are, what members get from the portal, and how we approach compliance."
    >
      <Grid container spacing={2.5}>
        {LINKS.map((l) => (
          <Grid item xs={12} md={4} key={l.path}>
            <Box
              onClick={() => navigate(l.path)}
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
              <Typography variant="h6" sx={{ color: brand.navy, mb: 1 }}>{l.title}</Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.7} mb={2}>{l.desc}</Typography>
              <Button size="small" sx={{ px: 0 }}>Read more</Button>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={4}>
        <Button variant="contained" color="secondary" onClick={() => navigate('/register')}>
          Join Assure
        </Button>
        <Button onClick={() => navigate('/company/our-story')}>Start with our story</Button>
      </Stack>
    </MarketingPage>
  );
}
