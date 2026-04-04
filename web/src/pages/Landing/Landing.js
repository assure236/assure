import React, { useEffect, useState } from 'react';
import {
  Box, Container, Grid, Typography, Button, Card, CardContent,
  AppBar, Toolbar, Chip, Avatar, List, ListItem, ListItemIcon, ListItemText,
  Divider, IconButton, useMediaQuery, Fade
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingIcon,
  Groups as GroupsIcon,
  Gavel as GavelIcon,
  AccountBalance as BankIcon,
  ArrowForward as ArrowIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Star as StarIcon,
  Shield as ShieldIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// ─── BRAND COLORS ───
const NAVY    = '#0B1F3B';
const ROYAL   = '#1E3A8A';
const GOLD    = '#D4AF37';
const GOLD_LT = '#E3C668';
const BG      = '#F8F9FB';

const SCHEMES = [
  { name: 'Silver Plan', value: '₹50,000', members: 20, duration: '20 months', monthly: '₹2,500', color: '#64748B', highlight: false },
  { name: 'Gold Plan', value: '₹1,00,000', members: 20, duration: '20 months', monthly: '₹5,000', color: GOLD, highlight: true },
  { name: 'Diamond Plan', value: '₹2,00,000', members: 20, duration: '20 months', monthly: '₹10,000', color: ROYAL, highlight: false },
  { name: 'Platinum Plan', value: '₹5,00,000', members: 20, duration: '20 months', monthly: '₹25,000', color: NAVY, highlight: false },
];

const FEATURES = [
  { icon: <ShieldIcon />, title: 'NIDHI Registered', desc: 'Fully licensed and regulated under the Chit Funds Act. Your investment is legally protected.' },
  { icon: <TrendingIcon />, title: 'High Returns', desc: 'Earn dividends on every auction. Your savings compound and grow consistently.' },
  { icon: <GroupsIcon />, title: 'Trusted Community', desc: '500+ members trust us. Transparent auctions with zero hidden fees.' },
  { icon: <GavelIcon />, title: 'Live Auctions', desc: 'Real-time bidding from your phone or browser. Fair and transparent.' },
  { icon: <BankIcon />, title: 'Instant Disbursals', desc: 'Winning amounts deposited directly to your bank within 24 hours.' },
  { icon: <SpeedIcon />, title: 'Digital KYC', desc: 'Aadhaar + PAN verified in under 5 minutes. Zero paperwork.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Register & KYC', desc: 'Create your account and complete digital KYC in under 5 minutes.' },
  { step: '02', title: 'Choose a Plan', desc: 'Pick a chit plan that fits your monthly budget and savings goal.' },
  { step: '03', title: 'Pay Monthly', desc: 'Pay your installment online every month. Track everything on the dashboard.' },
  { step: '04', title: 'Bid & Win', desc: 'Participate in monthly auctions to win the chit amount at a discount.' },
  { step: '05', title: 'Earn Dividends', desc: 'Even if you don\'t win, you earn dividends from every auction.' },
];

const STATS = [
  { label: 'Active Members', value: '500+' },
  { label: 'Total Disbursed', value: '₹2.5 Cr+' },
  { label: 'Active Groups', value: '28' },
  { label: 'Auctions Done', value: '340+' },
];

// Animated counter hook
const useCounter = (end, duration = 2000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const num = parseInt(end.replace(/[^\d]/g, ''));
    if (!num) return;
    let start = 0;
    const increment = num / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= num) { setCount(num); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  const suffix = end.replace(/[\d,]/g, '');
  return count ? `${count.toLocaleString('en-IN')}${suffix}` : end;
};

const StatCard = ({ label, value }) => {
  const display = useCounter(value);
  return (
    <Card sx={{
      borderRadius: 3, textAlign: 'center', py: 3, px: 2,
      bgcolor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(212,175,55,0.2)',
      transition: 'transform 0.3s, box-shadow 0.3s',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 12px 40px rgba(11,31,59,0.3)` },
    }}>
      <Typography variant="h3" fontWeight={800} sx={{ color: GOLD, fontSize: { xs: '1.8rem', md: '2.2rem' } }}>{display}</Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>{label}</Typography>
    </Card>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Box sx={{ bgcolor: BG, overflowX: 'hidden' }}>
      {/* ─── NAVBAR ─── */}
      <AppBar position="fixed" sx={{
        bgcolor: scrolled ? 'rgba(11,31,59,0.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        boxShadow: scrolled ? '0 2px 20px rgba(11,31,59,0.15)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <Toolbar sx={{ justifyContent: 'space-between', maxWidth: 1200, mx: 'auto', width: '100%', px: { xs: 2, md: 3 } }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box component="img" src="/logo.png" alt="Assure ChitFunds" sx={{ width: 38, height: 38 }} />
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: 'white', fontSize: 17, letterSpacing: '-0.3px' }}>Assure ChitFunds</Typography>
              <Typography sx={{ color: GOLD, fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>Trusted Since 2020</Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1} alignItems="center">
            {!isMobile && (
              <>
                <Button sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: GOLD } }}
                  onClick={() => document.getElementById('schemes')?.scrollIntoView({ behavior: 'smooth' })}>Plans</Button>
                <Button sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: GOLD } }}
                  onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it Works</Button>
              </>
            )}
            <Button variant="outlined" size="small" onClick={() => navigate('/login')}
              sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', '&:hover': { borderColor: GOLD, color: GOLD } }}>
              Login
            </Button>
            <Button variant="contained" size="small" onClick={() => navigate('/register')}
              sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, '&:hover': { bgcolor: GOLD_LT } }}>
              Get Started
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ─── HERO ─── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #0D2B52 40%, ${ROYAL} 100%)`,
        pt: { xs: 14, md: 18 }, pb: { xs: 10, md: 14 },
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <Box sx={{
          position: 'absolute', top: -100, right: -100, width: 400, height: 400,
          borderRadius: '50%', background: `radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)`,
        }} />
        <Box sx={{
          position: 'absolute', bottom: -80, left: -80, width: 300, height: 300,
          borderRadius: '50%', background: `radial-gradient(circle, rgba(30,58,138,0.25) 0%, transparent 70%)`,
        }} />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Fade in timeout={800}>
                <Box>
                  <Chip
                    icon={<SecurityIcon sx={{ color: `${GOLD} !important`, fontSize: 16 }} />}
                    label="NIDHI Registered • Government Approved"
                    sx={{
                      bgcolor: 'rgba(212,175,55,0.12)', color: GOLD, mb: 3,
                      border: `1px solid rgba(212,175,55,0.25)`, fontWeight: 600, fontSize: 12,
                    }}
                  />
                  <Typography variant="h1" fontWeight={800} sx={{
                    color: 'white', fontSize: { xs: '2.4rem', md: '3.8rem' },
                    lineHeight: 1.15, mb: 3, letterSpacing: '-1px',
                  }}>
                    Smart Savings.<br />
                    Transparent Auctions.<br />
                    <Box component="span" sx={{
                      background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LT})`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>Guaranteed Returns.</Box>
                  </Typography>
                  <Typography variant="h6" sx={{
                    color: 'rgba(255,255,255,0.7)', fontWeight: 400, mb: 4,
                    maxWidth: 520, lineHeight: 1.6, fontSize: { xs: 15, md: 18 },
                  }}>
                    Join India's most trusted digital chit fund platform.
                    Start with as low as ₹2,500/month and build wealth the smarter way.
                  </Typography>
                  <Box display="flex" gap={2} flexWrap="wrap" justifyContent={{ xs: 'center', md: 'flex-start' }}>
                    <Button variant="contained" size="large" onClick={() => navigate('/register')}
                      endIcon={<ArrowIcon />}
                      sx={{
                        bgcolor: GOLD, color: NAVY, fontWeight: 700, px: 4, py: 1.5,
                        borderRadius: 3, fontSize: 16,
                        boxShadow: `0 4px 20px rgba(212,175,55,0.4)`,
                        '&:hover': { bgcolor: GOLD_LT, boxShadow: `0 6px 30px rgba(212,175,55,0.5)` },
                      }}>
                      Start Saving Today
                    </Button>
                    <Button variant="outlined" size="large"
                      onClick={() => document.getElementById('schemes')?.scrollIntoView({ behavior: 'smooth' })}
                      sx={{
                        borderColor: 'rgba(255,255,255,0.25)', color: 'white', px: 4, py: 1.5,
                        borderRadius: 3, fontSize: 16,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.5)' },
                      }}>
                      View Plans
                    </Button>
                  </Box>
                </Box>
              </Fade>
            </Grid>
            <Grid item xs={12} md={5}>
              <Grid container spacing={2}>
                {STATS.map((stat, i) => (
                  <Grid item xs={6} key={i}>
                    <StatCard {...stat} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── TRUST BAR ─── */}
      <Box sx={{ bgcolor: 'white', py: 3, borderBottom: '1px solid #E2E8F0' }}>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="center" alignItems="center" gap={4} flexWrap="wrap">
            {['RBI Compliant', 'Chit Funds Act 1982', '256-bit SSL Encrypted', '100% Safe & Transparent'].map((t, i) => (
              <Box key={i} display="flex" alignItems="center" gap={0.75}>
                <CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500, fontSize: 13 }}>{t}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ─── FEATURES ─── */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 10 } }}>
        <Box textAlign="center" mb={6}>
          <Chip label="WHY CHOOSE US" size="small" sx={{ bgcolor: `${GOLD}15`, color: GOLD, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
          <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
            Why Assure ChitFunds?
          </Typography>
          <Typography sx={{ color: '#64748B', maxWidth: 520, mx: 'auto', fontSize: 16 }}>
            Safe, transparent, and high-returning chit fund investments backed by decades of trust
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {FEATURES.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{
                borderRadius: 3, height: '100%', border: '1px solid #E2E8F0',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-6px)', boxShadow: `0 16px 48px rgba(11,31,59,0.08)`, borderColor: GOLD },
              }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{
                    width: 52, height: 52, borderRadius: 2.5,
                    background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, mb: 2.5,
                  }}>
                    {f.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, mb: 1 }}>{f.title}</Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ─── CHIT SCHEMES ─── */}
      <Box id="schemes" sx={{ bgcolor: '#F1F5F9', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Chip label="OUR PLANS" size="small" sx={{ bgcolor: `${ROYAL}15`, color: ROYAL, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              Choose Your Chit Plan
            </Typography>
            <Typography sx={{ color: '#64748B', maxWidth: 520, mx: 'auto', fontSize: 16 }}>
              Pick the plan that matches your financial goals and start building wealth
            </Typography>
          </Box>
          <Grid container spacing={3} justifyContent="center">
            {SCHEMES.map((s, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card sx={{
                  borderRadius: 3, overflow: 'hidden', height: '100%',
                  border: s.highlight ? `2px solid ${GOLD}` : '1px solid #E2E8F0',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-8px)', boxShadow: `0 20px 60px rgba(11,31,59,0.12)` },
                }}>
                  {s.highlight && (
                    <Box sx={{ position: 'absolute', top: 12, right: -30, bgcolor: GOLD, color: NAVY, px: 4, py: 0.3, transform: 'rotate(45deg)', fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
                      POPULAR
                    </Box>
                  )}
                  <Box sx={{ bgcolor: s.color, p: 3.5, color: 'white', textAlign: 'center' }}>
                    <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 2 }}>{s.name}</Typography>
                    <Typography variant="h4" fontWeight={800}>{s.value}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>Chit Value</Typography>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <List dense>
                      {[
                        { label: 'Members', val: s.members },
                        { label: 'Duration', val: s.duration },
                        { label: 'Monthly', val: s.monthly },
                      ].map((item, j) => (
                        <ListItem key={j} disableGutters>
                          <ListItemIcon sx={{ minWidth: 28 }}><CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} /></ListItemIcon>
                          <ListItemText primary={<Box display="flex" justifyContent="space-between"><span style={{ color: '#64748B' }}>{item.label}</span><strong style={{ color: NAVY }}>{item.val}</strong></Box>} />
                        </ListItem>
                      ))}
                    </List>
                    <Button fullWidth variant="contained" onClick={() => navigate('/register')}
                      sx={{
                        mt: 1.5, borderRadius: 2, py: 1,
                        bgcolor: s.highlight ? GOLD : NAVY,
                        color: s.highlight ? NAVY : 'white',
                        fontWeight: 700,
                        '&:hover': { bgcolor: s.highlight ? GOLD_LT : ROYAL },
                      }}>
                      Join Now
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── HOW IT WORKS ─── */}
      <Box id="how" sx={{ py: { xs: 8, md: 10 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Chip label="SIMPLE PROCESS" size="small" sx={{ bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              How It Works
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 16 }}>
              Five simple steps to financial freedom
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {HOW_IT_WORKS.map((h, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Box display="flex" gap={2.5} alignItems="flex-start">
                  <Box sx={{
                    minWidth: 52, height: 52, borderRadius: 2,
                    background: `linear-gradient(135deg, ${GOLD}20, ${GOLD}05)`,
                    border: `1px solid ${GOLD}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography fontWeight={900} sx={{ color: GOLD, fontSize: 18 }}>{h.step}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, mb: 0.5 }}>{h.title}</Typography>
                    <Typography sx={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{h.desc}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── TESTIMONIAL / TRUST ─── */}
      <Box sx={{ bgcolor: '#F1F5F9', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <StarIcon sx={{ color: GOLD, fontSize: 40, mb: 1 }} />
          <Typography variant="h5" fontWeight={700} sx={{ color: NAVY, mb: 2, fontStyle: 'italic', lineHeight: 1.5 }}>
            "Assure ChitFunds made saving effortless. The auctions are transparent and I received my disbursal within 24 hours!"
          </Typography>
          <Typography sx={{ color: GOLD, fontWeight: 700 }}>— Happy Member, Hyderabad</Typography>
        </Container>
      </Box>

      {/* ─── CTA BANNER ─── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)`,
        py: { xs: 8, md: 10 }, textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: -40, right: -40, width: 250, height: 250, borderRadius: '50%', background: `rgba(212,175,55,0.08)` }} />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h3" fontWeight={800} color="white" sx={{ mb: 2, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
            Ready to Start Your Chit Journey?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, fontSize: 17 }}>
            Join 500+ members already building wealth with Assure ChitFunds.
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button variant="contained" size="large" onClick={() => navigate('/register')}
              sx={{
                bgcolor: GOLD, color: NAVY, fontWeight: 700, borderRadius: 3, px: 5, py: 1.5,
                fontSize: 16, boxShadow: `0 4px 20px rgba(212,175,55,0.4)`,
                '&:hover': { bgcolor: GOLD_LT },
              }}>
              Register Free
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/login')}
              sx={{
                borderColor: 'rgba(255,255,255,0.3)', color: 'white', borderRadius: 3, px: 5, py: 1.5, fontSize: 16,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.5)' },
              }}>
              Member Login
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ─── FOOTER ─── */}
      <Box sx={{ bgcolor: NAVY, color: 'white', py: 7 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 36, height: 36 }} />
                <Box>
                  <Typography variant="h6" fontWeight={800}>Assure ChitFunds</Typography>
                  <Typography sx={{ color: GOLD, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Trusted Since 2020</Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2, lineHeight: 1.7 }}>
                India's trusted digital chit fund platform. Safe, transparent, and rewarding.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ color: GOLD }}>Quick Links</Typography>
              {['About Us', 'Our Plans', 'How It Works', 'FAQs', 'Contact Us'].map(link => (
                <Typography key={link} variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.75, cursor: 'pointer', '&:hover': { color: GOLD }, transition: 'color 0.2s' }}>{link}</Typography>
              ))}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ color: GOLD }}>Contact</Typography>
              {[
                { icon: <PhoneIcon fontSize="small" />, text: '+91 98765 43210' },
                { icon: <EmailIcon fontSize="small" />, text: 'support@assurechitfunds.com' },
                { icon: <LocationIcon fontSize="small" />, text: 'Hyderabad, Telangana, India' },
              ].map((c, i) => (
                <Box key={i} display="flex" alignItems="center" gap={1} mb={1.5}>
                  <Box sx={{ color: GOLD, opacity: 0.7 }}>{c.icon}</Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>{c.text}</Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 4 }} />
          <Typography variant="body2" textAlign="center" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            © {new Date().getFullYear()} Assure ChitFunds Pvt. Ltd. All rights reserved. | Registered under Chit Funds Act, 1982.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;
