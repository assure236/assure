import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Alert, CircularProgress, Grid, Card,
  CardContent, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, FormControl, InputLabel, Select,
  Autocomplete
} from '@mui/material';
import {
  Send, Refresh, NotificationsActive, Campaign, People, Person
} from '@mui/icons-material';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

const NOTIFICATION_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'auction_alert', label: 'Auction Alert' },
  { value: 'auction_result', label: 'Auction Result' },
  { value: 'dividend_credit', label: 'Dividend Credit' },
  { value: 'kyc_update', label: 'KYC Update' },
  { value: 'promotional', label: 'Promotional' },
];

const QUICK_TEMPLATES = [
  { label: 'Payment Reminder', title: 'Payment Due', message: 'Your chit fund installment is due. Please make your payment on time to avoid penalties.', type: 'payment_reminder' },
  { label: 'Auction Alert', title: 'Upcoming Auction', message: 'An auction for your chit group is starting soon. Place your bid to win the prize amount!', type: 'auction_alert' },
  { label: 'KYC Reminder', title: 'Complete Your KYC', message: 'Your KYC verification is pending. Please upload your documents to continue using all features.', type: 'kyc_update' },
  { label: 'Welcome', title: 'Welcome to Assure ChitFunds!', message: 'Thank you for joining Assure ChitFunds. Explore your dashboard to track your chit groups and payments.', type: 'general' },
  { label: 'Dividend Credit', title: 'Dividend Credited', message: 'Your dividend has been credited to your account. Check your payment history for details.', type: 'dividend_credit' },
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
    mode: 'broadcast', // 'broadcast' or 'individual'
    title: '',
    message: '',
    type: 'general',
    user_id: null,
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      // Get recent broadcast notifications from admin communications endpoint
      const res = await axios.get(`${API}/admin/communications`, {
        params: { page: page + 1, limit: 20, channel: 'push' }
      });
      setNotifications(res.data.data?.logs || []);
      setTotal(res.data.data?.total || 0);
    } catch (e) {
      // Fallback: just show empty list
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
          `Broadcast sent to ${res.data.message}. Push: ${pushInfo?.sent || 0} delivered, ${pushInfo?.failed || 0} failed.`
        );
      } else {
        await axios.post(`${API}/notifications/send`, {
          user_id: form.user_id,
          title: form.title,
          message: form.message,
          type: form.type,
        });
        setSuccess('Notification sent successfully');
      }

      setSendDialog(false);
      setForm({ mode: 'broadcast', title: '', message: '', type: 'general', user_id: null });
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
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Push Notifications</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={() => { fetchNotifications(); fetchUsers(); }} variant="outlined">
            Refresh
          </Button>
          <Button startIcon={<Send />} variant="contained" onClick={() => setSendDialog(true)}>
            Send Notification
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderTop: '4px solid #1976d2' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Members</Typography>
                  <Typography variant="h5" fontWeight={700}>{stats.total}</Typography>
                </Box>
                <People sx={{ fontSize: 40, color: '#1976d2', opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderTop: '4px solid #388e3c' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Push Enabled</Typography>
                  <Typography variant="h5" fontWeight={700}>{stats.withTokens}</Typography>
                </Box>
                <NotificationsActive sx={{ fontSize: 40, color: '#388e3c', opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderTop: '4px solid #f57c00' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Pending Setup</Typography>
                  <Typography variant="h5" fontWeight={700}>{stats.total - stats.withTokens}</Typography>
                </Box>
                <Campaign sx={{ fontSize: 40, color: '#f57c00', opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent notifications */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Recent Notifications</Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            No push notifications sent yet. Click "Send Notification" to get started.
          </Typography>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Channel</TableCell>
                    <TableCell>Subject / Message</TableCell>
                    <TableCell>Recipients</TableCell>
                    <TableCell>Sent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notifications.map((n, i) => (
                    <TableRow key={n._id || i}>
                      <TableCell>
                        <Chip label={n.channel || 'push'} size="small" color="secondary" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{n.subject || n.message?.substring(0, 50)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {n.message?.substring(0, 100)}
                        </Typography>
                      </TableCell>
                      <TableCell>{n.sent_count || n.recipient_type || '-'}</TableCell>
                      <TableCell>
                        {n.created_at ? new Date(n.created_at).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={20}
              rowsPerPageOptions={[20]}
            />
          </>
        )}
      </Paper>

      {/* Send Notification Dialog */}
      <Dialog open={sendDialog} onClose={() => setSendDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Push Notification</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Mode Toggle */}
            <FormControl fullWidth size="small">
              <InputLabel>Send To</InputLabel>
              <Select
                value={form.mode}
                label="Send To"
                onChange={e => setForm(f => ({ ...f, mode: e.target.value, user_id: null }))}
              >
                <MenuItem value="broadcast">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Campaign fontSize="small" /> All Members ({stats.withTokens} with push)
                  </Box>
                </MenuItem>
                <MenuItem value="individual">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person fontSize="small" /> Specific Member
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {/* User selector for individual mode */}
            {form.mode === 'individual' && (
              <Autocomplete
                options={users}
                getOptionLabel={(u) => `${u.full_name || u.mobile} (${u.mobile})${u.fcm_token ? ' ✓' : ' — no push'}`}
                onChange={(_, value) => setForm(f => ({ ...f, user_id: value?._id || value?.id || null }))}
                renderInput={(params) => <TextField {...params} label="Select Member" size="small" />}
                size="small"
              />
            )}

            {/* Quick Templates */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>Quick Templates:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {QUICK_TEMPLATES.map((t) => (
                  <Chip
                    key={t.label}
                    label={t.label}
                    size="small"
                    variant="outlined"
                    onClick={() => applyTemplate(t)}
                    clickable
                  />
                ))}
              </Box>
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={form.type}
                label="Type"
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {NOTIFICATION_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Title"
              size="small"
              fullWidth
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              inputProps={{ maxLength: 100 }}
            />

            <TextField
              label="Message"
              size="small"
              fullWidth
              multiline
              rows={4}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              inputProps={{ maxLength: 500 }}
              helperText={`${form.message.length}/500`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={sending ? <CircularProgress size={18} /> : <Send />}
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? 'Sending...' : form.mode === 'broadcast' ? 'Send to All' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
