import React, { useState } from 'react';
import {
  Grid, Typography, Box, Button, TextField,
  Accordion, AccordionSummary, AccordionDetails, Divider,
  List, ListItem, ListItemIcon, ListItemText, CircularProgress, Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon, Phone as PhoneIcon, Email as EmailIcon,
  WhatsApp as WhatsAppIcon, Send as SendIcon,
  PlayCircle as PlayIcon, AccessTime as ClockIcon, School as SchoolIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, Surface, SectionTitle } from '../../components/ui/PageKit';
import { brand } from '../../theme/brand';

const TUTORIAL_COLORS = [brand.navy, brand.success, brand.goldDark, brand.royal, brand.navyMid, brand.goldDark];

const TUTORIALS = [
  { title: 'Getting Started with Assure ChitFunds', duration: '5 min', description: 'Learn how to create your account, complete KYC, and enroll in your first chit.', category: 'Beginner', url: 'https://www.youtube.com/watch?v=demo_getting_started' },
  { title: 'How Chit Funds Work', duration: '7 min', description: 'Understand the chit fund mechanism — monthly auctions, dividends, and payouts.', category: 'Beginner', url: 'https://www.youtube.com/watch?v=demo_how_chits_work' },
  { title: 'How to Bid in an Auction', duration: '4 min', description: 'Step-by-step guide on entering a live auction room and placing your bid.', category: 'Intermediate', url: 'https://www.youtube.com/watch?v=demo_auction_bidding' },
  { title: 'Making Payments', duration: '3 min', description: 'Learn how to make monthly installment payments and view payment history.', category: 'Beginner', url: 'https://www.youtube.com/watch?v=demo_payments' },
  { title: 'Understanding Dividends', duration: '4 min', description: 'How dividends are calculated and distributed to members each month.', category: 'Intermediate', url: 'https://www.youtube.com/watch?v=demo_dividends' },
  { title: 'Refer & Earn Program', duration: '3 min', description: 'How to refer friends and earn rewards through your referral code.', category: 'Beginner', url: 'https://www.youtube.com/watch?v=demo_referrals' },
];

const openTutorial = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

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
    <PageShell>
      <PageHeader
        eyebrow="Resources"
        title="Help & Support"
        subtitle="Tutorials, FAQs, and ways to reach our team"
        actions={
          <Button variant="contained" onClick={() => navigate('/support?new=1')}>
            Open Support Tickets
          </Button>
        }
      />

      <Box mb={4}>
        <SectionTitle
          title="Tutorial Videos"
          action={<SchoolIcon sx={{ color: brand.goldDark }} />}
        />
        <Grid container spacing={2}>
          {TUTORIALS.map((t, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Surface padded={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    bgcolor: TUTORIAL_COLORS[i % TUTORIAL_COLORS.length],
                    height: 110,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  onClick={() => openTutorial(t.url)}
                >
                  <PlayIcon sx={{ fontSize: 54, color: 'rgba(255,255,255,0.9)' }} />
                  <Box sx={{ position: 'absolute', bottom: 8, right: 8, bgcolor: 'rgba(0,0,0,0.65)', px: 1, py: 0.25, borderRadius: 1 }}>
                    <Typography variant="caption" color="white" display="flex" alignItems="center" gap={0.5}>
                      <ClockIcon sx={{ fontSize: 12 }} />{t.duration}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 2, flexGrow: 1 }}>
                  <Chip label={t.category} size="small" variant="outlined" sx={{ mb: 1, fontSize: 10 }} />
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: brand.navy }}>{t.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                </Box>
                <Box px={2} pb={2}>
                  <Button fullWidth variant="outlined" size="small" startIcon={<PlayIcon />}
                    onClick={() => openTutorial(t.url)}>
                    Watch
                  </Button>
                </Box>
              </Surface>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <SectionTitle title="Frequently Asked Questions" />
          {FAQS.map((faq, i) => (
            <Accordion
              key={i}
              expanded={expanded === i}
              onChange={(_, isEx) => setExpanded(isEx ? i : false)}
              sx={{
                mb: 1,
                borderRadius: `${brand.radius}px !important`,
                '&:before': { display: 'none' },
                border: `1px solid ${brand.line}`,
                boxShadow: 'none',
              }}
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

        <Grid item xs={12} md={5}>
          <Surface sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: brand.navy }}>Contact Us</Typography>
            <Divider sx={{ mb: 2 }} />
            <List dense>
              {[
                {
                  icon: <PhoneIcon sx={{ color: brand.navy }} />,
                  label: '+91 98765 43210',
                  sub: 'Mon–Sat, 9am–6pm',
                  onClick: () => window.open('tel:+919876543210'),
                },
                {
                  icon: <WhatsAppIcon sx={{ color: brand.success }} />,
                  label: 'WhatsApp Support',
                  sub: 'Chat with us anytime',
                  onClick: () => window.open('https://wa.me/919876543210'),
                },
                {
                  icon: <EmailIcon sx={{ color: brand.royal }} />,
                  label: 'support@assure.fund',
                  sub: 'Response within 24 hours',
                  onClick: () => window.open('mailto:support@assure.fund'),
                },
              ].map(({ icon, label, sub, onClick }) => (
                <ListItem key={label} button onClick={onClick} sx={{ borderRadius: 2, mb: 0.5, '&:hover': { bgcolor: brand.mist } }}>
                  <ListItemIcon>{icon}</ListItemIcon>
                  <ListItemText primary={label} secondary={sub} />
                </ListItem>
              ))}
            </List>
          </Surface>

          <Surface>
            <Typography variant="h6" gutterBottom sx={{ color: brand.navy }}>Send a Message</Typography>
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
                startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}>
                {sending ? 'Sending…' : 'Send Message'}
              </Button>
            </Box>
          </Surface>
        </Grid>
      </Grid>
    </PageShell>
  );
};

export default Help;
