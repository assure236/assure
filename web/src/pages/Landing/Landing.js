import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Container, Grid, Typography, Button, Card, CardContent,
  AppBar, Toolbar, Chip, List, ListItem, ListItemIcon, ListItemText,
  Divider, IconButton, useMediaQuery, Fade, Dialog,
  TextField, Paper, Menu as MuiMenu, MenuItem, Rating
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  TrendingUp as TrendingIcon,
  Groups as GroupsIcon,
  Gavel as GavelIcon,
  AccountBalance as BankIcon,
  ArrowForward as ArrowIcon,
  ArrowBack as ArrowBackIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Star as StarIcon,
  Shield as ShieldIcon,
  Speed as SpeedIcon,
  Close as CloseIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
  Forest as ForestIcon,
  Lock as LockIcon,
  VerifiedUser as VerifiedIcon,
  CurrencyRupee as RupeeIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';

// ─── BRAND COLORS ───
const NAVY      = '#0B1F3B';
const NAV_BG    = '#061225';
const ROYAL     = '#1E3A8A';
const GOLD      = '#D4AF37';
const GOLD_LT   = '#E3C668';
const BG        = '#F8F9FB';

const SCHEMES = [
  { name: 'Silver Plan', value: '₹50,000', members: 20, duration: '20 months', monthly: '₹2,500', color: '#64748B', highlight: false, tickets: 5, img: '🥈' },
  { name: 'Gold Plan', value: '₹1,00,000', members: 20, duration: '20 months', monthly: '₹5,000', color: GOLD, highlight: true, tickets: 8, img: '🥇' },
  { name: 'Diamond Plan', value: '₹2,00,000', members: 20, duration: '20 months', monthly: '₹10,000', color: ROYAL, highlight: false, tickets: 3, img: '💎' },
  { name: 'Platinum Plan', value: '₹5,00,000', members: 20, duration: '20 months', monthly: '₹25,000', color: NAVY, highlight: false, tickets: 2, img: '👑' },
];

const FEATURES = [
  { icon: <ShieldIcon />, title: 'Registered Company', desc: 'Licensed under the Chit Funds Act 1982. Your money is safe and legally protected.' },
  { icon: <TrendingIcon />, title: 'Earn Every Month', desc: 'Get dividends from every auction. Your savings grow even when you don\'t win.' },
  { icon: <GroupsIcon />, title: 'Growing Community', desc: '500+ members save with us. No hidden fees, everything is open and clear.' },
  { icon: <GavelIcon />, title: 'Live Auctions', desc: 'Bid live from your phone or computer. Fair process, everyone can see the bids.' },
  { icon: <BankIcon />, title: 'Quick Payouts', desc: 'Win money goes straight to your bank within 24 hours. No delays.' },
  { icon: <SpeedIcon />, title: 'Easy KYC', desc: 'Just upload Aadhaar and PAN. Done in 5 minutes, no paperwork needed.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Sign Up', desc: 'Create a free account and verify your identity with Aadhaar & PAN.' },
  { step: '02', title: 'Pick a Plan', desc: 'Choose a chit plan that fits your budget. Plans start from just ₹2,500/month.' },
  { step: '03', title: 'Pay Monthly', desc: 'Pay your monthly amount online. You can track all payments on your dashboard.' },
  { step: '04', title: 'Bid in Auctions', desc: 'Every month, one member wins the full amount through a live auction.' },
  { step: '05', title: 'Get Dividends', desc: 'Even if you don\'t win, you earn money (dividends) from every auction.' },
];

const TESTIMONIALS = [
  { name: 'Rajesh Kumar', location: 'Hyderabad', text: 'I was confused about chit funds before. Assure made it so simple. I got my money within 24 hours after winning the auction!', rating: 5, plan: 'Gold Plan' },
  { name: 'Priya Sharma', location: 'Bangalore', text: 'The best thing is I can see everything on my phone. Payments, auctions, dividends — all in one place. Very transparent.', rating: 5, plan: 'Diamond Plan' },
  { name: 'Mohammed Irfan', location: 'Secunderabad', text: 'I have been saving with Assure for 8 months now. The dividends are great and the team is very helpful whenever I have questions.', rating: 4, plan: 'Silver Plan' },
  { name: 'Lakshmi Devi', location: 'Warangal', text: 'My neighbor told me about Assure. Now my whole family saves here. The KYC was done in minutes on the app!', rating: 5, plan: 'Gold Plan' },
  { name: 'Suresh Reddy', location: 'Vijayawada', text: 'I compared many chit fund companies. Assure gives the best dividends and their app makes it very easy to participate in auctions.', rating: 5, plan: 'Platinum Plan' },
];

const STATS = [
  { label: 'Active Members', value: '500+' },
  { label: 'Total Disbursed', value: '₹2.5 Cr+' },
  { label: 'Active Groups', value: '28' },
  { label: 'Auctions Done', value: '340+' },
];

// Income-based plan recommender data
const INCOME_PLANS = [
  { minIncome: 0, maxIncome: 15000, plan: 'Silver Plan', monthly: 2500, value: '₹50,000', tip: 'Start small and build your savings habit. You can always upgrade later.' },
  { minIncome: 15001, maxIncome: 30000, plan: 'Gold Plan', monthly: 5000, value: '₹1,00,000', tip: 'A great balance of savings and returns. Our most popular plan.' },
  { minIncome: 30001, maxIncome: 60000, plan: 'Diamond Plan', monthly: 10000, value: '₹2,00,000', tip: 'Higher savings, higher returns. Build wealth faster.' },
  { minIncome: 60001, maxIncome: Infinity, plan: 'Platinum Plan', monthly: 25000, value: '₹5,00,000', tip: 'Our premium plan for serious savers. Maximum dividends.' },
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [income, setIncome] = useState('');
  const [recommendedPlan, setRecommendedPlan] = useState(null);
  const [mobileMenuEl, setMobileMenuEl] = useState(null);
  const carouselRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Welcome popup on first visit
  useEffect(() => {
    const seen = localStorage.getItem('assure_welcome_seen');
    if (!seen) {
      const timer = setTimeout(() => setShowWelcome(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('assure_welcome_seen', '1');
  };

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Income plan finder
  const findPlan = useCallback(() => {
    const amt = parseInt(income);
    if (!amt || amt < 1) { setRecommendedPlan(null); return; }
    const match = INCOME_PLANS.find(p => amt >= p.minIncome && amt <= p.maxIncome);
    setRecommendedPlan(match || null);
  }, [income]);

  // Carousel scroll
  const scrollCarousel = (dir) => {
    if (!carouselRef.current) return;
    const scrollAmount = 320;
    carouselRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'About Us', to: '/about' },
    { label: 'Learn About Chits', to: '/chit-education' },
    { label: 'Contact Us', to: '/contact' },
  ];

  return (
    <Box sx={{ bgcolor: BG, overflowX: 'hidden' }}>
      {/* ─── WELCOME POPUP ─── */}
      <Dialog open={showWelcome} onClose={closeWelcome} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
        <Box sx={{ background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`, p: 4, textAlign: 'center', position: 'relative' }}>
          <IconButton onClick={closeWelcome} sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.6)' }}>
            <CloseIcon />
          </IconButton>
          <Box sx={{ fontSize: 64, mb: 1 }}>🙏</Box>
          <Typography variant="h4" fontWeight={800} color="white" gutterBottom>
            Welcome to Assure Chit Funds!
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 3, fontSize: 16 }}>
            Save money every month, earn dividends, and win big in auctions. Join 500+ happy members today!
          </Typography>
          <Button variant="contained" size="large" onClick={() => { closeWelcome(); navigate('/register'); }}
            sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, px: 5, py: 1.5, borderRadius: 3, '&:hover': { bgcolor: GOLD_LT } }}>
            Get Started Free
          </Button>
          <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.5)', mt: 2 }}>
            No fees to join. Start with just ₹2,500/month.
          </Typography>
        </Box>
      </Dialog>

      {/* ─── NAVBAR ─── */}
      <AppBar position="fixed" sx={{
        bgcolor: scrolled ? NAV_BG : 'rgba(6,18,37,0.85)',
        backdropFilter: 'blur(12px)',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.3)' : 'none',
        transition: 'all 0.3s ease',
        borderBottom: `1px solid rgba(212,175,55,${scrolled ? '0.15' : '0.08'})`,
      }}>
        <Toolbar sx={{ justifyContent: 'space-between', maxWidth: 1200, mx: 'auto', width: '100%', px: { xs: 2, md: 3 } }}>
          {/* Logo — bigger, clickable to home */}
          <Box display="flex" alignItems="center" gap={1.5} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <Box component="img" src="/logo.png" alt="Assure Chit Funds" sx={{ width: 52, height: 52 }} />
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: 'white', fontSize: 20, letterSpacing: '0.5px' }}>
                Assure <Box component="span" sx={{ color: GOLD }}>Chit Funds</Box>
              </Typography>
            </Box>
          </Box>

          {/* Desktop Nav Links */}
          {!isMobile ? (
            <Box display="flex" gap={0.5} alignItems="center">
              {navLinks.map(link => (
                <Button key={link.label} component={Link} to={link.to}
                  sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500, fontSize: 14, '&:hover': { color: GOLD, bgcolor: 'rgba(212,175,55,0.08)' } }}>
                  {link.label}
                </Button>
              ))}
              <Button sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500, fontSize: 14, '&:hover': { color: GOLD, bgcolor: 'rgba(212,175,55,0.08)' } }}
                onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>
                Our Plans
              </Button>
              <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.15)', mx: 1 }} />
              <Button variant="outlined" size="small" onClick={() => navigate('/login')}
                sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'white', mr: 1, '&:hover': { borderColor: GOLD, color: GOLD } }}>
                Login
              </Button>
              <Button variant="contained" size="small" onClick={() => navigate('/register')}
                sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, '&:hover': { bgcolor: GOLD_LT } }}>
                Get Started
              </Button>
            </Box>
          ) : (
            <Box display="flex" gap={1} alignItems="center">
              <Button variant="contained" size="small" onClick={() => navigate('/register')}
                sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, '&:hover': { bgcolor: GOLD_LT } }}>
                Join
              </Button>
              <IconButton onClick={(e) => setMobileMenuEl(e.currentTarget)} sx={{ color: 'white' }}>
                <MenuIcon />
              </IconButton>
              <MuiMenu anchorEl={mobileMenuEl} open={Boolean(mobileMenuEl)} onClose={() => setMobileMenuEl(null)}
                PaperProps={{ sx: { bgcolor: NAV_BG, color: 'white', minWidth: 200, mt: 1 } }}>
                {navLinks.map(link => (
                  <MenuItem key={link.label} onClick={() => { setMobileMenuEl(null); navigate(link.to); }}
                    sx={{ '&:hover': { bgcolor: 'rgba(212,175,55,0.1)', color: GOLD } }}>
                    {link.label}
                  </MenuItem>
                ))}
                <MenuItem onClick={() => { setMobileMenuEl(null); document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }); }}
                  sx={{ '&:hover': { bgcolor: 'rgba(212,175,55,0.1)', color: GOLD } }}>
                  Our Plans
                </MenuItem>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <MenuItem onClick={() => { setMobileMenuEl(null); navigate('/login'); }}
                  sx={{ '&:hover': { bgcolor: 'rgba(212,175,55,0.1)', color: GOLD } }}>
                  Login
                </MenuItem>
              </MuiMenu>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* ─── HERO ─── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #0D2B52 40%, ${ROYAL} 100%)`,
        pt: { xs: 14, md: 18 }, pb: { xs: 10, md: 14 },
        position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)` }} />
        <Box sx={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, rgba(30,58,138,0.25) 0%, transparent 70%)` }} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Fade in timeout={800}>
                <Box>
                  <Chip icon={<VerifiedIcon sx={{ color: `${GOLD} !important`, fontSize: 16 }} />}
                    label="Registered under Chit Funds Act, 1982"
                    sx={{ bgcolor: 'rgba(212,175,55,0.12)', color: GOLD, mb: 3, border: `1px solid rgba(212,175,55,0.25)`, fontWeight: 600, fontSize: 12 }} />
                  <Typography variant="h1" fontWeight={800} sx={{
                    color: 'white', fontSize: { xs: '2.2rem', md: '3.5rem' }, lineHeight: 1.15, mb: 3, letterSpacing: '-1px',
                  }}>
                    Save Money Every Month.<br />
                    Earn Dividends.<br />
                    <Box component="span" sx={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LT})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      Win Big in Auctions.
                    </Box>
                  </Typography>
                  <Typography variant="h6" sx={{
                    color: 'rgba(255,255,255,0.75)', fontWeight: 400, mb: 4, maxWidth: 540, lineHeight: 1.7, fontSize: { xs: 15, md: 18 },
                  }}>
                    Join Assure Chit Funds and start saving with as little as ₹2,500 per month.
                    Every month one member wins the full amount. Even if you don't win, you earn dividends!
                  </Typography>
                  <Box display="flex" gap={2} flexWrap="wrap" justifyContent={{ xs: 'center', md: 'flex-start' }}>
                    <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />}
                      sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, px: 4, py: 1.5, borderRadius: 3, fontSize: 16, boxShadow: `0 4px 20px rgba(212,175,55,0.4)`, '&:hover': { bgcolor: GOLD_LT, boxShadow: `0 6px 30px rgba(212,175,55,0.5)` } }}>
                      Start Saving Today
                    </Button>
                    <Button variant="outlined" size="large"
                      onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
                      sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'white', px: 4, py: 1.5, borderRadius: 3, fontSize: 16, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.5)' } }}>
                      View Plans
                    </Button>
                  </Box>
                </Box>
              </Fade>
            </Grid>
            <Grid item xs={12} md={5}>
              <Grid container spacing={2}>
                {STATS.map((stat, i) => (
                  <Grid item xs={6} key={i}><StatCard {...stat} /></Grid>
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
            {['Chit Funds Act 1982', '256-bit SSL Encrypted', '100% Transparent', 'Quick Payouts'].map((t, i) => (
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
            Why People Choose Assure?
          </Typography>
          <Typography sx={{ color: '#64748B', maxWidth: 520, mx: 'auto', fontSize: 16 }}>
            Simple, safe, and rewarding. Here's what makes us different.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {FEATURES.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{
                borderRadius: 3, height: '100%', border: '1px solid #E2E8F0', transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-6px)', boxShadow: `0 16px 48px rgba(11,31,59,0.08)`, borderColor: GOLD },
              }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ width: 52, height: 52, borderRadius: 2.5, background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, mb: 2.5 }}>
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

      {/* ─── INCOME-BASED CHIT FINDER ─── */}
      <Box sx={{ bgcolor: '#F1F5F9', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="md">
          <Box textAlign="center" mb={5}>
            <Chip label="FIND YOUR PLAN" size="small" sx={{ bgcolor: `${ROYAL}15`, color: ROYAL, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              Which Plan is Right for You?
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 16 }}>
              Enter your monthly income and we'll suggest the best chit plan for you.
            </Typography>
          </Box>
          <Paper sx={{ p: 4, borderRadius: 4, textAlign: 'center', maxWidth: 500, mx: 'auto' }}>
            <Box display="flex" gap={2} alignItems="flex-end" justifyContent="center" flexWrap="wrap">
              <TextField label="Your Monthly Income (₹)" type="number" value={income} onChange={e => setIncome(e.target.value)}
                sx={{ minWidth: 250 }} InputProps={{ startAdornment: <RupeeIcon sx={{ color: '#94a3b8', mr: 0.5 }} /> }} />
              <Button variant="contained" onClick={findPlan}
                sx={{ bgcolor: NAVY, color: 'white', fontWeight: 700, px: 4, py: 1.5, '&:hover': { bgcolor: ROYAL } }}>
                Find Plan
              </Button>
            </Box>
            {recommendedPlan && (
              <Fade in>
                <Box sx={{ mt: 4, p: 3, borderRadius: 3, bgcolor: `${GOLD}10`, border: `2px solid ${GOLD}` }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: NAVY, mb: 1 }}>
                    We Recommend: {recommendedPlan.plan}
                  </Typography>
                  <Typography sx={{ color: '#64748B', mb: 1, fontSize: 15 }}>
                    Chit Value: <strong>{recommendedPlan.value}</strong> • Monthly: <strong>₹{recommendedPlan.monthly.toLocaleString('en-IN')}</strong>
                  </Typography>
                  <Typography sx={{ color: '#475569', fontSize: 14, mb: 2 }}>{recommendedPlan.tip}</Typography>
                  <Button variant="contained" onClick={() => navigate('/register')}
                    sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, '&:hover': { bgcolor: GOLD_LT } }}>
                    Join This Plan
                  </Button>
                </Box>
              </Fade>
            )}
          </Paper>
        </Container>
      </Box>

      {/* ─── CHIT PLANS CAROUSEL ─── */}
      <Box id="plans" sx={{ py: { xs: 8, md: 10 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={4}>
            <Chip label="OUR PLANS" size="small" sx={{ bgcolor: `${ROYAL}15`, color: ROYAL, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              Choose Your Chit Plan
            </Typography>
            <Typography sx={{ color: '#64748B', maxWidth: 480, mx: 'auto', fontSize: 16 }}>
              Swipe through and pick the plan that fits your savings goal
            </Typography>
          </Box>

          {/* Carousel container */}
          <Box sx={{ position: 'relative' }}>
            <IconButton onClick={() => scrollCarousel('left')}
              sx={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 2, bgcolor: 'white', boxShadow: 3, '&:hover': { bgcolor: '#f0f0f0' }, display: { xs: 'none', md: 'flex' } }}>
              <ArrowBackIcon />
            </IconButton>
            <IconButton onClick={() => scrollCarousel('right')}
              sx={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 2, bgcolor: 'white', boxShadow: 3, '&:hover': { bgcolor: '#f0f0f0' }, display: { xs: 'none', md: 'flex' } }}>
              <ArrowIcon />
            </IconButton>

            <Box ref={carouselRef} sx={{
              display: 'flex', gap: 3, overflowX: 'auto', scrollSnapType: 'x mandatory', pb: 2,
              '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#CBD5E1', borderRadius: 3 },
              px: { xs: 0, md: 2 },
            }}>
              {SCHEMES.map((s, i) => (
                <Card key={i} sx={{
                  minWidth: { xs: 280, md: 300 }, scrollSnapAlign: 'start', borderRadius: 3, overflow: 'hidden', flexShrink: 0,
                  border: s.highlight ? `2px solid ${GOLD}` : '1px solid #E2E8F0', position: 'relative',
                  transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-8px)', boxShadow: `0 20px 60px rgba(11,31,59,0.12)` },
                }}>
                  {s.highlight && (
                    <Box sx={{ position: 'absolute', top: 12, right: -30, bgcolor: GOLD, color: NAVY, px: 4, py: 0.3, transform: 'rotate(45deg)', fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
                      POPULAR
                    </Box>
                  )}
                  <Box sx={{ bgcolor: s.color, p: 3.5, color: 'white', textAlign: 'center' }}>
                    <Box sx={{ fontSize: 40, mb: 1 }}>{s.img}</Box>
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
                        { label: 'Tickets Left', val: s.tickets },
                      ].map((item, j) => (
                        <ListItem key={j} disableGutters>
                          <ListItemIcon sx={{ minWidth: 28 }}><CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} /></ListItemIcon>
                          <ListItemText primary={<Box display="flex" justifyContent="space-between"><span style={{ color: '#64748B' }}>{item.label}</span><strong style={{ color: NAVY }}>{item.val}</strong></Box>} />
                        </ListItem>
                      ))}
                    </List>
                    <Button fullWidth variant="contained" onClick={() => navigate('/register')}
                      sx={{ mt: 1.5, borderRadius: 2, py: 1, bgcolor: s.highlight ? GOLD : NAVY, color: s.highlight ? NAVY : 'white', fontWeight: 700, '&:hover': { bgcolor: s.highlight ? GOLD_LT : ROYAL } }}>
                      Apply Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ─── HOW IT WORKS ─── */}
      <Box id="how" sx={{ py: { xs: 8, md: 10 }, bgcolor: '#F1F5F9' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Chip label="SIMPLE STEPS" size="small" sx={{ bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              How Does It Work?
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 16 }}>Just 5 easy steps to start earning</Typography>
          </Box>
          <Grid container spacing={4}>
            {HOW_IT_WORKS.map((h, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Box display="flex" gap={2.5} alignItems="flex-start">
                  <Box sx={{ minWidth: 52, height: 52, borderRadius: 2, background: `linear-gradient(135deg, ${GOLD}20, ${GOLD}05)`, border: `1px solid ${GOLD}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* ─── TESTIMONIALS CAROUSEL ─── */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={5}>
            <Chip label="MEMBER STORIES" size="small" sx={{ bgcolor: `${GOLD}15`, color: GOLD, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              What Our Members Say
            </Typography>
          </Box>

          {/* Active testimonial */}
          <Paper sx={{ maxWidth: 700, mx: 'auto', p: 5, borderRadius: 4, textAlign: 'center', border: `1px solid ${GOLD}30`, position: 'relative', minHeight: 220 }}>
            <StarIcon sx={{ color: GOLD, fontSize: 36, mb: 1 }} />
            <Fade in key={activeTestimonial} timeout={500}>
              <Box>
                <Rating value={TESTIMONIALS[activeTestimonial].rating} readOnly sx={{ mb: 2, '& .MuiRating-iconFilled': { color: GOLD } }} />
                <Typography variant="h6" fontWeight={600} sx={{ color: NAVY, fontStyle: 'italic', lineHeight: 1.6, mb: 2 }}>
                  "{TESTIMONIALS[activeTestimonial].text}"
                </Typography>
                <Typography sx={{ color: GOLD, fontWeight: 700 }}>
                  — {TESTIMONIALS[activeTestimonial].name}, {TESTIMONIALS[activeTestimonial].location}
                </Typography>
                <Chip label={TESTIMONIALS[activeTestimonial].plan} size="small" sx={{ mt: 1, bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 600 }} />
              </Box>
            </Fade>
          </Paper>

          {/* Dots */}
          <Box display="flex" gap={1} justifyContent="center" mt={3}>
            {TESTIMONIALS.map((_, i) => (
              <Box key={i} onClick={() => setActiveTestimonial(i)}
                sx={{
                  width: i === activeTestimonial ? 28 : 10, height: 10, borderRadius: 5,
                  bgcolor: i === activeTestimonial ? GOLD : '#CBD5E1', cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }} />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ─── SECURITY & ELIGIBILITY ─── */}
      <Box sx={{ bgcolor: '#F1F5F9', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Chip label="SAFE & SECURE" size="small" sx={{ bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              Your Money is Safe With Us
            </Typography>
          </Box>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 4, borderRadius: 3, height: '100%' }}>
                <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                  <LockIcon sx={{ color: GOLD, fontSize: 28 }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: NAVY }}>Security Norms</Typography>
                </Box>
                <List>
                  {[
                    'Registered under the Chit Funds Act, 1982',
                    '256-bit SSL encryption on all transactions',
                    'Aadhaar & PAN verified members only',
                    'Monthly audit reports available to members',
                    'Bank-grade security for all payments',
                    'Two-factor authentication on login',
                  ].map((item, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}><CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} /></ListItemIcon>
                      <ListItemText primary={item} primaryTypographyProps={{ fontSize: 14, color: '#475569' }} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 4, borderRadius: 3, height: '100%' }}>
                <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                  <VerifiedIcon sx={{ color: GOLD, fontSize: 28 }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: NAVY }}>Who Can Join?</Typography>
                </Box>
                <Typography variant="subtitle2" sx={{ color: NAVY, mb: 1.5, fontWeight: 700 }}>Regular Chit (up to ₹2,00,000)</Typography>
                <List dense>
                  {['Must be 18 years or older', 'Valid Aadhaar and PAN card', 'Active bank account', 'Stable monthly income'].map((item, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}><CheckIcon sx={{ color: '#16A34A', fontSize: 16 }} /></ListItemIcon>
                      <ListItemText primary={item} primaryTypographyProps={{ fontSize: 13, color: '#475569' }} />
                    </ListItem>
                  ))}
                </List>
                <Typography variant="subtitle2" sx={{ color: NAVY, mt: 2, mb: 1.5, fontWeight: 700 }}>High Value Chit (₹5,00,000+)</Typography>
                <List dense>
                  {['All regular requirements plus:', 'Income proof (salary slip / IT returns)', 'Credit score check', 'Guarantor may be required'].map((item, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}><CheckIcon sx={{ color: GOLD, fontSize: 16 }} /></ListItemIcon>
                      <ListItemText primary={item} primaryTypographyProps={{ fontSize: 13, color: '#475569' }} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── PLANTATION PROGRAM ─── */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: 'white' }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: '#E8F5E9', mb: 2 }}>
            <ForestIcon sx={{ color: '#2E7D32', fontSize: 40 }} />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: NAVY, mb: 2 }}>
            One Member, One Tree 🌱
          </Typography>
          <Typography sx={{ color: '#64748B', maxWidth: 600, mx: 'auto', fontSize: 16, lineHeight: 1.7, mb: 3 }}>
            At Assure Chit Funds, we believe in giving back. For every new member who joins, we plant a tree.
            Together, we're building wealth and a greener future. Be a part of our growing family and our growing forest!
          </Typography>
          <Chip label="100+ Trees Planted" icon={<ForestIcon />} sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700, fontSize: 14, py: 2.5 }} />
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
            Ready to Start Saving?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, fontSize: 17 }}>
            Join 500+ members who save and earn with Assure Chit Funds. It's free to join!
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button variant="contained" size="large" onClick={() => navigate('/register')}
              sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, borderRadius: 3, px: 5, py: 1.5, fontSize: 16, boxShadow: `0 4px 20px rgba(212,175,55,0.4)`, '&:hover': { bgcolor: GOLD_LT } }}>
              Register Free
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/login')}
              sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', borderRadius: 3, px: 5, py: 1.5, fontSize: 16, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.5)' } }}>
              Member Login
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ─── FOOTER ─── */}
      <Box sx={{ bgcolor: NAV_BG, color: 'white', py: 7 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2} sx={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 44, height: 44 }} />
                <Box>
                  <Typography variant="h6" fontWeight={800}>Assure <span style={{ color: GOLD }}>Chit Funds</span></Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2, lineHeight: 1.7 }}>
                India's trusted digital chit fund platform. Save money, earn dividends, and grow your wealth.
              </Typography>
              {/* Social Links */}
              <Box display="flex" gap={1.5} mt={1}>
                <IconButton href="https://instagram.com/assurechitfunds" target="_blank" rel="noopener noreferrer"
                  sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: '#E1306C', color: 'white' } }}>
                  <InstagramIcon />
                </IconButton>
                <IconButton href="https://youtube.com/@assurechitfunds" target="_blank" rel="noopener noreferrer"
                  sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: '#FF0000', color: 'white' } }}>
                  <YouTubeIcon />
                </IconButton>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" fontWeight={700} mb={2} sx={{ color: GOLD }}>Company</Typography>
              {[
                { label: 'About Us', to: '/about' },
                { label: 'Contact Us', to: '/contact' },
              ].map(link => (
                <Typography key={link.label} component={Link} to={link.to} variant="body2" display="block"
                  sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.75, textDecoration: 'none', '&:hover': { color: GOLD }, transition: 'color 0.2s' }}>
                  {link.label}
                </Typography>
              ))}
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" fontWeight={700} mb={2} sx={{ color: GOLD }}>Resources</Typography>
              {[
                { label: 'Learn About Chits', to: '/chit-education' },
                { label: 'Our Plans', action: () => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }) },
                { label: 'How It Works', action: () => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }) },
              ].map(link => (
                <Typography key={link.label} variant="body2" display="block"
                  component={link.to ? Link : 'span'} to={link.to || undefined} onClick={link.action || undefined}
                  sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.75, cursor: 'pointer', textDecoration: 'none', '&:hover': { color: GOLD }, transition: 'color 0.2s' }}>
                  {link.label}
                </Typography>
              ))}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" fontWeight={700} mb={2} sx={{ color: GOLD }}>Contact</Typography>
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
            © {new Date().getFullYear()} Assure Chit Funds Pvt. Ltd. All rights reserved. | Registered under Chit Funds Act, 1982.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;
