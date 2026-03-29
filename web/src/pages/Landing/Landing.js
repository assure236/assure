import React from 'react';
import {
  Box, Container, Grid, Typography, Button, Card, CardContent,
  AppBar, Toolbar, Chip, Avatar, List, ListItem, ListItemIcon, ListItemText,
  Divider
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const SCHEMES = [
  { name: 'Silver Plan', value: '₹50,000', members: 20, duration: '20 months', monthly: '₹2,500', color: '#607d8b' },
  { name: 'Gold Plan', value: '₹1,00,000', members: 20, duration: '20 months', monthly: '₹5,000', color: '#f9a825' },
  { name: 'Diamond Plan', value: '₹2,00,000', members: 20, duration: '20 months', monthly: '₹10,000', color: '#3949ab' },
  { name: 'Platinum Plan', value: '₹5,00,000', members: 20, duration: '20 months', monthly: '₹25,000', color: '#6a1b9a' },
];

const FEATURES = [
  { icon: <SecurityIcon />, title: 'NIDHI Registered', desc: 'Fully licensed and regulated chit fund company under the Chit Funds Act.' },
  { icon: <TrendingIcon />, title: 'High Returns', desc: 'Earn dividends on every auction. Your savings work harder for you.' },
  { icon: <GroupsIcon />, title: 'Trusted Community', desc: '500+ members. Transparent auctions. No hidden fees.' },
  { icon: <GavelIcon />, title: 'Live Auctions', desc: 'Participate in real-time auctions from the app or web portal.' },
  { icon: <BankIcon />, title: 'Safe Disbursals', desc: 'Winning amounts deposited directly to your bank account within 24 hours.' },
  { icon: <CheckIcon />, title: 'Digital KYC', desc: 'Instant Aadhaar + PAN verification. No paperwork, no branch visits.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Register & KYC', desc: 'Create your account and complete digital KYC in under 5 minutes.' },
  { step: '02', title: 'Choose a Chit Plan', desc: 'Pick a plan that fits your monthly budget and savings goal.' },
  { step: '03', title: 'Pay Monthly', desc: 'Pay your installment online every month. Track everything on the dashboard.' },
  { step: '04', title: 'Bid & Win', desc: 'Participate in monthly auctions. Win the chit amount at a discount.' },
  { step: '05', title: 'Get Dividends', desc: 'Even if you don\'t win, you earn dividends from every auction.' },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ bgcolor: '#fafafa' }}>
      {/* Navbar */}
      <AppBar position="sticky" sx={{ bgcolor: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.1)' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: '#1976d2', width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>AC</Avatar>
            <Typography variant="h6" fontWeight={700} color="primary.main">Assure ChitFunds</Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <Button color="inherit" sx={{ color: 'text.primary', display: { xs: 'none', md: 'inline-flex' } }} onClick={() => document.getElementById('schemes').scrollIntoView({ behavior: 'smooth' })}>Plans</Button>
            <Button color="inherit" sx={{ color: 'text.primary', display: { xs: 'none', md: 'inline-flex' } }} onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })}>How it Works</Button>
            <Button variant="outlined" size="small" onClick={() => navigate('/login')}>Login</Button>
            <Button variant="contained" size="small" onClick={() => navigate('/register')}>Get Started</Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #42a5f5 100%)',
        py: { xs: 8, md: 12 }, color: 'white', textAlign: { xs: 'center', md: 'left' }
      }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Chip label="NIDHI Registered • Trusted Since 2020" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mb: 2 }} />
              <Typography variant="h2" fontWeight={800} sx={{ fontSize: { xs: '2.2rem', md: '3.2rem' }, lineHeight: 1.2, mb: 2 }}>
                Save Smart.<br />Win Big.<br />
                <Box component="span" sx={{ color: '#ffcc02' }}>Earn Dividends.</Box>
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.85, fontWeight: 400, mb: 4, maxWidth: 480 }}>
                Join Assure ChitFunds — India's most trusted digital chit fund platform.
                Guaranteed returns, transparent auctions, and instant disbursals.
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap" justifyContent={{ xs: 'center', md: 'flex-start' }}>
                <Button variant="contained" size="large" onClick={() => navigate('/register')}
                  endIcon={<ArrowIcon />}
                  sx={{ bgcolor: '#ffcc02', color: '#1a1a1a', fontWeight: 700, '&:hover': { bgcolor: '#f9a825' }, borderRadius: 3, px: 4 }}>
                  Start Saving Today
                </Button>
                <Button variant="outlined" size="large" onClick={() => document.getElementById('schemes').scrollIntoView({ behavior: 'smooth' })}
                  sx={{ borderColor: 'white', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, borderRadius: 3, px: 4 }}>
                  View Plans
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Grid container spacing={2}>
                {[
                  { label: 'Active Members', value: '500+' },
                  { label: 'Total Disbursed', value: '₹2.5 Cr+' },
                  { label: 'Active Chit Groups', value: '28' },
                  { label: 'Auctions Completed', value: '340+' },
                ].map((stat, i) => (
                  <Grid item xs={6} key={i}>
                    <Card sx={{ borderRadius: 3, textAlign: 'center', py: 2, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                      <Typography variant="h4" fontWeight={800} color="white">{stat.value}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8, color: 'white' }}>{stat.label}</Typography>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" mb={1}>Why Choose Assure ChitFunds?</Typography>
        <Typography color="text.secondary" textAlign="center" mb={6}>Safe, transparent, and high-returning chit fund investments</Typography>
        <Grid container spacing={3}>
          {FEATURES.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ borderRadius: 3, height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', mb: 2 }}>
                    {f.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={700} mb={1}>{f.title}</Typography>
                  <Typography color="text.secondary" variant="body2">{f.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Chit Schemes */}
      <Box id="schemes" sx={{ bgcolor: '#f0f4ff', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={700} textAlign="center" mb={1}>Chit Fund Plans</Typography>
          <Typography color="text.secondary" textAlign="center" mb={6}>Choose the plan that matches your financial goals</Typography>
          <Grid container spacing={3}>
            {SCHEMES.map((s, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card sx={{ borderRadius: 3, overflow: 'hidden', height: '100%', boxShadow: 3 }}>
                  <Box sx={{ bgcolor: s.color, p: 3, color: 'white', textAlign: 'center' }}>
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>{s.name}</Typography>
                    <Typography variant="h4" fontWeight={800}>{s.value}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>Chit Value</Typography>
                  </Box>
                  <CardContent>
                    <List dense>
                      {[
                        { label: 'Members', val: s.members },
                        { label: 'Duration', val: s.duration },
                        { label: 'Monthly Install.', val: s.monthly },
                      ].map((item, j) => (
                        <ListItem key={j} disableGutters>
                          <ListItemIcon sx={{ minWidth: 28 }}><CheckIcon color="success" fontSize="small" /></ListItemIcon>
                          <ListItemText primary={<Box display="flex" justifyContent="space-between"><span>{item.label}</span><strong>{item.val}</strong></Box>} />
                        </ListItem>
                      ))}
                    </List>
                    <Button fullWidth variant="contained" sx={{ mt: 1, borderRadius: 2 }} onClick={() => navigate('/register')}>
                      Join Now
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How It Works */}
      <Box id="how" sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={700} textAlign="center" mb={1}>How It Works</Typography>
          <Typography color="text.secondary" textAlign="center" mb={6}>Five simple steps to financial freedom</Typography>
          <Grid container spacing={3}>
            {HOW_IT_WORKS.map((h, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Box display="flex" gap={2}>
                  <Typography variant="h3" fontWeight={900} color="primary.main" sx={{ opacity: 0.15, lineHeight: 1 }}>{h.step}</Typography>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{h.title}</Typography>
                    <Typography color="text.secondary" variant="body2">{h.desc}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Banner */}
      <Box sx={{ background: 'linear-gradient(135deg, #1565c0, #6a1b9a)', py: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h4" fontWeight={700} color="white" mb={2}>
            Ready to Start Your Chit Journey?
          </Typography>
          <Typography color="rgba(255,255,255,0.8)" mb={4}>
            Join 500+ members already building wealth with Assure ChitFunds.
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button variant="contained" size="large" onClick={() => navigate('/register')}
              sx={{ bgcolor: '#ffcc02', color: '#1a1a1a', fontWeight: 700, '&:hover': { bgcolor: '#f9a825' }, borderRadius: 3, px: 5 }}>
              Register Free
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/login')}
              sx={{ borderColor: 'white', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, borderRadius: 3, px: 5 }}>
              Member Login
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: '#1a1a2e', color: 'white', py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Avatar sx={{ bgcolor: '#1976d2', width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>AC</Avatar>
                <Typography variant="h6" fontWeight={700}>Assure ChitFunds</Typography>
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
                India's trusted digital chit fund platform. Safe, transparent, and rewarding.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Quick Links</Typography>
              {['About Us', 'Our Plans', 'How It Works', 'FAQs', 'Contact Us'].map(link => (
                <Typography key={link} variant="body2" sx={{ opacity: 0.7, mb: 0.5, cursor: 'pointer', '&:hover': { opacity: 1 } }}>{link}</Typography>
              ))}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Contact</Typography>
              {[
                { icon: <PhoneIcon fontSize="small" />, text: '+91 98765 43210' },
                { icon: <EmailIcon fontSize="small" />, text: 'support@assurechitfunds.com' },
                { icon: <LocationIcon fontSize="small" />, text: 'Hyderabad, Telangana, India' },
              ].map((c, i) => (
                <Box key={i} display="flex" alignItems="center" gap={1} mb={1}>
                  <Box sx={{ opacity: 0.7 }}>{c.icon}</Box>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>{c.text}</Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 3 }} />
          <Typography variant="body2" textAlign="center" sx={{ opacity: 0.5 }}>
            © {new Date().getFullYear()} Assure ChitFunds Pvt. Ltd. All rights reserved. | Registered under Chit Funds Act, 1982.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;
