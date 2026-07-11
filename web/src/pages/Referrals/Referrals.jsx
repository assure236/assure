import React, { useState, useEffect } from 'react';
import {
  Grid, Typography, Box, Button, Alert,
  CircularProgress, Divider, List, ListItem, ListItemAvatar, ListItemText,
  Avatar, Chip, Tooltip
} from '@mui/material';
import { ContentCopy as CopyIcon, Share as ShareIcon, People as PeopleIcon, CardGiftcard as GiftIcon } from '@mui/icons-material';
import axios from 'axios';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { useDisplayUser } from '../../hooks/useDisplayUser';
import { toast } from 'react-toastify';
import { PageShell, PageHeader, Surface, MetricTile, EmptyState, SectionTitle } from '../../components/ui/PageKit';
import { brand, fmtINR } from '../../theme/brand';

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
    const msg = `Join Assure Chit Funds using my referral code ${referralCode}. When you pay your first subscription, I earn ₹500 credited to my Assure wallet. Sign up at https://assurechitfunds.com/register`;
    if (navigator.share) {
      navigator.share({ title: 'Assure ChitFunds Referral', text: msg }).catch(() => {});
    } else {
      navigator.clipboard.writeText(msg);
      toast.success('Referral message copied to clipboard!');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (error) return <PageShell><Alert severity="error">{error}</Alert></PageShell>;

  const referrals = data?.referrals || [];
  const totalEarnings = data?.total_earnings || 0;
  const pendingEarnings = data?.pending_earnings || 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Rewards"
        title="Refer & Earn"
        subtitle="Share your code and earn when friends join and pay their first subscription"
      />

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <MetricTile label="Total Referrals" value={referrals.length} icon={<PeopleIcon />} tone="navy" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricTile label="Total Earnings" value={fmtINR(totalEarnings)} icon={<GiftIcon />} tone="green" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricTile label="Pending Rewards" value={fmtINR(pendingEarnings)} icon={<GiftIcon />} tone="gold" />
        </Grid>
      </Grid>

      <Surface
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, ${brand.navy} 0%, ${brand.royal} 100%)`,
          color: '#fff',
          border: 'none',
        }}
      >
        <Typography variant="subtitle1" sx={{ opacity: 0.85, mb: 1 }}>Your Referral Code</Typography>
        <Typography
          variant="h3"
          fontWeight={800}
          letterSpacing={4}
          sx={{ mb: 2, fontFamily: brand.fontDisplay }}
        >
          {referralCode}
        </Typography>
        <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap">
          <Tooltip title="Copy code">
            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={handleCopy}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: brand.gold } }}
            >
              Copy
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<ShareIcon />}
            onClick={handleShare}
            sx={{ bgcolor: brand.gold, color: brand.navy, fontWeight: 700, '&:hover': { bgcolor: brand.goldSoft } }}
          >
            Share
          </Button>
        </Box>
      </Surface>

      <Surface sx={{ mb: 3 }}>
        <SectionTitle title="How it works" />
        <Grid container spacing={2}>
          {[
            { step: '1', text: 'Share your referral code with friends and family' },
            { step: '2', text: 'They register using your code and join a chit group' },
            { step: '3', text: 'When they pay their first subscription, you qualify for ₹500' },
            { step: '4', text: '₹500 is auto-credited to your Assure wallet — withdraw anytime to your registered bank account' },
          ].map(({ step, text }) => (
            <Grid item xs={12} sm={6} md={3} key={step}>
              <Box textAlign="center">
                <Avatar sx={{ bgcolor: brand.navy, mx: 'auto', mb: 1, width: 44, height: 44, fontWeight: 700 }}>{step}</Avatar>
                <Typography variant="body2" color="text.secondary">{text}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Surface>

      <SectionTitle title="Referral History" />
      {referrals.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<PeopleIcon sx={{ fontSize: 32 }} />}
            title="No referrals yet"
            description="Start sharing your code to earn rewards when friends join."
          />
        </Surface>
      ) : (
        <Surface padded={false}>
          <List>
            {referrals.map((r, i) => (
              <React.Fragment key={r._id || i}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: brand.mist, color: brand.navy }}>{(r.full_name || 'R')[0].toUpperCase()}</Avatar>
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
                {i < referrals.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Surface>
      )}
    </PageShell>
  );
};

export default Referrals;
