import React from 'react';
import { Box, Button, Typography, Grid, Stack } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const LINKS = [
  {
    title: 'FAQs',
    desc: 'Answers about chits, KYC, payments, auctions, and multiple groups.',
    path: '/support-center/faq',
  },
  {
    title: 'Contact us',
    desc: 'Email, phone, Hyderabad office hours, and WhatsApp.',
    path: '/support-center/contact',
  },
];

export default function SupportIndex() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Support"
      title="Support center"
      subtitle="Help before and after login — FAQs for quick answers, contact options when you need a person."
    >
      <Grid container spacing={2.5} mb={4}>
        {LINKS.map((l) => (
          <Grid item xs={12} sm={6} key={l.path}>
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
              <Button size="small" sx={{ px: 0 }}>Open</Button>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: brand.canvas,
          border: `1px solid ${brand.line}`,
        }}
      >
        <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Logged-in members</Typography>
        <Typography variant="body2" color="text.secondary" lineHeight={1.7} mb={2}>
          For payment disputes, auction issues, or document requests, login and open a ticket from the Support page in your dashboard.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" onClick={() => navigate('/login')}>Member login</Button>
          <Button component={RouterLink} to="/terms">Terms of Service</Button>
          <Button component={RouterLink} to="/privacy-policy">Privacy Policy</Button>
        </Stack>
      </Box>
    </MarketingPage>
  );
}
