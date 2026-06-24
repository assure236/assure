import React, { useState } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Button, TextField,
  Accordion, AccordionSummary, AccordionDetails, Divider, Alert, Paper,
  List, ListItem, ListItemIcon, ListItemText, CircularProgress, Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon, Phone as PhoneIcon, Email as EmailIcon,
  WhatsApp as WhatsAppIcon, Help as HelpIcon, Send as SendIcon,
  PlayCircle as PlayIcon, AccessTime as ClockIcon, School as SchoolIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const TUTORIALS = [
  { title: 'Getting Started with Assure ChitFunds', duration: '3:45', color: '#0B1F3B', description: 'An introduction to the platform — registration, login, and navigating your dashboard.', category: 'Beginner' },
  { title: 'How to Join a Chit Group', duration: '4:20', color: '#388e3c', description: 'Step-by-step guide to browsing available chit groups and enrolling in one.', category: 'Beginner' },
  { title: 'How to Bid in Live Auctions', duration: '5:10', color: '#B8960F', description: 'Learn how live auctions work, how to place bids, and what happens after winning.', category: 'Intermediate' },
  { title: 'Understanding Your Dividend', duration: '4:55', color: '#7b1fa2', description: 'Explains dividend calculation, winning bid deductions, and expected returns.', category: 'Intermediate' },
  { title: 'KYC Verification Guide', duration: '3:15', color: '#0288d1', description: 'How to upload Aadhaar and PAN documents for KYC verification.', category: 'Beginner' },
  { title: 'Reading Your Account Statement', duration: '3:30', color: '#c62828', description: 'Download and interpret your payment history, receipts, and late fees from the Payments page.', category: 'Advanced' },
];

const FAQS = [
  {
    q: 'What is a chit fund?',
    a: 'A chit fund is a savings scheme in which a group of people contribute money regularly over a fixed period. Every month, one member wins the prize pool through an auction.'
  },
  {
    q: 'How does the auction process work?',
    a: 'Each month, an auction is held where members bid the amount they are willing to forgo. The member willing to accept the lowest prize (highest bid) wins the chit amount for that month.'
  },
  {
    q: 'When will I receive my payment after winning an auction?',
    a: 'Payments are typically processed within 2-3 business days after the auction. You will receive an SMS and app notification when the amount is credited.'
  },
  {
    q: 'What happens if I miss an installment?',
    a: 'Missing an installment may incur a late fee as per your group terms. Continued defaults can result in suspension from the chit group. Please contact your manager immediately.'
  },
  {
    q: 'How do I complete KYC verification?',
    a: 'Go to Documents section and upload Aadhaar Card (front & back) and PAN Card. Our team will verify them within 1-2 business days.'
  },
  {
    q: 'Can I join multiple chit groups?',
    a: 'Yes, you can be a member of multiple chit groups simultaneously, subject to your credit score and compliance with membership rules.'
  },
  {
    q: 'How is my credit score calculated?',
    a: 'Your credit score is based on payment regularity, KYC status, tenure with Assure ChitFunds, and overall repayment discipline.'
  },
  {
    q: 'How can I get a referral reward?',
    a: 'Share your referral code from the Referrals section. When a friend registers and joins a chit group using your code, you earn ₹500 reward.'
  },
];

const Help = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSending(true);
    try {
      await axios.post('/users/support', form);
      toast.success('Support request submitted! We will respond within 24 hours.');
      setForm({ subject: '', message: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request. Try WhatsApp instead.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
        <Typography variant="h4">Help & Support</Typography>
        <Button variant="contained" onClick={() => navigate('/support?new=1')}>
          Open Support Tickets
        </Button>
      </Box>

      {/* Tutorial Videos Section */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <SchoolIcon color="primary" />
          <Typography variant="h6">Tutorial Videos</Typography>
        </Box>
        <Grid container spacing={2}>
          {TUTORIALS.map((t, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
                {/* Thumbnail */}
                <Box sx={{ bgcolor: t.color, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px 12px 0 0', position: 'relative', cursor: 'pointer' }}
                  onClick={() => toast.info('Tutorial video coming soon!')}>
                  <PlayIcon sx={{ fontSize: 54, color: 'rgba(255,255,255,0.9)' }} />
                  <Box sx={{ position: 'absolute', bottom: 8, right: 8, bgcolor: 'rgba(0,0,0,0.65)', px: 1, py: 0.25, borderRadius: 1 }}>
                    <Typography variant="caption" color="white" display="flex" alignItems="center" gap={0.5}>
                      <ClockIcon sx={{ fontSize: 12 }} />{t.duration}
                    </Typography>
                  </Box>
                </Box>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Chip label={t.category} size="small" variant="outlined" sx={{ mb: 1, fontSize: 10 }} />
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>{t.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                </CardContent>
                <Box px={2} pb={2}>
                  <Button fullWidth variant="outlined" size="small" startIcon={<PlayIcon />}
                    onClick={() => toast.info('Tutorial video coming soon!')} sx={{ borderRadius: 2 }}>
                    Watch
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        {/* Left: FAQ */}
        <Grid item xs={12} md={7}>
          <Typography variant="h6" sx={{ mb: 2 }}>Frequently Asked Questions</Typography>
          {FAQS.map((faq, i) => (
            <Accordion
              key={i}
              expanded={expanded === i}
              onChange={(_, isEx) => setExpanded(isEx ? i : false)}
              sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' }, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>{faq.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">{faq.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Grid>

        {/* Right: Contact + Submit */}
        <Grid item xs={12} md={5}>
          {/* Contact Options */}
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Contact Us</Typography>
              <Divider sx={{ mb: 2 }} />
              <List dense>
                {[
                  {
                    icon: <PhoneIcon color="primary" />,
                    label: '+91 98765 43210',
                    sub: 'Mon–Sat, 9am–6pm',
                    onClick: () => window.open('tel:+919876543210'),
                  },
                  {
                    icon: <WhatsAppIcon sx={{ color: '#25D366' }} />,
                    label: 'WhatsApp Support',
                    sub: 'Chat with us anytime',
                    onClick: () => window.open('https://wa.me/919876543210'),
                  },
                  {
                    icon: <EmailIcon color="info" />,
                    label: 'support@assurchitfunds.com',
                    sub: 'Response within 24 hours',
                    onClick: () => window.open('mailto:support@assurchitfunds.com'),
                  },
                ].map(({ icon, label, sub, onClick }) => (
                  <ListItem key={label} button onClick={onClick} sx={{ borderRadius: 2, mb: 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
                    <ListItemIcon>{icon}</ListItemIcon>
                    <ListItemText primary={label} secondary={sub} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Support Form */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Send a Message</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth label="Subject" size="small" sx={{ mb: 2 }}
                  value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  inputProps={{ maxLength: 100 }}
                />
                <TextField
                  fullWidth label="Message" multiline rows={4} sx={{ mb: 2 }}
                  value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  inputProps={{ maxLength: 1000 }}
                />
                <Button fullWidth type="submit" variant="contained" disabled={sending}
                  startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
                  sx={{ borderRadius: 2 }}>
                  {sending ? 'Sending…' : 'Send Message'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Help;

