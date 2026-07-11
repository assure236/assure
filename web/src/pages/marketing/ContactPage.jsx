import React, { useState } from 'react';
import { Box, Button, Typography, Grid, Stack, TextField, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const CONTACT = {
  email: 'support@assure.fund',
  phone: '+91 98765 43210',
  phoneRaw: '919876543210',
  address: 'Hyderabad, Telangana, India',
  hours: 'Monday – Saturday, 9:00 AM – 6:00 PM IST',
};

export default function ContactPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Assure enquiry from ${name || 'visitor'}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}\n\n---\nSent from assure.fund contact page`
    );
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <MarketingPage
      eyebrow="Support"
      title="Contact us"
      subtitle="Reach the Assure team for membership questions. Logged-in members can also use Support tickets in the portal."
    >
      <Grid container spacing={4}>
        <Grid item xs={12} md={5}>
          <Stack spacing={2.5}>
            <Box sx={{ p: 3, borderRadius: 3, border: `1px solid ${brand.line}`, bgcolor: '#fff' }}>
              <Typography variant="overline" sx={{ color: brand.goldDark }}>Email</Typography>
              <Typography fontWeight={700} sx={{ color: brand.navy }}>
                <Box component="a" href={`mailto:${CONTACT.email}`} sx={{ color: 'inherit', textDecoration: 'none' }}>
                  {CONTACT.email}
                </Box>
              </Typography>
            </Box>
            <Box sx={{ p: 3, borderRadius: 3, border: `1px solid ${brand.line}`, bgcolor: '#fff' }}>
              <Typography variant="overline" sx={{ color: brand.goldDark }}>Phone</Typography>
              <Typography fontWeight={700} sx={{ color: brand.navy }}>
                <Box component="a" href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} sx={{ color: 'inherit', textDecoration: 'none' }}>
                  {CONTACT.phone}
                </Box>
              </Typography>
            </Box>
            <Box sx={{ p: 3, borderRadius: 3, border: `1px solid ${brand.line}`, bgcolor: '#fff' }}>
              <Typography variant="overline" sx={{ color: brand.goldDark }}>Office</Typography>
              <Typography fontWeight={700} sx={{ color: brand.navy, mb: 0.5 }}>{CONTACT.address}</Typography>
              <Typography variant="body2" color="text.secondary">{CONTACT.hours}</Typography>
            </Box>
            <Button
              variant="contained"
              color="secondary"
              href={`https://wa.me/${CONTACT.phoneRaw}`}
              target="_blank"
              rel="noopener noreferrer"
              fullWidth
            >
              Chat on WhatsApp
            </Button>
          </Stack>
        </Grid>

        <Grid item xs={12} md={7}>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              p: 3,
              borderRadius: 3,
              border: `1px solid ${brand.line}`,
              bgcolor: '#fff',
            }}
          >
            <Typography variant="h6" sx={{ color: brand.navy, mb: 0.5 }}>Send a message</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              This opens your email app with a pre-filled message. For account-specific issues, login and use member Support.
            </Typography>

            {submitted && (
              <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: brand.canvas, border: `1px solid ${brand.line}` }}>
                <Typography variant="body2" sx={{ color: brand.navy }}>
                  Your email app should open shortly. For faster help on payments or auctions, login and raise a ticket under Support.
                </Typography>
              </Box>
            )}

            <Stack spacing={2}>
              <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField label="Your email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <TextField
                label="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                fullWidth
                multiline
                rows={4}
                required
              />
              <Button type="submit" variant="contained">Send via email</Button>
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4, borderColor: brand.line }} />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <Button onClick={() => navigate('/support-center/faq')}>Read FAQs</Button>
        <Button variant="outlined" onClick={() => navigate('/login')}>Member login</Button>
        <Typography variant="body2" color="text.secondary">
          Account holders: use Support tickets after login for payment and auction issues.
        </Typography>
      </Stack>
    </MarketingPage>
  );
}
