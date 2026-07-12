import React from 'react';
import {
  Box, Button, Grid, Stack, Typography,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  AccountBalanceWallet as WalletIcon,
  VerifiedUser as ShieldIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { marketingShellSx } from '../../components/marketing/marketingShell';

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

const FEATURES = [
  { icon: <ShieldIcon fontSize="small" />, title: 'KYC once', text: 'DigiLocker and bank verification before you invest — completed once for every group.' },
  { icon: <WalletIcon fontSize="small" />, title: 'Pay on time', text: 'Installments, dues, and receipts stay in one Transactions view you can open anytime.' },
  { icon: <GavelIcon fontSize="small" />, title: 'Bid live', text: 'Join the auction room from web or the mobile app the moment bidding opens.' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <Box>
      {/* Hero — full-width shell; left text under logo, right card under Join Free */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 'auto', md: 'calc(100vh - 70px)' },
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: `
            radial-gradient(ellipse 50% 45% at 90% 10%, rgba(201,162,39,0.12), transparent 55%),
            linear-gradient(160deg, ${brand.navyDeep} 0%, ${brand.navy} 55%, #0E2444 100%)
          `,
        }}
      >
        <Box
          sx={{
            ...marketingShellSx,
            position: 'relative',
            zIndex: 1,
            py: { xs: 5, md: 7 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 4, md: 6 },
          }}
        >
          <Box sx={{ flex: '1 1 0', minWidth: 0, maxWidth: { md: '52%' } }}>
            <Typography
              sx={{
                fontFamily: brand.fontDisplay,
                color: '#fff',
                fontWeight: 600,
                fontSize: { xs: '2.35rem', sm: '2.85rem', md: '3.15rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1.12,
                mb: 1.75,
              }}
            >
              Assure ChitFunds
            </Typography>
            <Typography
              sx={{
                color: brand.goldSoft,
                fontWeight: 600,
                fontSize: { xs: 17, md: 18 },
                letterSpacing: '0.01em',
                mb: 1.5,
                lineHeight: 1.45,
              }}
            >
              Save every month. Bid when you need funds. Track everything online.
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.62)',
                fontSize: 15.5,
                lineHeight: 1.7,
                mb: 3.25,
                maxWidth: 520,
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
                sx={{ px: 2.75, py: 1.2, fontWeight: 700 }}
              >
                Create free account
              </Button>
              <Button
                size="large"
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  px: 2.75,
                  py: 1.2,
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  fontWeight: 600,
                  '&:hover': { borderColor: brand.gold, color: brand.goldSoft },
                }}
              >
                Member login
              </Button>
            </Stack>

            <Box
              sx={{
                display: { xs: 'none', md: 'grid' },
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 2.5,
                mt: 5,
                pt: 3.5,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                maxWidth: 520,
              }}
            >
              {[
                { n: '2,400+', l: 'Active members' },
                { n: '₹18Cr+', l: 'Chit value tracked' },
                { n: '99.6%', l: 'On-time payouts' },
              ].map((s) => (
                <Box key={s.l}>
                  <Typography
                    sx={{
                      fontFamily: brand.fontDisplay,
                      fontWeight: 600,
                      fontSize: '1.35rem',
                      color: '#fff',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {s.n}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', mt: 0.35, fontWeight: 500 }}>
                    {s.l}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ flex: '0 1 420px', width: '100%', maxWidth: { xs: '100%', md: 440 } }}>
            <Box
              sx={{
                borderRadius: 2.5,
                border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: 'rgba(255,255,255,0.03)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  px: { xs: 2.5, md: 3 },
                  py: 1.75,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(0,0,0,0.18)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: brand.goldSoft,
                  }}
                >
                  Why members stay
                </Typography>
              </Box>
              {FEATURES.map((row, i) => (
                <Box
                  key={row.title}
                  sx={{
                    display: 'flex',
                    gap: 1.75,
                    alignItems: 'flex-start',
                    px: { xs: 2.5, md: 3 },
                    py: 2.25,
                    borderBottom: i < FEATURES.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  }}
                >
                  <Box
                    sx={{
                      color: brand.goldSoft,
                      width: 36,
                      height: 36,
                      borderRadius: 1.25,
                      border: '1px solid rgba(201,162,39,0.28)',
                      bgcolor: 'rgba(201,162,39,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {row.icon}
                  </Box>
                  <Box>
                    <Typography fontWeight={700} color="#fff" fontSize={14.5} letterSpacing="-0.01em">
                      {row.title}
                    </Typography>
                    <Typography fontSize={13.25} sx={{ color: 'rgba(255,255,255,0.52)', mt: 0.4, lineHeight: 1.55 }}>
                      {row.text}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ py: { xs: 6.5, md: 8 }, bgcolor: '#fff' }}>
        <Box sx={marketingShellSx}>
          <Typography variant="overline" sx={{ color: brand.goldDark }}>How it works</Typography>
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              fontWeight: 600,
              fontSize: { xs: '1.65rem', md: '2rem' },
              color: brand.navy,
              letterSpacing: '-0.015em',
              mb: 1,
            }}
          >
            Three steps to your first chit
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 500, fontSize: 15.5, lineHeight: 1.65 }}>
            No long scroll of features — just the path members actually take.
          </Typography>
          <Grid container spacing={2.5}>
            {STEPS.map((s) => (
              <Grid item xs={12} md={4} key={s.n}>
                <Box
                  sx={{
                    height: '100%',
                    p: 3,
                    borderRadius: 2,
                    border: `1px solid ${brand.line}`,
                    bgcolor: brand.canvas,
                  }}
                >
                  <Typography sx={{ color: brand.goldDark, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', mb: 1.5 }}>
                    {s.n}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 16.5, mb: 1, color: brand.navy }}>{s.title}</Typography>
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
        </Box>
      </Box>

      <Box sx={{ py: { xs: 6.5, md: 8 }, bgcolor: brand.canvas }}>
        <Box sx={marketingShellSx}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-end" flexWrap="wrap" gap={2} mb={3.5}>
            <Box>
              <Typography variant="overline" sx={{ color: brand.goldDark }}>Chit plans</Typography>
              <Typography
                sx={{
                  fontFamily: brand.fontDisplay,
                  fontWeight: 600,
                  fontSize: { xs: '1.65rem', md: '2rem' },
                  color: brand.navy,
                  letterSpacing: '-0.015em',
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
                    borderRadius: 2,
                    bgcolor: '#fff',
                    border: `1px solid ${brand.line}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(201,162,39,0.45)',
                      boxShadow: brand.shadowSoft,
                    },
                  }}
                >
                  <Typography variant="overline" sx={{ color: brand.muted }}>{p.name}</Typography>
                  <Typography
                    sx={{
                      fontFamily: brand.fontDisplay,
                      fontWeight: 600,
                      fontSize: '1.45rem',
                      color: brand.navy,
                      my: 0.75,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {p.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.6}>{p.hint}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      <Box sx={{ py: { xs: 5.5, md: 6.5 }, bgcolor: '#fff', borderTop: `1px solid ${brand.line}` }}>
        <Box sx={marketingShellSx}>
          <Typography
            textAlign="center"
            sx={{
              fontFamily: brand.fontDisplay,
              fontWeight: 600,
              fontSize: '1.4rem',
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
                  <Typography variant="caption" fontWeight={600} display="block">{t.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box textAlign="center" mt={3}>
            <Button onClick={() => navigate('/company/trust')}>See trust & compliance</Button>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          py: { xs: 6, md: 7.5 },
          background: `linear-gradient(135deg, ${brand.navyDeep}, ${brand.navy})`,
          textAlign: 'center',
        }}
      >
        <Box sx={{ ...marketingShellSx, maxWidth: 560 }}>
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              color: '#fff',
              fontWeight: 600,
              fontSize: { xs: '1.65rem', md: '1.95rem' },
              letterSpacing: '-0.015em',
              mb: 1.5,
            }}
          >
            Ready when you are
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.62)', mb: 3, lineHeight: 1.7, fontSize: 15.5 }}>
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
              sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
            >
              Read FAQs
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
