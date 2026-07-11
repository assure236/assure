import React from 'react';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const CARDS = [
  { title: 'Member Login', path: '/login', body: 'Pay, bid, and track from the web portal.' },
  { title: 'Create Account', path: '/register', body: 'Start KYC and unlock enrollment.' },
  { title: 'Refer & Earn', path: '/learn/refer', body: 'Earn ₹500 to wallet when a friend joins a chit.' },
  { title: 'Family Accounts', path: '/members/family', body: 'Switch profiles for family chits on one login.' },
];

export default function MembersHub() {
  const navigate = useNavigate();
  return (
    <MarketingPage
      eyebrow="Members"
      title="Built for everyday members"
      subtitle="Login when you are ready — the same account works on web and the Assure mobile app."
      actions={
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" color="secondary" onClick={() => navigate('/login')}>Login</Button>
          <Button variant="outlined" onClick={() => navigate('/register')} sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
            Join free
          </Button>
        </Stack>
      }
    >
      <Grid container spacing={2}>
        {CARDS.map((c) => (
          <Grid item xs={12} sm={6} key={c.path}>
            <Box
              onClick={() => navigate(c.path)}
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
              <Typography fontWeight={800} color={brand.navy}>{c.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{c.body}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </MarketingPage>
  );
}
