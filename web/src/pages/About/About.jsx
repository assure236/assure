import React from 'react';
import {
  Box, Container, Grid, Typography, Button,
  AppBar, Toolbar, Chip, List, ListItem, ListItemIcon, ListItemText,
  useMediaQuery, Paper, Avatar
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Groups as GroupsIcon,
  TrendingUp as TrendingIcon,
  Gavel as GavelIcon,
  EmojiEvents as TrophyIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';

const NAVY    = '#0B1F3B';
const NAV_BG  = '#061225';
const ROYAL   = '#1E3A8A';
const GOLD    = '#D4AF37';
const GOLD_LT = '#E3C668';

const TIMELINE = [
  { year: '2020', title: 'Founded', desc: 'Assure Chit Funds was started in Hyderabad with a simple goal — make chit funds easy and transparent for everyone.' },
  { year: '2021', title: 'First 100 Members', desc: 'We grew to 100 trusted members in our first year, running 5 successful chit groups.' },
  { year: '2022', title: 'Went Digital', desc: 'Launched our mobile app and web portal. Members could now join, pay, and bid from anywhere.' },
  { year: '2023', title: 'Crossed ₹1 Crore', desc: 'Total disbursals crossed ₹1 crore. More families chose Assure for their savings.' },
  { year: '2024', title: '500+ Members', desc: 'Our community grew to 500+ active members with 28 running chit groups and ₹2.5 crore disbursed.' },
];

const TEAM = [
  { name: 'Management Team', role: 'Operations & Compliance', desc: 'Our management ensures every chit group runs smoothly, every auction is fair, and every payout is on time.' },
  { name: 'Tech Team', role: 'Platform Development', desc: 'Building the app, website, and backend that make digital chit funds possible for our members.' },
  { name: 'Support Team', role: 'Member Relations', desc: 'Available to help members with any questions about payments, auctions, or their accounts.' },
];

const About = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'About Us', to: '/about' },
    { label: 'Learn About Chits', to: '/chit-education' },
    { label: 'Contact Us', to: '/contact' },
  ];

  return (
    <Box sx={{ bgcolor: '#F8F9FB', overflowX: 'hidden' }}>
      {/* ─── NAVBAR ─── */}
      <AppBar position="fixed" sx={{ bgcolor: NAV_BG, backdropFilter: 'blur(12px)', borderBottom: `1px solid rgba(212,175,55,0.15)` }}>
        <Toolbar sx={{ justifyContent: 'space-between', maxWidth: 1200, mx: 'auto', width: '100%', px: { xs: 2, md: 3 } }}>
          <Box display="flex" alignItems="center" gap={1.5} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 52, height: 52 }} />
            <Typography variant="h6" fontWeight={800} sx={{ color: 'white', fontSize: 20 }}>
              Assure <Box component="span" sx={{ color: GOLD }}>Chit Funds</Box>
            </Typography>
          </Box>
          {!isMobile ? (
            <Box display="flex" gap={0.5} alignItems="center">
              {navLinks.map(link => (
                <Button key={link.label} component={Link} to={link.to}
                  sx={{ color: link.to === '/about' ? GOLD : 'rgba(255,255,255,0.85)', fontWeight: 500, fontSize: 14, '&:hover': { color: GOLD, bgcolor: 'rgba(212,175,55,0.08)' } }}>
                  {link.label}
                </Button>
              ))}
              <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.15)', mx: 1 }} />
              <Button variant="outlined" size="small" onClick={() => navigate('/login')}
                sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'white', mr: 1, '&:hover': { borderColor: GOLD, color: GOLD } }}>Login</Button>
              <Button variant="contained" size="small" onClick={() => navigate('/register')}
                sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, '&:hover': { bgcolor: GOLD_LT } }}>Get Started</Button>
            </Box>
          ) : (
            <Box display="flex" gap={1}>
              <Button variant="contained" size="small" onClick={() => navigate('/register')}
                sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700 }}>Join</Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* ─── HERO ─── */}
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`, pt: 16, pb: 10, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Chip label="ABOUT US" sx={{ bgcolor: 'rgba(212,175,55,0.15)', color: GOLD, fontWeight: 700, mb: 3, letterSpacing: 2 }} />
          <Typography variant="h2" fontWeight={800} sx={{ color: 'white', fontSize: { xs: '2rem', md: '3rem' }, mb: 2 }}>
            We Make Chit Funds Simple
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 600, mx: 'auto', lineHeight: 1.7 }}>
            Assure Chit Funds is a registered chit fund company based in Hyderabad.
            We help everyday people save money, earn dividends, and access lump-sum funds when they need it most.
          </Typography>
        </Container>
      </Box>

      {/* ─── MISSION ─── */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Chip label="OUR MISSION" size="small" sx={{ bgcolor: `${GOLD}15`, color: GOLD, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 2 }}>
              Making Savings Accessible to Everyone
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 16, lineHeight: 1.8, mb: 2 }}>
              Many families in India struggle to save regularly or get access to large sums when they need it for education,
              medical emergencies, or business. Chit funds solve this problem by combining group savings with monthly auctions.
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 16, lineHeight: 1.8 }}>
              At Assure, we took this traditional system and made it digital, transparent, and trustworthy.
              Every rupee is tracked, every auction is live, and every member can see exactly where their money is.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              {[
                { icon: <GroupsIcon />, label: '500+', sub: 'Active Members' },
                { icon: <GavelIcon />, label: '340+', sub: 'Auctions Done' },
                { icon: <TrendingIcon />, label: '₹2.5 Cr+', sub: 'Total Disbursed' },
                { icon: <TrophyIcon />, label: '28', sub: 'Active Groups' },
              ].map((s, i) => (
                <Grid item xs={6} key={i}>
                  <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3, border: '1px solid #E2E8F0' }}>
                    <Box sx={{ color: GOLD, mb: 1 }}>{s.icon}</Box>
                    <Typography variant="h5" fontWeight={800} sx={{ color: NAVY }}>{s.label}</Typography>
                    <Typography variant="body2" sx={{ color: '#64748B' }}>{s.sub}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>

      {/* ─── CHIT FUND HISTORY ─── */}
      <Box sx={{ bgcolor: '#F1F5F9', py: 10 }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Chip label="HISTORY" size="small" sx={{ bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
              The Story of Chit Funds in India
            </Typography>
            <Typography sx={{ color: '#64748B', maxWidth: 650, mx: 'auto', fontSize: 16, lineHeight: 1.7 }}>
              Chit funds have been a part of Indian financial culture for over 100 years.
              They are one of the oldest ways for families and communities to save and borrow money together.
            </Typography>
          </Box>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 4, borderRadius: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, mb: 2 }}>What is a Chit Fund?</Typography>
                <Typography sx={{ color: '#64748B', fontSize: 15, lineHeight: 1.8, mb: 2 }}>
                  A chit fund is a group savings plan. A fixed number of people contribute the same amount every month.
                  Each month, one person gets the full collected amount through an auction.
                  The person willing to take the least amount wins that month's auction.
                </Typography>
                <Typography sx={{ color: '#64748B', fontSize: 15, lineHeight: 1.8 }}>
                  The difference between the full amount and what the winner takes is shared as <strong>dividends</strong> among
                  all other members. So everyone earns money every month, not just the winner!
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 4, borderRadius: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, mb: 2 }}>Chit Funds Act, 1982</Typography>
                <Typography sx={{ color: '#64748B', fontSize: 15, lineHeight: 1.8, mb: 2 }}>
                  The Indian government recognized the importance of chit funds and created the Chit Funds Act in 1982
                  to regulate them. This law protects members by ensuring:
                </Typography>
                <List>
                  {[
                    'Companies must be registered to run chit funds',
                    'Maximum 5% commission cap for the company',
                    'Regular audits and government oversight',
                    'Members\' money must be held in separate accounts',
                    'Fair auction processes mandated by law',
                  ].map((item, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}><CheckIcon sx={{ color: '#16A34A', fontSize: 16 }} /></ListItemIcon>
                      <ListItemText primary={item} primaryTypographyProps={{ fontSize: 14, color: '#475569' }} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── OUR JOURNEY ─── */}
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Box textAlign="center" mb={6}>
          <Chip label="OUR JOURNEY" size="small" sx={{ bgcolor: `${GOLD}15`, color: GOLD, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
          <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
            How We Got Here
          </Typography>
        </Box>
        {TIMELINE.map((t, i) => (
          <Box key={i} display="flex" gap={3} mb={4}>
            <Box sx={{ minWidth: 60, textAlign: 'center' }}>
              <Chip label={t.year} sx={{ bgcolor: i === TIMELINE.length - 1 ? GOLD : NAVY, color: 'white', fontWeight: 800, fontSize: 14 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, mb: 0.5 }}>{t.title}</Typography>
              <Typography sx={{ color: '#64748B', fontSize: 15, lineHeight: 1.6 }}>{t.desc}</Typography>
            </Box>
          </Box>
        ))}
      </Container>

      {/* ─── TEAM ─── */}
      <Box sx={{ bgcolor: '#F1F5F9', py: 10 }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Chip label="OUR TEAM" size="small" sx={{ bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              The People Behind Assure
            </Typography>
          </Box>
          <Grid container spacing={3} justifyContent="center">
            {TEAM.map((t, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', height: '100%' }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: NAVY, color: GOLD, mx: 'auto', mb: 2, fontSize: 28 }}>
                    {t.name.charAt(0)}
                  </Avatar>
                  <Typography variant="h6" fontWeight={700} sx={{ color: NAVY }}>{t.name}</Typography>
                  <Typography variant="body2" sx={{ color: GOLD, fontWeight: 600, mb: 1.5 }}>{t.role}</Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{t.desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── SOCIAL LINKS ─── */}
      <Box sx={{ py: 8, textAlign: 'center', bgcolor: 'white' }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={800} sx={{ color: NAVY, mb: 2 }}>Follow Us</Typography>
          <Typography sx={{ color: '#64748B', mb: 3 }}>Stay connected for updates, tips, and member stories.</Typography>
          <Box display="flex" gap={2} justifyContent="center">
            <Button variant="outlined" startIcon={<InstagramIcon />}
              href="https://instagram.com/assurechitfunds" target="_blank" rel="noopener noreferrer"
              sx={{ borderColor: '#E1306C', color: '#E1306C', fontWeight: 600, '&:hover': { bgcolor: '#E1306C', color: 'white' } }}>
              Instagram
            </Button>
            <Button variant="outlined" startIcon={<YouTubeIcon />}
              href="https://youtube.com/@assurechitfunds" target="_blank" rel="noopener noreferrer"
              sx={{ borderColor: '#FF0000', color: '#FF0000', fontWeight: 600, '&:hover': { bgcolor: '#FF0000', color: 'white' } }}>
              YouTube
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ─── CTA ─── */}
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`, py: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={800} color="white" sx={{ mb: 2, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
            Want to Start Saving?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, fontSize: 17 }}>
            Join our growing family of 500+ members. It's free to register!
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button variant="contained" size="large" onClick={() => navigate('/register')}
              sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, borderRadius: 3, px: 5, py: 1.5, '&:hover': { bgcolor: GOLD_LT } }}>
              Register Free
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/contact')}
              sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', borderRadius: 3, px: 5, py: 1.5, '&:hover': { borderColor: 'rgba(255,255,255,0.5)' } }}>
              Contact Us
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ─── FOOTER ─── */}
      <Box sx={{ bgcolor: NAV_BG, color: 'white', py: 5 }}>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 36, height: 36 }} />
              <Typography fontWeight={700} sx={{ color: 'white' }}>Assure <span style={{ color: GOLD }}>Chit Funds</span></Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)' }}>
              © {new Date().getFullYear()} Assure Chit Funds Pvt. Ltd. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default About;
