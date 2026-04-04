import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Alert, CircularProgress, Grid, Card,
  CardContent, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, FormControl, InputLabel, Select,
  Autocomplete, Avatar, Divider, ToggleButton, ToggleButtonGroup,
  LinearProgress
} from '@mui/material';
import {
  Send, Refresh, NotificationsActive, Campaign, People, Person,
  Gavel, AccountBalance, EmojiEvents, TrendingUp, CheckCircle,
  Warning, Star, Schedule, Notifications
} from '@mui/icons-material';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

const NOTIFICATION_TYPES = [
  { value: 'general', label: 'General', icon: <Notifications />, color: '#1976d2' },
  { value: 'payment_reminder', label: 'Payment Reminder', icon: <AccountBalance />, color: '#e65100' },
  { value: 'auction_alert', label: 'Auction Alert', icon: <Gavel />, color: '#d32f2f' },
  { value: 'auction_result', label: 'Auction Result', icon: <EmojiEvents />, color: '#f9a825' },
  { value: 'dividend_credit', label: 'Dividend Credit', icon: <TrendingUp />, color: '#2e7d32' },
  { value: 'kyc_update', label: 'KYC Update', icon: <CheckCircle />, color: '#0288d1' },
  { value: 'promotional', label: 'Promotional / Ad', icon: <Campaign />, color: '#7b1fa2' },
];

const CAMPAIGN_TEMPLATES = [
  {
    label: 'New Chit Group Launch',
    title: '🆕 New Chit Group Available!',
    message: 'A brand new chit group has been launched! Join now to start saving and earn great dividends. Limited slots available — register today!',
    type: 'promotional',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    emoji: '🆕',
  },
  {
    label: 'Auction Starting Soon',
    title: '🔴 Live Auction Starting!',
    message: 'Your chit group auction is about to begin! Log in now to place your bid and win the prize amount. Don\'t miss out!',
    type: 'auction_alert',
    gradient: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
    emoji: '🔴',
  },
  {
    label: 'Auction Today Reminder',
    title: '⏰ Don\'t Miss Today\'s Auction!',
    message: 'Reminder: Your chit group auction is happening today! Open the app now to participate and get the best deal.',
    type: 'auction_alert',
    gradient: 'linear-gradient(135deg, #ff5722 0%, #ff9800 100%)',
    emoji: '⏰',
  },
  {
    label: 'Auction Result',
    title: '🏆 Auction Results Are Out!',
    message: 'The auction for your chit group is complete! Check the app to see the winner, your dividend amount, and next month\'s installment.',
    type: 'auction_result',
    gradient: 'linear-gradient(135deg, #f9a825 0%, #ff8f00 100%)',
    emoji: '🏆',
  },
  {
    label: 'Auction Winner',
    title: '🎉 Congratulations — You Won the Auction!',
    message: 'You are the winning bidder! Your prize amount will be disbursed to your bank account within 24 hours. Check the app for details.',
    type: 'auction_result',
    gradient: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
    emoji: '🎉',
  },
  {
    label: 'Payment Reminder',
    title: '⏰ Payment Due Reminder',
    message: 'Your monthly chit installment is due. Please make your payment on time to maintain your membership and avoid late fees.',
    type: 'payment_reminder',
    gradient: 'linear-gradient(135deg, #ff9800 0%, #f44336 100%)',
    emoji: '⏰',
  },
  {
    label: 'Referral Bonus',
    title: '🎁 Earn ₹500 — Refer a Friend!',
    message: 'Invite your friends to Assure ChitFunds and earn ₹500 for every successful referral! Share your code now from the Referrals section.',
    type: 'promotional',
    gradient: 'linear-gradient(135deg, #43a047 0%, #1b5e20 100%)',
    emoji: '🎁',
  },
  {
    label: 'Dividend Credited',
    title: '💸 Dividend Credited to Your Account!',
    message: 'Great news! Your monthly dividend has been credited to your wallet. Check your payment history for details.',
    type: 'dividend_credit',
    gradient: 'linear-gradient(135deg, #00c853 0%, #64dd17 100%)',
    emoji: '💸',
  },
  {
    label: 'KYC Reminder',
    title: '📋 Complete Your KYC Today',
    message: 'Your KYC verification is pending. Complete it now to unlock all features including bidding, payments, and dividends.',
    type: 'kyc_update',
    gradient: 'linear-gradient(135deg, #0288d1 0%, #26c6da 100%)',
    emoji: '📋',
  },
  {
    label: 'Festival Offer',
    title: '🎊 Festival Special — Join & Save!',
    message: 'Celebrate this festive season with Assure ChitFunds! Join a new chit group today and enjoy special benefits. Limited time offer!',
    type: 'promotional',
    gradient: 'linear-gradient(135deg, #ff6f00 0%, #ffca28 100%)',
    emoji: '🎊',
  },
  {
    label: 'Welcome New Member',
    title: '🙏 Welcome to Assure ChitFunds!',
    message: 'Thank you for joining our family! Explore your dashboard to view chit groups, track payments, and participate in auctions.',
    type: 'general',
    gradient: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
    emoji: '🙏',
  },
];

export default function PushNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendDialog, setSendDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, withTokens: 0 });

  const [form, setForm] = useState({
    mode: 'broadcast',
    title: '',
    message: '',
    type: 'promotional',
    user_id: null,
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/communications`, {
        params: { page: page + 1, limit: 20, channel: 'push' }
      });
      setNotifications(res.data.data?.logs || []);
      setTotal(res.data.data?.total || 0);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, { params: { limit: 500 } });
      const allUsers = res.data.data?.users || [];
      setUsers(allUsers);
      setStats({
        total: allUsers.length,
        withTokens: allUsers.filter(u => u.fcm_token).length,
      });
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setError('Title and message are required');
      return;
    }
    if (form.mode === 'individual' && !form.user_id) {
      setError('Please select a user');
      return;
    }

    try {
      setSending(true);
      setError('');

      if (form.mode === 'broadcast') {
        const res = await axios.post(`${API}/notifications/broadcast`, {
          title: form.title,
          message: form.message,
          type: form.type,
        });
        const pushInfo = res.data.push;
        setSuccess(
          `🎉 Campaign sent! Push: ${pushInfo?.sent || 0} delivered, ${pushInfo?.failed || 0} failed out of ${pushInfo?.total_tokens || 0} devices.`
        );
      } else {
        await axios.post(`${API}/notifications/send`, {
          user_id: form.user_id,
          title: form.title,
          message: form.message,
          type: form.type,
        });
        setSuccess('✅ Notification sent to member successfully!');
      }

      setSendDialog(false);
      setForm({ mode: 'broadcast', title: '', message: '', type: 'promotional', user_id: null });
      fetchNotifications();
      fetchUsers();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (template) => {
    setForm(f => ({
      ...f,
      title: template.title,
      message: template.message,
      type: template.type,
    }));
    setSendDialog(true);
  };

  const deliveryRate = stats.total > 0 ? Math.round((stats.withTokens / stats.total) * 100) : 0;

  return (
    <Box>
      {/* Header Banner */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1a237e 0%, #7c4dff 100%)',
        borderRadius: 3, p: 3, mb: 3, color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2
      }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Campaign sx={{ fontSize: 36 }} /> Push Campaigns
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Send targeted notifications, promotions & alerts to your members
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={() => { fetchNotifications(); fetchUsers(); }}
            variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white' } }}>
            Refresh
          </Button>
          <Button startIcon={<Send />} variant="contained" onClick={() => setSendDialog(true)}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, fontWeight: 700 }}>
            New Campaign
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)', border: 'none', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Members</Typography>
                  <Typography variant="h4" fontWeight={800} color="#1565c0">{stats.total}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#1565c0', width: 48, height: 48 }}><People /></Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', border: 'none', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Push Enabled</Typography>
                  <Typography variant="h4" fontWeight={800} color="#2e7d32">{stats.withTokens}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#2e7d32', width: 48, height: 48 }}><NotificationsActive /></Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)', border: 'none', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Pending Setup</Typography>
                  <Typography variant="h4" fontWeight={800} color="#e65100">{stats.total - stats.withTokens}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#e65100', width: 48, height: 48 }}><Warning /></Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, background: 'linear-gradient(135deg, #f3e5f5, #e1bee7)', border: 'none', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Delivery Rate</Typography>
                  <Typography variant="h4" fontWeight={800} color="#7b1fa2">{deliveryRate}%</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#7b1fa2', width: 48, height: 48 }}><TrendingUp /></Avatar>
              </Box>
              <LinearProgress variant="determinate" value={deliveryRate}
                sx={{ mt: 1, borderRadius: 2, height: 6, bgcolor: 'rgba(123,31,162,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#7b1fa2' } }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Campaign Templates Grid */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Star sx={{ color: '#f9a825' }} /> Quick Campaign Templates
          </Typography>
          <Chip label={`${CAMPAIGN_TEMPLATES.length} templates`} size="small" color="secondary" />
        </Box>
        <Grid container spacing={2}>
          {CAMPAIGN_TEMPLATES.map((t, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card
                onClick={() => applyTemplate(t)}
                sx={{
                  cursor: 'pointer', borderRadius: 2.5, overflow: 'hidden',
                  transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  height: '100%', display: 'flex', flexDirection: 'column',
                }}
              >
                <Box sx={{ background: t.gradient, py: 2.5, px: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 32, lineHeight: 1 }}>{t.emoji}</Typography>
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, mt: 0.5 }}>
                    {t.label}
                  </Typography>
                </Box>
                <CardContent sx={{ flexGrow: 1, py: 1.5, px: 2 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, fontSize: 12 }}>
                    {t.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary"
                    sx={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.message}
                  </Typography>
                </CardContent>
                <Box sx={{ px: 2, pb: 1.5 }}>
                  <Chip label="Use Template" size="small" color="primary" variant="outlined"
                    sx={{ width: '100%', fontSize: 11, fontWeight: 600 }} />
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Campaign History */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule /> Campaign History
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Campaign sx={{ fontSize: 64, color: 'grey.300' }} />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No campaigns sent yet. Use a template above or create a custom campaign!
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    {['Type', 'Campaign', 'Recipients', 'Sent'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notifications.map((n, i) => {
                    const typeConfig = NOTIFICATION_TYPES.find(t => t.value === n.type) || NOTIFICATION_TYPES[0];
                    return (
                      <TableRow key={n._id || i} hover>
                        <TableCell>
                          <Chip
                            icon={typeConfig.icon}
                            label={typeConfig.label}
                            size="small"
                            sx={{ bgcolor: typeConfig.color + '18', color: typeConfig.color, fontWeight: 600, '& .MuiChip-icon': { color: typeConfig.color } }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{n.subject || n.title || 'Notification'}</Typography>
                          <Typography variant="caption" color="text.secondary"
                            sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {n.message?.substring(0, 120)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={n.sent_count || n.recipient_type || 'All'} size="small" variant="outlined"
                            icon={<People sx={{ fontSize: '14px !important' }} />} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={20} rowsPerPageOptions={[20]} />
          </>
        )}
      </Paper>

      {/* Create Campaign Dialog - Premium UI */}
      <Dialog open={sendDialog} onClose={() => setSendDialog(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1a237e, #7c4dff)', p: 2.5, color: 'white' }}>
          <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Campaign /> Create Campaign
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Compose a push notification to engage your members
          </Typography>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <Grid container>
            {/* Left - Form */}
            <Grid item xs={12} md={7} sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Audience Toggle */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
                    AUDIENCE
                  </Typography>
                  <ToggleButtonGroup value={form.mode} exclusive
                    onChange={(_, val) => val && setForm(f => ({ ...f, mode: val, user_id: null }))}
                    fullWidth size="small" sx={{ '& .Mui-selected': { bgcolor: '#1a237e !important', color: 'white !important' } }}>
                    <ToggleButton value="broadcast">
                      <People sx={{ mr: 1, fontSize: 18 }} /> All Members ({stats.withTokens})
                    </ToggleButton>
                    <ToggleButton value="individual">
                      <Person sx={{ mr: 1, fontSize: 18 }} /> Individual
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {form.mode === 'individual' && (
                  <Autocomplete
                    options={users}
                    getOptionLabel={(u) => `${u.full_name || u.mobile} (${u.mobile})`}
                    onChange={(_, value) => setForm(f => ({ ...f, user_id: value?._id || value?.id || null }))}
                    renderOption={(props, u) => (
                      <Box component="li" {...props} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: u.fcm_token ? '#2e7d32' : '#9e9e9e' }}>
                          {(u.full_name || 'U')[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{u.full_name || u.mobile}</Typography>
                          <Typography variant="caption" color="text.secondary">{u.mobile}</Typography>
                        </Box>
                        {u.fcm_token
                          ? <Chip label="Push ✓" size="small" color="success" variant="outlined" sx={{ ml: 'auto', fontSize: 10 }} />
                          : <Chip label="No Push" size="small" color="default" variant="outlined" sx={{ ml: 'auto', fontSize: 10 }} />
                        }
                      </Box>
                    )}
                    renderInput={(params) => <TextField {...params} label="Search Member" size="small" placeholder="Name or mobile..." />}
                    size="small"
                  />
                )}

                {/* Notification Type */}
                <FormControl fullWidth size="small">
                  <InputLabel>Notification Type</InputLabel>
                  <Select value={form.type} label="Notification Type"
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {NOTIFICATION_TYPES.map(t => (
                      <MenuItem key={t.value} value={t.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ color: t.color }}>{t.icon}</Box> {t.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField label="Notification Title" size="small" fullWidth
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  inputProps={{ maxLength: 100 }}
                  helperText={`${form.title.length}/100 — Keep it catchy and under 60 chars for best display`}
                  placeholder="e.g., 🔴 Live Auction Starting Now!" />

                <TextField label="Message Body" size="small" fullWidth multiline rows={4}
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  inputProps={{ maxLength: 500 }}
                  helperText={`${form.message.length}/500`}
                  placeholder="Write your campaign message here. Use emojis 🎉 to make it engaging!" />

                {/* Quick Fill */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Quick Fill:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {CAMPAIGN_TEMPLATES.slice(0, 5).map((t) => (
                      <Chip key={t.label} label={t.emoji + ' ' + t.label} size="small" variant="outlined"
                        onClick={() => setForm(f => ({ ...f, title: t.title, message: t.message, type: t.type }))}
                        clickable sx={{ fontSize: 11 }} />
                    ))}
                  </Box>
                </Box>
              </Box>
            </Grid>

            {/* Right - Phone Preview */}
            <Grid item xs={12} md={5} sx={{ bgcolor: '#f5f5f5', p: 3, borderLeft: '1px solid #e0e0e0' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 2, display: 'block' }}>
                📱 NOTIFICATION PREVIEW
              </Typography>

              {/* Android notification preview */}
              <Paper sx={{ borderRadius: 2, overflow: 'hidden', maxWidth: 320 }}>
                <Box sx={{ bgcolor: '#f8f9fa', p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="img" src="/logo.png" alt="AC" sx={{ width: 24, height: 24, borderRadius: '50%' }} />
                  <Typography variant="caption" fontWeight={600} color="text.secondary">Assure ChitFunds</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>now</Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                    {form.title || 'Notification Title'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                    {form.message || 'Your notification message will appear here...'}
                  </Typography>
                </Box>
              </Paper>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" gutterBottom display="block">
                  DELIVERY SUMMARY
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2">Audience:</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {form.mode === 'broadcast' ? `All (${stats.withTokens} devices)` : 'Individual'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="body2">Type:</Typography>
                  <Chip label={NOTIFICATION_TYPES.find(t => t.value === form.type)?.label || 'General'}
                    size="small" sx={{ fontSize: 11 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="body2">Channel:</Typography>
                  <Typography variant="body2" fontWeight={700}>Push + In-App</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setSendDialog(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" startIcon={sending ? <CircularProgress size={18} /> : <Send />}
            onClick={handleSend} disabled={sending}
            sx={{
              background: 'linear-gradient(135deg, #1a237e, #7c4dff)',
              fontWeight: 700, px: 3,
              '&:hover': { background: 'linear-gradient(135deg, #0d1b6e, #651fff)' }
            }}>
            {sending ? 'Sending...' : form.mode === 'broadcast' ? `Send to ${stats.withTokens} Members` : 'Send Notification'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
