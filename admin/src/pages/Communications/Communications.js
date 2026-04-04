import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, CircularProgress, Grid, Card, CardContent, Divider, FormControl,
  InputLabel, Select, ToggleButtonGroup, ToggleButton, Autocomplete, Avatar,
  IconButton, Tooltip
} from '@mui/material';
import {
  Send, Refresh, Sms, Email, Campaign, Notifications, People, Person,
  Gavel, Payment, Description, EmojiEvents, Warning, Celebration, Close
} from '@mui/icons-material';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

const CHANNELS = [
  { value: 'push', label: 'Push Notification', icon: <Notifications />, color: '#7c4dff', desc: 'In-app + FCM push' },
  { value: 'sms', label: 'SMS', icon: <Sms />, color: '#00897b', desc: 'Fast2SMS DLT route' },
  { value: 'email', label: 'Email', icon: <Email />, color: '#1976d2', desc: 'Resend API' },
];

const RECIPIENTS = [
  { value: 'all', label: 'All Active Members', icon: <People /> },
  { value: 'individual', label: 'Individual Member', icon: <Person /> },
  { value: 'overdue', label: 'Overdue Members', icon: <Warning /> },
  { value: 'kyc_pending', label: 'KYC Pending', icon: <Description /> },
];

const TEMPLATES = [
  { key: 'auction_notice', label: '🔨 Auction Notice', subject: 'Auction Starting Soon!', message: 'Dear member, the auction for your chit group is scheduled soon. Log in to the app to participate and place your bid. Highest bidder wins! — Assure ChitFunds', channel: 'push' },
  { key: 'auction_result', label: '🏆 Auction Result', subject: 'Auction Results Are Out!', message: 'Dear member, the auction for your chit group has been completed. Check the app to see results and your dividend details. — Assure ChitFunds', channel: 'push' },
  { key: 'auction_reminder', label: '⏰ Auction Reminder', subject: 'Don\'t Miss Today\'s Auction!', message: 'Reminder: Your chit group auction is happening today! Open the app and participate to get the best deal. — Assure ChitFunds', channel: 'push' },
  { key: 'installment_reminder', label: '💰 Payment Reminder', subject: 'Installment Due', message: 'Dear member, your chit fund installment is due. Please pay on time to maintain your good standing. Pay now via the app! — Assure ChitFunds', channel: 'sms' },
  { key: 'overdue_warning', label: '⚠️ Overdue Warning', subject: 'Payment Overdue', message: 'Dear member, your chit fund payment is overdue. Kindly clear your dues immediately to avoid penalties. — Assure ChitFunds', channel: 'sms' },
  { key: 'kyc_pending', label: '📝 KYC Reminder', subject: 'Complete Your KYC', message: 'Dear member, your KYC is incomplete. Please upload your documents in the app to unlock all features and join chit groups. — Assure ChitFunds', channel: 'push' },
  { key: 'welcome', label: '🙏 Welcome Message', subject: 'Welcome to Assure ChitFunds!', message: 'Welcome to Assure ChitFunds! Your membership is now active. Download our app to track your chit fund and earn dividends. — Assure ChitFunds', channel: 'email' },
  { key: 'dividend_credited', label: '💸 Dividend Credited', subject: 'Dividend Credited to Wallet', message: 'Great news! Your dividend from the latest auction has been credited to your wallet. Check the app for details. — Assure ChitFunds', channel: 'push' },
  { key: 'new_group', label: '🆕 New Chit Group', subject: 'New Chit Group Launched!', message: 'A new chit group has been launched! Join now to start saving and earn great dividends. Limited slots — register today! — Assure ChitFunds', channel: 'push' },
  { key: 'festive', label: '🎉 Festive Offer', subject: 'Festive Season Special!', message: 'Celebrate this festive season with Assure ChitFunds! Join a new chit group and enjoy special benefits. Limited time offer! — Assure ChitFunds', channel: 'email' },
];

const channelIcon = (ch) => ({ sms: <Sms fontSize="small" />, email: <Email fontSize="small" />, push: <Notifications fontSize="small" /> }[ch] || <Send fontSize="small" />);
const channelColor = (ch) => ({ sms: 'info', email: 'primary', push: 'secondary' }[ch] || 'default');
const channelBg = (ch) => ({ sms: '#e0f2f1', email: '#e3f2fd', push: '#ede7f6' }[ch] || '#f5f5f5');

export default function Communications() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendDialog, setSendDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    channel: 'push', recipient_type: 'all', subject: '', message: '', user_ids: []
  });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/communications`, { params: { page: page + 1, limit: 20 } });
      setLogs(res.data.data?.logs || []);
      setTotal(res.data.data?.total || 0);
    } catch { setError('Failed to load communication logs'); }
    finally { setLoading(false); }
  }, [page]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, { params: { limit: 500 } });
      setUsers(res.data.data?.users || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSend = async () => {
    if (!form.message.trim()) { setError('Message is required'); return; }
    if (form.recipient_type === 'individual' && !form.user_ids.length) { setError('Please select at least one member'); return; }
    try {
      setSending(true); setError('');
      const payload = {
        channel: form.channel,
        recipient_type: form.recipient_type,
        subject: form.subject,
        message: form.message,
      };
      if (form.recipient_type === 'individual') payload.user_ids = form.user_ids;
      const res = await axios.post(`${API}/admin/communications/send`, payload);
      setSuccess(res.data.message || 'Message sent successfully!');
      setSendDialog(false);
      setForm({ channel: 'push', recipient_type: 'all', subject: '', message: '', user_ids: [] });
      fetchLogs();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send communication');
    } finally { setSending(false); }
  };

  const applyTemplate = (tmpl) => {
    setForm(f => ({ ...f, subject: tmpl.subject, message: tmpl.message, channel: tmpl.channel }));
    setSendDialog(true);
  };

  // Stats
  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const channelsUsed = [...new Set(logs.map(l => l.channel))].length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>📨 Communications Center</Typography>
          <Typography variant="body2" color="text.secondary">Send SMS, Email & Push notifications to your members</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={fetchLogs} variant="outlined" size="small">Refresh</Button>
          <Button startIcon={<Send />} variant="contained" onClick={() => setSendDialog(true)}>Send Message</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Sent', value: sentCount, color: '#388e3c', icon: <Send /> },
          { label: 'Failed', value: failedCount, color: '#d32f2f', icon: <Warning /> },
          { label: 'Channels', value: channelsUsed, color: '#1976d2', icon: <Campaign /> },
          { label: 'Total Members', value: users.length, color: '#7b1fa2', icon: <People /> },
        ].map((c, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card sx={{ borderLeft: `4px solid ${c.color}` }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: c.color + '20', color: c.color, width: 40, height: 40 }}>{c.icon}</Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Templates */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Quick Templates</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {TEMPLATES.map(t => (
            <Chip
              key={t.key}
              label={t.label}
              onClick={() => applyTemplate(t)}
              sx={{ cursor: 'pointer', bgcolor: channelBg(t.channel), fontWeight: 500, '&:hover': { opacity: 0.8 } }}
            />
          ))}
        </Box>
      </Paper>

      {/* Message History */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={600}>Message History</Typography>
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Date', 'Channel', 'Recipient', 'Subject / Message', 'Status'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                      No messages sent yet. Use templates above or click "Send Message".
                    </TableCell></TableRow>
                  ) : logs.map(log => (
                    <TableRow key={log._id || log.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">{log.sent_at ? new Date(log.sent_at).toLocaleDateString('en-IN') : log.created_at ? new Date(log.created_at).toLocaleDateString('en-IN') : '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{(log.sent_at || log.created_at) ? new Date(log.sent_at || log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip icon={channelIcon(log.channel)} label={log.channel?.toUpperCase()} size="small" color={channelColor(log.channel)} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{log.user_id?.full_name || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{log.user_id?.mobile || ''}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 350 }}>
                        {log.subject && <Typography variant="caption" fontWeight={700} display="block" color="primary">{log.subject}</Typography>}
                        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {log.message}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={log.status} size="small" color={log.status === 'sent' ? 'success' : 'error'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_, v) => setPage(v)} />
          </>
        )}
      </Paper>

      {/* Send Dialog */}
      <Dialog open={sendDialog} onClose={() => setSendDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f5f5f5' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Send Communication</Typography>
            <Typography variant="caption" color="text.secondary">Choose channel, recipients and compose your message</Typography>
          </Box>
          <IconButton onClick={() => setSendDialog(false)} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Grid container spacing={2.5}>
            {/* Channel Selection */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Channel</Typography>
              <ToggleButtonGroup
                value={form.channel}
                exclusive
                onChange={(_, v) => v && setForm(f => ({ ...f, channel: v }))}
                fullWidth
                size="small"
              >
                {CHANNELS.map(ch => (
                  <ToggleButton key={ch.value} value={ch.value} sx={{
                    textTransform: 'none', py: 1.5,
                    '&.Mui-selected': { bgcolor: ch.color + '15', borderColor: ch.color, color: ch.color }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {ch.icon}
                      <Box textAlign="left">
                        <Typography variant="body2" fontWeight={600}>{ch.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{ch.desc}</Typography>
                      </Box>
                    </Box>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Grid>

            {/* Recipients */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Recipients</Typography>
              <ToggleButtonGroup
                value={form.recipient_type}
                exclusive
                onChange={(_, v) => v && setForm(f => ({ ...f, recipient_type: v, user_ids: [] }))}
                fullWidth
                size="small"
              >
                {RECIPIENTS.map(r => (
                  <ToggleButton key={r.value} value={r.value} sx={{ textTransform: 'none', py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {r.icon}
                      <Typography variant="body2" fontWeight={500}>{r.label}</Typography>
                    </Box>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Grid>

            {/* Individual user selector */}
            {form.recipient_type === 'individual' && (
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={u => `${u.full_name} (${u.mobile})`}
                  value={users.filter(u => form.user_ids.includes(u._id))}
                  onChange={(_, selected) => setForm(f => ({ ...f, user_ids: selected.map(u => u._id) }))}
                  renderOption={(props, u) => (
                    <li {...props} key={u._id}>
                      <Avatar sx={{ width: 28, height: 28, mr: 1, fontSize: 12, bgcolor: 'primary.main' }}>{u.full_name?.[0]}</Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{u.full_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{u.mobile}</Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={params => <TextField {...params} label="Search & select members" placeholder="Type name or mobile..." size="small" />}
                />
              </Grid>
            )}

            {/* Subject (for email & push) */}
            {(form.channel === 'email' || form.channel === 'push') && (
              <Grid item xs={12}>
                <TextField label="Subject / Title" fullWidth size="small" value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder={form.channel === 'push' ? 'Notification title' : 'Email subject line'}
                />
              </Grid>
            )}

            {/* Message */}
            <Grid item xs={12}>
              <TextField label="Message" multiline rows={4} fullWidth value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                helperText={`${form.message.length} chars${form.channel === 'sms' ? ` · ${Math.ceil(Math.max(form.message.length, 1) / 160)} SMS` : ''}`}
              />
            </Grid>

            {/* Quick fill chips */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Quick Fill:</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {TEMPLATES.slice(0, 5).map(t => (
                  <Chip key={t.key} label={t.label} size="small" variant="outlined"
                    onClick={() => setForm(f => ({ ...f, subject: t.subject, message: t.message, channel: t.channel }))}
                    sx={{ cursor: 'pointer', fontSize: 11 }}
                  />
                ))}
              </Box>
            </Grid>

            {/* Channel Info */}
            <Grid item xs={12}>
              <Alert severity={form.channel === 'push' ? 'success' : 'info'} sx={{ py: 0.5 }}>
                {form.channel === 'push' && 'Push notifications are sent via FCM to all members with the app installed. Also creates an in-app notification.'}
                {form.channel === 'sms' && 'SMS sent via Fast2SMS DLT route. Messages must comply with DLT template requirements.'}
                {form.channel === 'email' && 'Emails sent via Resend API from noreply@assure.fund with branded HTML template.'}
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#fafafa' }}>
          <Button onClick={() => setSendDialog(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSend} variant="contained" startIcon={<Send />} disabled={sending} size="large">
            {sending ? 'Sending...' : `Send via ${form.channel.toUpperCase()}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
