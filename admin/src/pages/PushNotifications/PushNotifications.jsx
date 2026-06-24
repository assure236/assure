import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Dialog, DialogContent,
  DialogActions, TextField, MenuItem, Alert, CircularProgress, Grid, Card,
  CardContent, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, FormControl, InputLabel, Select,
  Autocomplete, Avatar, Divider, ToggleButton, ToggleButtonGroup,
  LinearProgress, Switch, Tabs, Tab,
} from '@mui/material';
import {
  Send, Refresh, NotificationsActive, Campaign, People, Person,
  Gavel, AccountBalance, EmojiEvents, TrendingUp, CheckCircle,
  Warning, Star, Schedule, Notifications, SmartToy, Bolt,
  Payment, FiberNew, CreditScore, PersonOff, MoneyOff,
} from '@mui/icons-material';
import axios from 'axios';
import { securityLogger } from '../../utils/securityLogger';

const API = process.env.REACT_APP_API_URL;

const NOTIFICATION_TYPES = [
  { value: 'general', label: 'General', icon: <Notifications />, color: '#0B1F3B' },
  { value: 'payment_reminder', label: 'Payment Reminder', icon: <AccountBalance />, color: '#e65100' },
  { value: 'payment_received', label: 'Payment Received', icon: <Payment />, color: '#2e7d32' },
  { value: 'auction_alert', label: 'Auction Alert', icon: <Gavel />, color: '#d32f2f' },
  { value: 'auction_result', label: 'Auction Result', icon: <EmojiEvents />, color: '#f9a825' },
  { value: 'dividend_credit', label: 'Dividend Credit', icon: <TrendingUp />, color: '#2e7d32' },
  { value: 'kyc_update', label: 'KYC Update', icon: <CheckCircle />, color: '#0288d1' },
  { value: 'promotional', label: 'Promotional', icon: <Campaign />, color: '#7b1fa2' },
  { value: 'referral_bonus', label: 'Referral Bonus', icon: <Star />, color: '#ff6f00' },
];

const AUTOMATED_JOBS = [
  { key: 'welcome', label: 'Welcome Notification', desc: 'Sent instantly when a new user registers their device', schedule: 'Instant', icon: <FiberNew />, color: '#0B1F3B' },
  { key: 'kyc', label: 'KYC Reminder', desc: 'Daily reminder to users with pending/rejected KYC', schedule: 'Daily 9:00 AM', icon: <CreditScore />, color: '#0288d1' },
  { key: 'pay_due', label: 'Payment Due Reminder', desc: '3 days before, 1 day before, and on due date', schedule: 'Daily 8:30 AM', icon: <AccountBalance />, color: '#e65100' },
  { key: 'overdue', label: 'Overdue Payment Alert', desc: 'Escalating alerts for overdue payments (1d, 7d, 14d+)', schedule: 'Daily 6:30 PM', icon: <Warning />, color: '#d32f2f' },
  { key: 'auction_remind', label: 'Auction Reminder', desc: '1 day before and 1 hour before scheduled auctions', schedule: 'Every 30 min', icon: <Gavel />, color: '#f44336' },
  { key: 'auction_result', label: 'Auction Results', desc: 'Winner congratulations + member results when auction completes', schedule: 'Every 5 min', icon: <EmojiEvents />, color: '#f9a825' },
  { key: 'monthly', label: 'Monthly Installment Heads-up', desc: 'Reminds all group members about next month payment', schedule: '25th of month 10 AM', icon: <Schedule />, color: '#ff6f00' },
  { key: 'profile', label: 'Profile Completion Nudge', desc: 'Prompts users to add PAN, bank account, address', schedule: 'Tue & Fri 11 AM', icon: <Person />, color: '#5c6bc0' },
  { key: 'inactivity', label: 'Inactivity Nudge', desc: 'Re-engages users who haven\'t opened app in 7+ days', schedule: 'Sundays 5 PM', icon: <PersonOff />, color: '#78909c' },
  { key: 'pay_received', label: 'Payment Receipt', desc: 'Thank-you notification when payment is received', schedule: 'Every 10 min', icon: <Payment />, color: '#2e7d32' },
  { key: 'new_group', label: 'New Group Announcement', desc: 'Broadcasts to all members when a new chit group is created', schedule: 'Every 15 min', icon: <FiberNew />, color: '#7b1fa2' },
  { key: 'dividend', label: 'Dividend Credited', desc: 'Notifies when dividend is credited to wallet', schedule: 'Every 10 min', icon: <MoneyOff />, color: '#00c853' },
  { key: 'monday', label: 'Monday Engagement', desc: 'Weekly motivational tips and engagement', schedule: 'Mondays 8 AM', icon: <Bolt />, color: '#D4AF37' },
];

const CAMPAIGN_TEMPLATES = [
  { label: 'New Chit Group Launch', title: '\u{1F195} New Chit Group Available!', message: 'A brand new chit group has been launched! Join now to start saving and earn great dividends. Limited slots available \u2014 register today!', type: 'promotional', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '\u{1F195}' },
  { label: 'Auction Starting Soon', title: '\u{1F534} Live Auction Starting!', message: 'Your chit group auction is about to begin! Log in now to place your bid and win the prize amount. Don\'t miss out!', type: 'auction_alert', gradient: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)', emoji: '\u{1F534}' },
  { label: 'Auction Today', title: '\u23F0 Don\'t Miss Today\'s Auction!', message: 'Reminder: Your chit group auction is happening today! Open the app now to participate and get the best deal.', type: 'auction_alert', gradient: 'linear-gradient(135deg, #ff5722 0%, #D4AF37 100%)', emoji: '\u23F0' },
  { label: 'Auction Result', title: '\u{1F3C6} Auction Results Are Out!', message: 'The auction for your chit group is complete! Check the app to see the winner, your dividend amount, and next month\'s installment.', type: 'auction_result', gradient: 'linear-gradient(135deg, #f9a825 0%, #ff8f00 100%)', emoji: '\u{1F3C6}' },
  { label: 'Auction Winner', title: '\u{1F389} Congratulations \u2014 You Won!', message: 'You are the winning bidder! Your prize amount will be disbursed to your bank account within 24 hours. Check the app for details.', type: 'auction_result', gradient: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)', emoji: '\u{1F389}' },
  { label: 'Payment Reminder', title: '\u23F0 Payment Due Reminder', message: 'Your monthly chit installment is due. Please make your payment on time to maintain your membership and avoid late fees.', type: 'payment_reminder', gradient: 'linear-gradient(135deg, #D4AF37 0%, #f44336 100%)', emoji: '\u23F0' },
  { label: 'Referral Bonus', title: '\u{1F381} Earn \u20B9500 \u2014 Refer a Friend!', message: 'Invite your friends to Assure ChitFunds and earn \u20B9500 for every successful referral! Share your code now from the Referrals section.', type: 'promotional', gradient: 'linear-gradient(135deg, #43a047 0%, #1b5e20 100%)', emoji: '\u{1F381}' },
  { label: 'Dividend Credited', title: '\u{1F4B8} Dividend Credited!', message: 'Great news! Your monthly dividend has been credited to your wallet. Check your payment history for details.', type: 'dividend_credit', gradient: 'linear-gradient(135deg, #00c853 0%, #64dd17 100%)', emoji: '\u{1F4B8}' },
  { label: 'KYC Reminder', title: '\u{1F4CB} Complete Your KYC Today', message: 'Your KYC verification is pending. Complete it now to unlock all features including bidding, payments, and dividends.', type: 'kyc_update', gradient: 'linear-gradient(135deg, #0288d1 0%, #26c6da 100%)', emoji: '\u{1F4CB}' },
  { label: 'Festival Offer', title: '\u{1F38A} Festival Special \u2014 Join & Save!', message: 'Celebrate this festive season with Assure ChitFunds! Join a new chit group today and enjoy special benefits. Limited time offer!', type: 'promotional', gradient: 'linear-gradient(135deg, #ff6f00 0%, #ffca28 100%)', emoji: '\u{1F38A}' },
  { label: 'Welcome Member', title: '\u{1F64F} Welcome to Assure ChitFunds!', message: 'Thank you for joining our family! Explore your dashboard to view chit groups, track payments, and participate in auctions.', type: 'general', gradient: 'linear-gradient(135deg, #0B1F3B 0%, #1E3A8A 100%)', emoji: '\u{1F64F}' },
  { label: 'Late Fee Warning', title: '\u26A0\uFE0F Late Fee Applied', message: 'A late fee has been applied to your overdue payment. Pay immediately to avoid further penalties and protect your credit score.', type: 'payment_reminder', gradient: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)', emoji: '\u26A0\uFE0F' },
];

export default function PushNotifications() {
  const [tab, setTab] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendDialog, setSendDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, withTokens: 0, kycPending: 0, todayPush: 0 });
  const [typeFilter, setTypeFilter] = useState('all');

  const [form, setForm] = useState({
    mode: 'broadcast', title: '', message: '', type: 'promotional', user_id: null,
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: page + 1, limit: 20, channel: 'push' };
      if (typeFilter !== 'all') params.type = typeFilter;
      const res = await axios.get(`${API}/admin/communications`, { params });
      setNotifications(res.data.data?.logs || []);
      setTotal(res.data.data?.total || 0);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, { params: { limit: 500, view: 'lookup' } });
      const allUsers = res.data.data?.users || [];
      setUsers(allUsers);
      const withTokens = allUsers.filter((u) => u.has_fcm_token).length;
      const kycPending = allUsers.filter(u => u.kyc_status !== 'verified').length;
      setStats(s => ({ ...s, total: allUsers.length, withTokens, kycPending }));
    } catch (e) {
      // SECURITY FIX: sanitize admin notification error logging.
      securityLogger.error('Push notification users fetch failed', { status: e?.response?.status });
    }
  }, []);

  const fetchTodayCount = useCallback(async () => {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const res = await axios.get(`${API}/admin/communications`, {
        params: { channel: 'push', limit: 1, from_date: todayStart.toISOString() }
      });
      setStats(s => ({ ...s, todayPush: res.data.data?.total || 0 }));
    } catch (_) {}
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchUsers(); fetchTodayCount(); }, [fetchUsers, fetchTodayCount]);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) { setError('Title and message are required'); return; }
    if (form.mode === 'individual' && !form.user_id) { setError('Please select a user'); return; }
    try {
      setSending(true); setError('');
      if (form.mode === 'broadcast') {
        const res = await axios.post(`${API}/notifications/broadcast`, { title: form.title, message: form.message, type: form.type });
        const pushInfo = res.data.push;
        setSuccess(`Campaign sent! Push: ${pushInfo?.sent || 0} delivered, ${pushInfo?.failed || 0} failed out of ${pushInfo?.total_tokens || 0} devices.`);
      } else {
        await axios.post(`${API}/notifications/send`, { user_id: form.user_id, title: form.title, message: form.message, type: form.type });
        setSuccess('Notification sent to member successfully!');
      }
      setSendDialog(false);
      setForm({ mode: 'broadcast', title: '', message: '', type: 'promotional', user_id: null });
      fetchNotifications(); fetchUsers(); fetchTodayCount();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send notification');
    } finally { setSending(false); }
  };

  const applyTemplate = (template) => {
    setForm(f => ({ ...f, title: template.title, message: template.message, type: template.type }));
    setSendDialog(true);
  };

  const deliveryRate = stats.total > 0 ? Math.round((stats.withTokens / stats.total) * 100) : 0;

  return (
    <Box>
      {/* Header Banner */}
      <Box sx={{
        background: 'linear-gradient(135deg, #071428 0%, #1E3A8A 100%)',
        borderRadius: 3, p: 3, mb: 3, color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2
      }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Campaign sx={{ fontSize: 36 }} /> Push Notification Center
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Automated + manual push notifications for all your members
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={() => { fetchNotifications(); fetchUsers(); fetchTodayCount(); }}
            variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white' } }}>
            Refresh
          </Button>
          <Button startIcon={<Send />} variant="contained" onClick={() => setSendDialog(true)}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, fontWeight: 700 }}>
            Manual Campaign
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Members', value: stats.total, icon: <People />, bg: '#E8EDF5', color: '#1E3A8A' },
          { label: 'Push Enabled', value: stats.withTokens, icon: <NotificationsActive />, bg: '#e8f5e9', color: '#2e7d32' },
          { label: 'Delivery Rate', value: `${deliveryRate}%`, icon: <TrendingUp />, bg: '#f3e5f5', color: '#7b1fa2', progress: deliveryRate },
          { label: 'KYC Pending', value: stats.kycPending, icon: <CreditScore />, bg: '#FDF8E8', color: '#e65100' },
          { label: "Today's Push", value: stats.todayPush, icon: <Bolt />, bg: '#e0f7fa', color: '#00838f' },
          { label: 'Automations Active', value: AUTOMATED_JOBS.length, icon: <SmartToy />, bg: '#fce4ec', color: '#c62828' },
        ].map((s, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Card sx={{ borderRadius: 3, background: `linear-gradient(135deg, ${s.bg}, ${s.bg})`, border: 'none', boxShadow: 'none' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 10 }}>{s.label}</Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: s.color, width: 36, height: 36 }}>{s.icon}</Avatar>
                </Box>
                {s.progress != null && (
                  <LinearProgress variant="determinate" value={s.progress}
                    sx={{ mt: 0.5, borderRadius: 2, height: 4, bgcolor: `${s.color}15`, '& .MuiLinearProgress-bar': { bgcolor: s.color } }} />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ bgcolor: '#F1F5F9', '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' } }}>
          <Tab icon={<SmartToy sx={{ fontSize: 18 }} />} iconPosition="start" label="Automations" />
          <Tab icon={<Star sx={{ fontSize: 18 }} />} iconPosition="start" label="Quick Templates" />
          <Tab icon={<Schedule sx={{ fontSize: 18 }} />} iconPosition="start" label="Campaign History" />
        </Tabs>
      </Paper>

      {/* TAB 0: Automations */}
      {tab === 0 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmartToy sx={{ color: '#1E3A8A' }} /> Automated Push Notifications
              </Typography>
              <Typography variant="body2" color="text.secondary">
                These run automatically. Members receive the right notification at the right time.
              </Typography>
            </Box>
            <Chip icon={<Bolt />} label="All Active" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
          </Box>

          <Grid container spacing={2}>
            {AUTOMATED_JOBS.map((job) => (
              <Grid item xs={12} sm={6} md={4} key={job.key}>
                <Card sx={{
                  borderRadius: 2.5, border: '1px solid #e0e0e0', height: '100%',
                  transition: 'all 0.2s', '&:hover': { boxShadow: 3, borderColor: job.color },
                }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <Avatar sx={{ bgcolor: `${job.color}15`, color: job.color, width: 40, height: 40 }}>
                        {job.icon}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{job.label}</Typography>
                        <Chip label={job.schedule} size="small" sx={{ fontSize: 10, height: 20, bgcolor: '#F1F5F9', fontWeight: 600 }} />
                      </Box>
                      <Switch checked={true} size="small" color="success" disabled />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                      {job.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }} icon={<SmartToy />}>
            <strong>How it works:</strong> The server runs scheduled jobs using node-cron. Each job checks for eligible users, deduplicates (won't send the same notification twice per day), creates an in-app notification, and sends a Firebase push to the user's device. Invalid FCM tokens are automatically cleaned.
          </Alert>
        </Paper>
      )}

      {/* TAB 1: Templates */}
      {tab === 1 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Star sx={{ color: '#f9a825' }} /> Quick Campaign Templates
            </Typography>
            <Chip label={`${CAMPAIGN_TEMPLATES.length} templates`} size="small" color="secondary" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click any template to customize and send manually. Use these for special occasions, announcements, or targeted campaigns.
          </Typography>
          <Grid container spacing={2}>
            {CAMPAIGN_TEMPLATES.map((t, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card onClick={() => applyTemplate(t)}
                  sx={{
                    cursor: 'pointer', borderRadius: 2.5, overflow: 'hidden',
                    transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                    height: '100%', display: 'flex', flexDirection: 'column',
                  }}>
                  <Box sx={{ background: t.gradient, py: 2, px: 2, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{t.emoji}</Typography>
                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, mt: 0.5, fontSize: 12 }}>
                      {t.label}
                    </Typography>
                  </Box>
                  <CardContent sx={{ flexGrow: 1, py: 1.5, px: 2 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, fontSize: 11 }}>
                      {t.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 10 }}>
                      {t.message}
                    </Typography>
                  </CardContent>
                  <Box sx={{ px: 2, pb: 1.5 }}>
                    <Chip label="Use Template" size="small" color="primary" variant="outlined"
                      sx={{ width: '100%', fontSize: 10, fontWeight: 600 }} />
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* TAB 2: History */}
      {tab === 2 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule /> All Push Notifications
            </Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Filter by Type</InputLabel>
              <Select value={typeFilter} label="Filter by Type" onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
                <MenuItem value="all">All Types</MenuItem>
                {NOTIFICATION_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ color: t.color, display: 'flex' }}>{t.icon}</Box> {t.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Campaign sx={{ fontSize: 64, color: 'grey.300' }} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No notifications found. Automated push notifications will appear here as they are sent.
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      {['Type', 'Notification', 'Recipients', 'Sent At'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {notifications.map((n, i) => {
                      const typeConfig = NOTIFICATION_TYPES.find(t => t.value === n.type) || NOTIFICATION_TYPES[0];
                      return (
                        <TableRow key={n._id || i} hover>
                          <TableCell>
                            <Chip icon={typeConfig.icon} label={typeConfig.label} size="small"
                              sx={{ bgcolor: typeConfig.color + '18', color: typeConfig.color, fontWeight: 600, '& .MuiChip-icon': { color: typeConfig.color }, fontSize: 11 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{n.subject || n.title || 'Notification'}</Typography>
                            <Typography variant="caption" color="text.secondary"
                              sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 11 }}>
                              {n.message?.substring(0, 120)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={n.sent_count || n.recipient_type || 'All'} size="small" variant="outlined"
                              icon={<People sx={{ fontSize: '14px !important' }} />} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontSize: 11 }}>
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
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={sendDialog} onClose={() => setSendDialog(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #071428, #1E3A8A)', p: 2.5, color: 'white' }}>
          <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Campaign /> Send Manual Campaign
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>Compose a push notification to engage your members</Typography>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <Grid container>
            <Grid item xs={12} md={7} sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>AUDIENCE</Typography>
                  <ToggleButtonGroup value={form.mode} exclusive
                    onChange={(_, val) => val && setForm(f => ({ ...f, mode: val, user_id: null }))}
                    fullWidth size="small" sx={{ '& .Mui-selected': { bgcolor: '#071428 !important', color: 'white !important' } }}>
                    <ToggleButton value="broadcast"><People sx={{ mr: 1, fontSize: 18 }} /> All Members ({stats.withTokens})</ToggleButton>
                    <ToggleButton value="individual"><Person sx={{ mr: 1, fontSize: 18 }} /> Individual</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {form.mode === 'individual' && (
                  <Autocomplete options={users}
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
                          ? <Chip label="Push OK" size="small" color="success" variant="outlined" sx={{ ml: 'auto', fontSize: 10 }} />
                          : <Chip label="No Push" size="small" color="default" variant="outlined" sx={{ ml: 'auto', fontSize: 10 }} />
                        }
                      </Box>
                    )}
                    renderInput={(params) => <TextField {...params} label="Search Member" size="small" placeholder="Name or mobile..." />}
                    size="small" />
                )}

                <FormControl fullWidth size="small">
                  <InputLabel>Notification Type</InputLabel>
                  <Select value={form.type} label="Notification Type" onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {NOTIFICATION_TYPES.map(t => (
                      <MenuItem key={t.value} value={t.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ color: t.color }}>{t.icon}</Box> {t.label}</Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField label="Notification Title" size="small" fullWidth
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  inputProps={{ maxLength: 100 }} helperText={`${form.title.length}/100`}
                  placeholder="e.g., Live Auction Starting Now!" />

                <TextField label="Message Body" size="small" fullWidth multiline rows={4}
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  inputProps={{ maxLength: 500 }} helperText={`${form.message.length}/500`}
                  placeholder="Write your campaign message here..." />

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Quick Fill:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {CAMPAIGN_TEMPLATES.slice(0, 6).map((t) => (
                      <Chip key={t.label} label={t.emoji + ' ' + t.label} size="small" variant="outlined"
                        onClick={() => setForm(f => ({ ...f, title: t.title, message: t.message, type: t.type }))}
                        clickable sx={{ fontSize: 10 }} />
                    ))}
                  </Box>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={5} sx={{ bgcolor: '#F1F5F9', p: 3, borderLeft: '1px solid #e0e0e0' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 2, display: 'block' }}>NOTIFICATION PREVIEW</Typography>
              <Paper sx={{ borderRadius: 2, overflow: 'hidden', maxWidth: 320 }}>
                <Box sx={{ bgcolor: '#f8f9fa', p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="img" src="/logo.png" alt="AC" sx={{ width: 24, height: 24, borderRadius: '50%' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                  <Typography variant="caption" fontWeight={600} color="text.secondary">Assure ChitFunds</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>now</Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>{form.title || 'Notification Title'}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                    {form.message || 'Your notification message will appear here...'}
                  </Typography>
                </Box>
              </Paper>
              <Box sx={{ mt: 3, p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" gutterBottom display="block">DELIVERY SUMMARY</Typography>
                {[
                  ['Audience', form.mode === 'broadcast' ? `All (${stats.withTokens} devices)` : 'Individual'],
                  ['Type', NOTIFICATION_TYPES.find(t => t.value === form.type)?.label || 'General'],
                  ['Channel', 'Push + In-App'],
                ].map(([k, v]) => (
                  <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="body2">{k}:</Typography>
                    <Typography variant="body2" fontWeight={700}>{v}</Typography>
                  </Box>
                ))}
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
              background: 'linear-gradient(135deg, #071428, #1E3A8A)', fontWeight: 700, px: 3,
              '&:hover': { background: 'linear-gradient(135deg, #0d1b6e, #651fff)' }
            }}>
            {sending ? 'Sending...' : form.mode === 'broadcast' ? `Send to ${stats.withTokens} Members` : 'Send Notification'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
