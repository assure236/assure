import React, { useState } from 'react';
import {
  Box, Container, Grid, Typography, Button,
  AppBar, Toolbar, Chip, TextField, Paper, Divider, IconButton,
  useMediaQuery, CircularProgress, Alert
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  WhatsApp as WhatsAppIcon,
  Send as SendIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const NAVY    = '#0B1F3B';
const NAV_BG  = '#061225';
const ROYAL   = '#1E3A8A';
const GOLD    = '#D4AF37';
const GOLD_LT = '#E3C668';

const Contact = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setSending(true);
    try {
      await axios.post('/users/support', { subject: form.subject, message: `From: ${form.name} (${form.email}, ${form.phone})\n\n${form.message}` });
      setSent(true);
      toast.success('Your message has been sent! We will respond within 24 hours.');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      toast.error('Failed to send. Please try WhatsApp or call us directly.');
    } finally {
      setSending(false);
    }
  };

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
                  sx={{ color: link.to === '/contact' ? GOLD : 'rgba(255,255,255,0.85)', fontWeight: 500, fontSize: 14, '&:hover': { color: GOLD, bgcolor: 'rgba(212,175,55,0.08)' } }}>
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
            <Button variant="contained" size="small" onClick={() => navigate('/register')}
              sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700 }}>Join</Button>
          )}
        </Toolbar>
      </AppBar>

      {/* ─── HERO ─── */}
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`, pt: 16, pb: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Chip label="CONTACT US" sx={{ bgcolor: 'rgba(212,175,55,0.15)', color: GOLD, fontWeight: 700, mb: 3, letterSpacing: 2 }} />
          <Typography variant="h2" fontWeight={800} sx={{ color: 'white', fontSize: { xs: '2rem', md: '3rem' }, mb: 2 }}>
            We're Here to Help
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 550, mx: 'auto' }}>
            Have a question? Want to learn more about our chit plans? Reach out and our team will respond within 24 hours.
          </Typography>
        </Container>
      </Box>

      {/* ─── CONTACT INFO + FORM ─── */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Grid container spacing={5}>
          {/* Contact Info */}
          <Grid item xs={12} md={5}>
            <Typography variant="h5" fontWeight={800} sx={{ color: NAVY, mb: 3 }}>Get in Touch</Typography>

            {[
              { icon: <PhoneIcon />, title: 'Call Us', value: '+91 98765 43210', sub: 'Mon-Sat, 9 AM - 7 PM' },
              { icon: <WhatsAppIcon />, title: 'WhatsApp', value: '+91 98765 43210', sub: 'Quick responses, anytime' },
              { icon: <EmailIcon />, title: 'Email', value: 'support@assurechitfunds.com', sub: 'We reply within 24 hours' },
              { icon: <LocationIcon />, title: 'Office', value: 'Hyderabad, Telangana, India', sub: 'Visit by appointment only' },
            ].map((c, i) => (
              <Paper key={i} sx={{ p: 2.5, mb: 2, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', border: '1px solid #E2E8F0' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: `${GOLD}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD }}>
                  {c.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: NAVY }}>{c.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500 }}>{c.value}</Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>{c.sub}</Typography>
                </Box>
              </Paper>
            ))}

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: NAVY, mb: 1.5 }}>Follow Us</Typography>
            <Box display="flex" gap={1.5}>
              <IconButton href="https://instagram.com/assurechitfunds" target="_blank" rel="noopener noreferrer"
                sx={{ bgcolor: '#fce4ec', color: '#E1306C', '&:hover': { bgcolor: '#E1306C', color: 'white' } }}>
                <InstagramIcon />
              </IconButton>
              <IconButton href="https://youtube.com/@assurechitfunds" target="_blank" rel="noopener noreferrer"
                sx={{ bgcolor: '#ffebee', color: '#FF0000', '&:hover': { bgcolor: '#FF0000', color: 'white' } }}>
                <YouTubeIcon />
              </IconButton>
            </Box>
          </Grid>

          {/* Ticket / Contact Form */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 4, borderRadius: 4, border: '1px solid #E2E8F0' }}>
              <Typography variant="h5" fontWeight={800} sx={{ color: NAVY, mb: 1 }}>Send Us a Message</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
                Fill in the form below and our team will get back to you. This works like a support ticket.
              </Typography>

              {sent && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Your message has been sent successfully! We'll get back to you within 24 hours.
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Your Name *" name="name" value={form.name} onChange={handleChange} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Email Address *" name="email" type="email" value={form.email} onChange={handleChange} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Phone Number" name="phone" value={form.phone} onChange={handleChange} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Subject *" name="subject" value={form.subject} onChange={handleChange}
                      placeholder="e.g. Question about Gold Plan" />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth multiline rows={5} label="Your Message *" name="message" value={form.message} onChange={handleChange}
                      placeholder="Tell us what you need help with..." />
                  </Grid>
                  <Grid item xs={12}>
                    <Button type="submit" variant="contained" size="large" fullWidth disabled={sending}
                      startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                      sx={{ bgcolor: NAVY, color: 'white', fontWeight: 700, py: 1.5, '&:hover': { bgcolor: ROYAL } }}>
                      {sending ? 'Sending...' : 'Send Message'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* ─── FOOTER ─── */}
      <Box sx={{ bgcolor: NAV_BG, color: 'white', py: 5 }}>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 36, height: 36 }} />
              <Typography fontWeight={700}>Assure <span style={{ color: GOLD }}>Chit Funds</span></Typography>
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

export default Contact;
