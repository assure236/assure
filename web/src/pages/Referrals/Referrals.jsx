import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Button, Alert,
  CircularProgress, Divider, List, ListItem, ListItemAvatar, ListItemText,
  Avatar, Chip, Paper, TextField, InputAdornment, IconButton, Tooltip
} from '@mui/material';
import { ContentCopy as CopyIcon, Share as ShareIcon, People as PeopleIcon, CardGiftcard as GiftIcon } from '@mui/icons-material';
import axios from 'axios';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { useDisplayUser } from '../../hooks/useDisplayUser';
import { toast } from 'react-toastify';

const Referrals = () => {
  const user = useDisplayUser();
  const { refreshKey } = useActiveMember();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchReferrals(); }, [refreshKey]);

  const fetchReferrals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/referrals/referral-stats');
      if (res.data.success) setData(res.data.data);
    } catch (err) {
      setError('Could not load referral data.');
    } finally {
      setLoading(false);
    }
  };

  const referralCode = data?.referral_code || user?.referral_code || 'LOADING...';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode).then(() => toast.success('Referral code copied!')).catch(() => toast.error('Copy failed'));
  };

  const handleShare = () => {
    const msg = `Join Assure ChitFunds using my referral code ${referralCode} and get rewards! Download the app now.`;
    if (navigator.share) {
      navigator.share({ title: 'Assure ChitFunds Referral', text: msg }).catch(() => {});
    } else {
      navigator.clipboard.writeText(msg);
      toast.success('Referral message copied to clipboard!');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (error) return <Container sx={{ py: 4 }}><Alert severity="error">{error}</Alert></Container>;

  const referrals = data?.referrals || [];
  const totalEarnings = data?.total_earnings || 0;
  const pendingEarnings = data?.pending_earnings || 0;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" gutterBottom>Refer & Earn</Typography>

      {/* Stats Row */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Total Referrals', value: referrals.length, color: '#0B1F3B', icon: <PeopleIcon /> },
          { label: 'Total Earnings', value: `₹${Number(totalEarnings).toLocaleString('en-IN')}`, color: '#4caf50', icon: <GiftIcon /> },
          { label: 'Pending Rewards', value: `₹${Number(pendingEarnings).toLocaleString('en-IN')}`, color: '#D4AF37', icon: <GiftIcon /> },
        ].map(({ label, value, color, icon }) => (
          <Grid item xs={12} sm={4} key={label}>
            <Paper sx={{ p: 2.5, borderRadius: 3, borderLeft: `4px solid ${color}`, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: color }}>{icon}</Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h5" fontWeight={700} color={color}>{value}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Referral Code Card */}
      <Card sx={{ borderRadius: 3, mb: 3, background: 'linear-gradient(135deg, #0B1F3B, #1E3A8A)', color: 'white' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="subtitle1" sx={{ opacity: 0.8, mb: 1 }}>Your Referral Code</Typography>
          <Typography variant="h3" fontWeight={800} letterSpacing={4} sx={{ mb: 2 }}>
            {referralCode}
          </Typography>
          <Box display="flex" justifyContent="center" gap={2}>
            <Tooltip title="Copy code">
              <Button variant="outlined" startIcon={<CopyIcon />} onClick={handleCopy}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}>
                Copy
              </Button>
            </Tooltip>
            <Button variant="contained" startIcon={<ShareIcon />} onClick={handleShare}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}>
              Share
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>How it works</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {[
              { step: '1', text: 'Share your referral code with friends and family' },
              { step: '2', text: 'They register using your code and join a chit group' },
              { step: '3', text: 'You earn ₹500 reward for each successful referral' },
            ].map(({ step, text }) => (
              <Grid item xs={12} sm={4} key={step}>
                <Box textAlign="center">
                  <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1, width: 44, height: 44, fontWeight: 700 }}>{step}</Avatar>
                  <Typography variant="body2" color="text.secondary">{text}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Referral History */}
      <Typography variant="h6" gutterBottom>Referral History</Typography>
      {referrals.length === 0 ? (
        <Box textAlign="center" py={6}>
          <PeopleIcon sx={{ fontSize: 64, color: 'grey.300' }} />
          <Typography color="text.secondary" mt={1}>No referrals yet. Start sharing your code!</Typography>
        </Box>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <List>
            {referrals.map((r, i) => (
              <React.Fragment key={r._id || i}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>{(r.full_name || 'R')[0].toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={r.full_name || 'Unknown Member'}
                    secondary={`Joined: ${r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}`}
                  />
                  <Chip
                    label={r.reward_status || 'pending'}
                    size="small"
                    color={r.reward_status === 'paid' ? 'success' : 'warning'}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </ListItem>
                {i < referrals.length - 1 && <Divider inset="72px" />}
              </React.Fragment>
            ))}
          </List>
        </Card>
      )}
    </Container>
  );
};

export default Referrals;

