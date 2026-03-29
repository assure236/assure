import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, CircularProgress, Grid, Card, CardContent, Divider, FormControl,
  InputLabel, Select
} from '@mui/material';
import { Send, Refresh, Sms, Email, Campaign } from '@mui/icons-material';
import axios from 'axios';

const CHANNELS = ['sms', 'email', 'push', 'whatsapp'];
const RECIPIENTS = [
  { value: 'all', label: 'All Active Members' },
  { value: 'overdue', label: 'Overdue Members' },
  { value: 'kyc_pending', label: 'KYC Pending Members' },
];
const TEMPLATES = {
  installment_reminder: 'Dear {name}, your chit fund installment of ₹{amount} is due on {date}. Please pay on time. — Assure ChitFunds',
  auction_notice: 'Dear {name}, the auction for your group {group} is scheduled on {date}. Highest bidder wins! — Assure ChitFunds',
  kyc_pending: 'Dear {name}, your KYC is incomplete. Please upload your documents at {app_link} to continue. — Assure ChitFunds',
  welcome: 'Welcome to Assure ChitFunds, {name}! Your membership is now active. Download our app to track your chit fund. — Assure ChitFunds',
  overdue_warning: 'Dear {name}, your payment of ₹{amount} is overdue by {days} days. Kindly clear your dues to avoid penalty. — Assure ChitFunds',
};

export default function Communications() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendDialog, setSendDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ channel: 'sms', recipient_type: 'all', subject: '', message: '' });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/communications`, { params: { page: page + 1, limit: 20 } });
      setLogs(res.data.data?.logs || []);
      setTotal(res.data.data?.total || 0);
    } catch (e) {
      setError('Failed to load communication logs');
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSend = async () => {
    if (!form.message.trim()) { setError('Message is required'); return; }
    try {
      setSending(true);
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/admin/communications/send`, form);
      setSuccess(res.data.message || 'Message queued successfully');
      setSendDialog(false);
      setForm({ channel: 'sms', recipient_type: 'all', subject: '', message: '' });
      setSelectedTemplate('');
      fetchLogs();
    } catch (e) {
      setError('Failed to send communication');
    } finally { setSending(false); }
  };

  const handleTemplateChange = (tmpl) => {
    setSelectedTemplate(tmpl);
    if (tmpl && TEMPLATES[tmpl]) setForm(f => ({ ...f, message: TEMPLATES[tmpl] }));
  };

  const channelIcon = (ch) => ({ sms: <Sms />, email: <Email />, push: <Campaign />, whatsapp: <Campaign /> }[ch] || <Send />);
  const channelColor = (ch) => ({ sms: 'info', email: 'primary', push: 'secondary', whatsapp: 'success' }[ch] || 'default');

  const totalSent = logs.reduce((s, l) => s + (l.sent_count || 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Communications</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={fetchLogs} variant="outlined">Refresh</Button>
          <Button startIcon={<Send />} variant="contained" onClick={() => setSendDialog(true)}>
            Send Message
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Messages Sent', value: logs.length, color: '#1976d2', icon: <Send /> },
          { label: 'Total Recipients', value: totalSent, color: '#388e3c', icon: <Campaign /> },
          { label: 'Channels Used', value: [...new Set(logs.map(l => l.channel))].length, color: '#f57c00', icon: <Sms /> },
        ].map((c, i) => (
          <Grid item xs={4} key={i}>
            <Card sx={{ borderTop: `4px solid ${c.color}` }}>
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                  </Box>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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
                    {['Date & Time', 'Channel', 'Recipients', 'Message Preview', 'Sent To', 'Status'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                      No messages sent yet. Click "Send Message" to get started.
                    </TableCell></TableRow>
                  ) : logs.map(log => (
                    <TableRow key={log._id || log.id} hover>
                      <TableCell>
                        <Typography variant="body2">{log.sent_at ? new Date(log.sent_at).toLocaleDateString('en-IN') : '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{log.sent_at ? new Date(log.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip icon={channelIcon(log.channel)} label={log.channel?.toUpperCase()} size="small" color={channelColor(log.channel)} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={log.recipient_type?.replace('_', ' ')} size="small" sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        {log.subject && <Typography variant="caption" fontWeight={600} display="block">{log.subject}</Typography>}
                        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {log.message}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{log.sent_count} users</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={log.status} size="small" color={log.status === 'sent' ? 'success' : 'warning'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div" count={total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]}
              onPageChange={(_, v) => setPage(v)}
            />
          </>
        )}
      </Paper>

      {/* Send Dialog */}
      <Dialog open={sendDialog} onClose={() => setSendDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Send Communication</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Channel</InputLabel>
                <Select label="Channel" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  {CHANNELS.map(c => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c.toUpperCase()}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Recipients</InputLabel>
                <Select label="Recipients" value={form.recipient_type} onChange={e => setForm(f => ({ ...f, recipient_type: e.target.value }))}>
                  {RECIPIENTS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Use Template (optional)" fullWidth size="small"
                value={selectedTemplate} onChange={e => handleTemplateChange(e.target.value)}>
                <MenuItem value="">— Select template —</MenuItem>
                {Object.keys(TEMPLATES).map(k => <MenuItem key={k} value={k} sx={{ textTransform: 'capitalize' }}>{k.replace('_', ' ')}</MenuItem>)}
              </TextField>
            </Grid>
            {form.channel === 'email' && (
              <Grid item xs={12}>
                <TextField label="Subject" fullWidth size="small" value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField label="Message" multiline rows={5} fullWidth size="small" value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                helperText={`${form.message.length} characters${form.channel === 'sms' ? ` (${Math.ceil(form.message.length / 160)} SMS)` : ''}`}
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                Note: SMS/WhatsApp/Email integration with providers (MSG91, Twilio, SendGrid) is required for actual delivery. Messages are logged and queued.
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialog(false)}>Cancel</Button>
          <Button onClick={handleSend} variant="contained" startIcon={<Send />} disabled={sending}>
            {sending ? 'Sending...' : 'Send Now'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
