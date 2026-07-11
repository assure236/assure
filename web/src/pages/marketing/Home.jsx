import React from 'react';
import {
  Box, Button, Container, Grid, Stack, Typography,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  AccountBalanceWallet as WalletIcon,
  VerifiedUser as ShieldIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';

const STEPS = [
  {
    n: '01',
    title: 'Create your account',
    body: 'Register with your mobile number, complete DigiLocker KYC, and add bank details once.',
  },
  {
    n: '02',
    title: 'Join a chit that fits',
    body: 'Pick a plan by installment and tenure. Enroll only when KYC and profile checks are complete.',
  },
  {
    n: '03',
    title: 'Pay, bid, and track',
    body: 'Pay monthly installments, join live auctions when you need funds early, and watch dividends credit automatically.',
  },
];

const PLANS = [
  { name: 'Starter', value: '₹25,000 – ₹1L', hint: 'Smaller commitments to begin disciplined saving' },
  { name: 'Growth', value: '₹2L – ₹5L', hint: 'Popular mid-range groups for family goals' },
  { name: 'Prime', value: '₹5L+', hint: 'Larger ticket groups for bigger milestones' },
];

const TRUST = [
  { src: '/assets/images/trusted_dpiit.png', label: 'DPIIT registered' },
  { src: '/assets/images/trusted_telangana.png', label: 'Telangana registered' },
  { src: '/assets/images/trusted_data_secured.png', label: 'Data secured' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <Box>
      {/* Hero — one composition, brand first */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: '88vh', md: '92vh' },
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: `
            radial-gradient(ellipse 55% 50% at 85% 20%, rgba(201,162,39,0.22), transparent 55%),
            radial-gradient(ellipse 45% 40% at 5% 80%, rgba(30,58,138,0.28), transparent 50%),
            linear-gradient(155deg, #040b18 0%, ${brand.navyDeep} 35%, ${brand.navy} 70%, #0a1830 100%)
          `,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            pointerEvents: 'none',
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 8, md: 10 } }}>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography
                sx={{
                  fontFamily: brand.fontDisplay,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: { xs: '2.6rem', sm: '3.4rem', md: '3.85rem' },
                  letterSpacing: '-0.035em',
                  lineHeight: 1.05,
                  mb: 2,
                }}
              >
                Assure ChitFunds
              </Typography>
              <Typography
                sx={{
                  color: brand.goldSoft,
                  fontWeight: 700,
                  fontSize: { xs: 18, md: 20 },
                  letterSpacing: '-0.01em',
                  mb: 1.5,
                }}
              >
                Save every month. Bid when you need funds. Track everything online.
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.68)',
                  fontSize: 16,
                  lineHeight: 1.7,
                  maxWidth: 480,
                  mb: 3.5,
                }}
              >
                A member portal for transparent chit groups — clear installments, live auctions, and payouts you can follow without chasing paperwork.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  size="large"
                  variant="contained"
                  color="secondary"
                  endIcon={<ArrowIcon />}
                  onClick={() => navigate('/register')}
                  sx={{ px: 3, py: 1.35, fontWeight: 800 }}
                >
                  Create free account
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={() => navigate('/login')}
                  sx={{
                    px: 3,
                    py: 1.35,
                    borderColor: 'rgba(255,255,255,0.35)',
                    color: '#fff',
                    fontWeight: 700,
                    '&:hover': { borderColor: brand.gold, color: brand.goldSoft },
                  }}
                >
                  Member login
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  borderRadius: 4,
                  border: '1px solid rgba(201,162,39,0.25)',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  p: { xs: 2.5, md: 3 },
                  backdropFilter: 'blur(8px)',
                }}
              >
                {[
                  { icon: <ShieldIcon />, title: 'KYC once', text: 'DigiLocker + bank verification before you invest' },
                  { icon: <WalletIcon />, title: 'Pay on time', text: 'Installments, dues, and receipts in one Transactions view' },
                  { icon: <GavelIcon />, title: 'Bid live', text: 'Join the auction room from web or the mobile app' },
                ].map((row) => (
                  <Box
                    key={row.title}
                    sx={{
                      display: 'flex',
                      gap: 1.75,
                      alignItems: 'flex-start',
                      py: 1.75,
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      '&:last-child': { borderBottom: 'none', pb: 0 },
                      '&:first-of-type': { pt: 0 },
                    }}
                  >
                    <Box sx={{ color: brand.goldSoft, mt: 0.25 }}>{row.icon}</Box>
                    <Box>
                      <Typography fontWeight={800} color="#fff" fontSize={15}>{row.title}</Typography>
                      <Typography fontSize={13.5} sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.35, lineHeight: 1.5 }}>
                        {row.text}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* How it works — one job */}
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: '#fff' }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: brand.goldDark }}>How it works</Typography>
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              fontWeight: 600,
              fontSize: { xs: '1.75rem', md: '2.15rem' },
              color: brand.navy,
              letterSpacing: '-0.02em',
              mb: 1,
            }}
          >
            Three steps to your first chit
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 520 }}>
            No long scroll of features — just the path members actually take.
          </Typography>
          <Grid container spacing={2.5}>
            {STEPS.map((s) => (
              <Grid item xs={12} md={4} key={s.n}>
                <Box
                  sx={{
                    height: '100%',
                    p: 3,
                    borderRadius: 3,
                    border: `1px solid ${brand.line}`,
                    bgcolor: brand.canvas,
                  }}
                >
                  <Typography sx={{ color: brand.goldDark, fontWeight: 800, fontSize: 13, mb: 1.5 }}>
                    {s.n}
                  </Typography>
                  <Typography variant="h6" sx={{ mb: 1 }}>{s.title}</Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                    {s.body}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Button
            sx={{ mt: 3 }}
            endIcon={<ArrowIcon />}
            onClick={() => navigate('/plans/how-chits-work')}
          >
            Read the full walkthrough
          </Button>
        </Container>
      </Box>

      {/* Plans preview */}
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: brand.canvas }}>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="space-between" alignItems="flex-end" flexWrap="wrap" gap={2} mb={3.5}>
            <Box>
              <Typography variant="overline" sx={{ color: brand.goldDark }}>Chit plans</Typography>
              <Typography
                sx={{
                  fontFamily: brand.fontDisplay,
                  fontWeight: 600,
                  fontSize: { xs: '1.75rem', md: '2.15rem' },
                  color: brand.navy,
                  letterSpacing: '-0.02em',
                }}
              >
                Choose by what you can save monthly
              </Typography>
            </Box>
            <Button variant="contained" onClick={() => navigate('/plans')} endIcon={<ArrowIcon />}>
              Browse all plans
            </Button>
          </Box>
          <Grid container spacing={2}>
            {PLANS.map((p) => (
              <Grid item xs={12} md={4} key={p.name}>
                <Box
                  onClick={() => navigate('/plans')}
                  sx={{
                    p: 3,
                    height: '100%',
                    borderRadius: 3,
                    bgcolor: '#fff',
                    border: `1px solid ${brand.line}`,
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                    '&:hover': { transform: 'translateY(-3px)', borderColor: 'rgba(201,162,39,0.5)' },
                  }}
                >
                  <Typography variant="overline" sx={{ color: brand.muted }}>{p.name}</Typography>
                  <Typography
                    sx={{
                      fontFamily: brand.fontDisplay,
                      fontWeight: 600,
                      fontSize: '1.55rem',
                      color: brand.navy,
                      my: 0.75,
                    }}
                  >
                    {p.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{p.hint}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Trust — single strip, no carousel spam */}
      <Box sx={{ py: { xs: 6, md: 7 }, bgcolor: '#fff', borderTop: `1px solid ${brand.line}` }}>
        <Container maxWidth="lg">
          <Typography
            textAlign="center"
            sx={{
              fontFamily: brand.fontDisplay,
              fontWeight: 600,
              fontSize: '1.5rem',
              color: brand.navy,
              mb: 3,
            }}
          >
            Built for trust, not noise
          </Typography>
          <Grid container spacing={2} justifyContent="center">
            {TRUST.map((t) => (
              <Grid item xs={4} sm={3} key={t.label}>
                <Box textAlign="center">
                  <Box component="img" src={t.src} alt={t.label} sx={{ height: 48, objectFit: 'contain', mb: 1 }} />
                  <Typography variant="caption" fontWeight={700} display="block">{t.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box textAlign="center" mt={3}>
            <Button onClick={() => navigate('/company/trust')}>See trust & compliance</Button>
          </Box>
        </Container>
      </Box>

      {/* Closing CTA */}
      <Box
        sx={{
          py: { xs: 6, md: 8 },
          background: `linear-gradient(135deg, ${brand.navyDeep}, ${brand.navy})`,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="sm">
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              color: '#fff',
              fontWeight: 600,
              fontSize: { xs: '1.75rem', md: '2.1rem' },
              letterSpacing: '-0.02em',
              mb: 1.5,
            }}
          >
            Ready when you are
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 3, lineHeight: 1.7 }}>
            Open your member account, finish KYC, and enroll in a group from the same portal you will use every month.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
            <Button size="large" variant="contained" color="secondary" onClick={() => navigate('/register')}>
              Join Assure
            </Button>
            <Button
              size="large"
              variant="outlined"
              onClick={() => navigate('/support-center/faq')}
              sx={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}
            >
              Read FAQs
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
