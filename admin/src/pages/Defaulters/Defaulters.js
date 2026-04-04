import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert,
  CircularProgress, Tooltip, IconButton, Grid, Card, CardContent,
  ToggleButtonGroup, ToggleButton, Checkbox, Badge, MenuItem,
  Select, FormControl, InputLabel, FormGroup, FormControlLabel, Switch,
  Stepper, Step, StepLabel, Divider, List, ListItem, ListItemText,
  ListItemIcon, LinearProgress
} from '@mui/material';
import {
  Warning, GppBad, PersonOff, WavingHand, Refresh, Gavel,
  NotificationsActive, Send, FilterList, Search, Campaign,
  History, Sms, PhoneAndroid, CheckCircle, Cancel, Schedule,
  ExpandMore, ExpandLess
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL;
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function Defaulters() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ high: 0, medium: 0, low: 0, total: 0, noReminder: 0, legalSent: 0 });
  const [groups, setGroups] = useState([]);

  // Filters
  const [riskFilter, setRiskFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [reminderFilter, setReminderFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  // Selection & dialogs
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const [reminderDialog, setReminderDialog] = useState({ open: false, row: null });
  const [bulkReminderDialog, setBulkReminderDialog] = useState(false);
  const [bulkReminderNum, setBulkReminderNum] = useState(1);
  const [bulkChannels, setBulkChannels] = useState({ sms: true, push: true });
  const [legalDialog, setLegalDialog] = useState(false);
  const [penalizeDialog, setPenalizeDialog] = useState({ open: false, userId: null, name: '', groupId: null });
  const [penalizeVal, setPenalizeVal] = useState(50);
  const [waiverDialog, setWaiverDialog] = useState({ open: false, paymentId: null, name: '' });
  const [historyDialog, setHistoryDialog] = useState({ open: false, userId: null, groupId: null, name: '' });
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Reminder send state
  const [reminderNum, setReminderNum] = useState(1);
  const [channels, setChannels] = useState({ sms: true, push: true });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/defaulters`, {
        params: {
          page: page + 1, limit: 50, risk: riskFilter,
          group_id: groupFilter, reminders_filter: reminderFilter,
          search: searchText || undefined,
        }
      });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
      if (res.data.stats) setStats(res.data.stats);
      if (res.data.groups) setGroups(res.data.groups);
      setSelected([]);
    } catch (e) {
      setError('Failed to load defaulters');
    } finally { setLoading(false); }
  }, [page, riskFilter, groupFilter, reminderFilter, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Send individual reminder ──
  const handleSendReminder = async () => {
    const row = reminderDialog.row;
    if (!row) return;
    setSending(true);
    try {
      const ch = [];
      if (channels.sms) ch.push('sms');
      if (channels.push) ch.push('push');
      const res = await axios.post(`${API}/admin/defaulters/send-reminder`, {
        user_id: row.user_id?._id, chit_group_id: row.chit_group_id?._id,
        payment_id: row._id || undefined,
        mobile: row.user_id?.mobile, name: row.user_id?.full_name || 'Member',
        days_overdue: row.days_overdue || 0,
        amount: row.total_amount || row.amount,
        group_name: row.chit_group_id?.group_name || 'Chit Group',
        reminder_number: reminderNum, channels: ch,
      });
      toast.success(res.data.message || 'Reminder sent');
      const parts = [];
      if (res.data.sms_sent) parts.push('SMS');
      if (res.data.push_sent) parts.push('Push');
      if (parts.length) toast.info(`Sent via: ${parts.join(', ')}`);
      setReminderDialog({ open: false, row: null });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send reminder');
    } finally { setSending(false); }
  };

  // ── Bulk send reminders ──
  const handleBulkReminder = async () => {
    const targets = selected.map(idx => rows[idx]).filter(Boolean).map(r => ({
      user_id: r.user_id?._id, chit_group_id: r.chit_group_id?._id,
      mobile: r.user_id?.mobile, name: r.user_id?.full_name || 'Member',
      days_overdue: r.days_overdue || 0,
      amount: r.total_amount || r.amount,
      group_name: r.chit_group_id?.group_name || 'Chit Group',
    }));
    if (!targets.length) { toast.warning('No members selected'); return; }
    setSending(true);
    try {
      const ch = [];
      if (bulkChannels.sms) ch.push('sms');
      if (bulkChannels.push) ch.push('push');
      const res = await axios.post(`${API}/admin/defaulters/bulk-remind`, {
        targets, reminder_number: bulkReminderNum, channels: ch,
      });
      toast.success(res.data.message);
      setBulkReminderDialog(false); setSelected([]); fetchData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Bulk reminder failed');
    } finally { setSending(false); }
  };

  // ── Legal notice ──
  const handleSendLegalNotice = async () => {
    const targets = selected.map(idx => rows[idx]).filter(Boolean).map(r => ({
      user_id: r.user_id?._id, chit_group_id: r.chit_group_id?._id,
      mobile: r.user_id?.mobile, name: r.user_id?.full_name || 'Member',
      days_overdue: r.days_overdue || 0,
      amount: r.total_amount || r.amount,
      group_name: r.chit_group_id?.group_name || 'Chit Group',
    }));
    if (!targets.length) { toast.warning('No members selected'); return; }
    setSending(true);
    try {
      const res = await axios.post(`${API}/admin/defaulters/send-legal-notice`, { defaulters: targets });
      toast.success(res.data.message);
      setLegalDialog(false); setSelected([]); fetchData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send legal notices');
    } finally { setSending(false); }
  };

  // ── Penalize ──
  const handlePenalize = async () => {
    try {
      await axios.put(`${API}/admin/defaulters/${penalizeDialog.userId}/penalize`, {
        credit_deduction: penalizeVal, chit_group_id: penalizeDialog.groupId,
      });
      toast.success(`Penalty applied: -${penalizeVal} credit score for ${penalizeDialog.name}`);
      setPenalizeDialog({ open: false, userId: null, name: '', groupId: null });
      fetchData();
    } catch (e) { toast.error('Failed to apply penalty'); }
  };

  // ── Waive fee ──
  const handleWaive = async () => {
    try {
      await axios.put(`${API}/admin/defaulters/${waiverDialog.paymentId}/waive-fee`);
      toast.success(`Late fee waived for ${waiverDialog.name}`);
      setWaiverDialog({ open: false, paymentId: null, name: '' });
      fetchData();
    } catch (e) { toast.error('Failed to waive fee'); }
  };

  // ── Action history ──
  const loadHistory = async (userId, groupId, name) => {
    setHistoryDialog({ open: true, userId, groupId, name });
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API}/admin/defaulters/${userId}/actions`, {
        params: { chit_group_id: groupId }
      });
      setHistoryData(res.data.data || []);
    } catch (e) { toast.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  };

  const toggleSelect = (idx) => setSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  const toggleAll = () => setSelected(prev => prev.length === rows.length ? [] : rows.map((_, i) => i));

  const riskColor = (r) => r === 'high' ? 'error' : r === 'medium' ? 'warning' : 'info';

  // Open reminder dialog with auto-calculated next reminder number
  const openReminderDialog = (row) => {
    const nextNum = Math.min((row.reminders_sent || 0) + 1, 3);
    setReminderNum(nextNum);
    setChannels({ sms: true, push: true });
    setReminderDialog({ open: true, row });
  };

  // Reminder progress helper
  const ReminderProgress = ({ sent, legalSent }) => {
    const steps = ['1st', '2nd', '3rd (Final)'];
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {steps.map((label, i) => (
          <Tooltip key={i} title={`${label} Reminder${i < sent ? ' — Sent' : ''}`}>
            <Box sx={{
              width: 10, height: 10, borderRadius: '50%',
              bgcolor: i < sent ? (i === 2 ? 'error.main' : 'warning.main') : 'grey.300',
              border: '1px solid',
              borderColor: i < sent ? (i === 2 ? 'error.dark' : 'warning.dark') : 'grey.400',
            }} />
          </Tooltip>
        ))}
        {legalSent && (
          <Tooltip title="Legal Notice Sent">
            <Gavel sx={{ fontSize: 14, color: 'error.main', ml: 0.5 }} />
          </Tooltip>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{sent}/3</Typography>
      </Box>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Defaulter Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selected.length > 0 && (
            <>
              <Button startIcon={<Campaign />} color="warning" variant="contained" size="small"
                onClick={() => { setBulkReminderNum(1); setBulkChannels({ sms: true, push: true }); setBulkReminderDialog(true); }}>
                Send Reminder ({selected.length})
              </Button>
              <Button startIcon={<Gavel />} color="error" variant="contained" size="small"
                onClick={() => setLegalDialog(true)}>
                Legal Action ({selected.length})
              </Button>
            </>
          )}
          <Button startIcon={<Refresh />} onClick={fetchData} variant="outlined" size="small">Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Defaulters', value: stats.total, color: '#0B1F3B', icon: <Warning />, filter: 'all' },
          { label: 'High Risk (>21d)', value: stats.high, color: '#d32f2f', icon: <GppBad />, filter: 'high' },
          { label: 'Medium Risk (14-21d)', value: stats.medium, color: '#B8960F', icon: <PersonOff />, filter: 'medium' },
          { label: 'Low Risk (<14d)', value: stats.low, color: '#388e3c', icon: <WavingHand />, filter: 'low' },
          { label: 'No Reminders Sent', value: stats.noReminder, color: '#9c27b0', icon: <NotificationsActive /> },
          { label: 'Legal Notices Sent', value: stats.legalSent, color: '#b71c1c', icon: <Gavel /> },
        ].map((c, i) => (
          <Grid item xs={6} md={2} key={i}>
            <Card sx={{ borderLeft: `4px solid ${c.color}`, cursor: c.filter ? 'pointer' : 'default', '&:hover': { boxShadow: 3 } }}
              onClick={() => { if (c.filter) { setRiskFilter(c.filter); setPage(0); } }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" noWrap>{c.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                  </Box>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <ToggleButtonGroup value={riskFilter} exclusive size="small" fullWidth
              onChange={(_, v) => { if (v) { setRiskFilter(v); setPage(0); } }}>
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="high" sx={{ color: 'error.main' }}>High</ToggleButton>
              <ToggleButton value="medium" sx={{ color: 'warning.main' }}>Med</ToggleButton>
              <ToggleButton value="low" sx={{ color: 'info.main' }}>Low</ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          <Grid item xs={6} md={2.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>Group</InputLabel>
              <Select value={groupFilter} label="Group" onChange={e => { setGroupFilter(e.target.value); setPage(0); }}>
                <MenuItem value="all">All Groups</MenuItem>
                {groups.map(g => <MenuItem key={g._id} value={g._id}>{g.group_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Reminders</InputLabel>
              <Select value={reminderFilter} label="Reminders" onChange={e => { setReminderFilter(e.target.value); setPage(0); }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="0">No Reminders (0)</MenuItem>
                <MenuItem value="1">1 Reminder</MenuItem>
                <MenuItem value="2">2 Reminders</MenuItem>
                <MenuItem value="3">3 Reminders (Final)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4.5}>
            <TextField size="small" fullWidth placeholder="Search by name, mobile, member ID..."
              value={searchText} onChange={e => setSearchText(e.target.value)}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
              onKeyDown={e => { if (e.key === 'Enter') fetchData(); }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.length === rows.length && rows.length > 0}
                        indeterminate={selected.length > 0 && selected.length < rows.length}
                        onChange={toggleAll} />
                    </TableCell>
                    {['Member', 'Mobile', 'Group', 'Due Date', 'Days Overdue', 'Amount', 'Late Fee', 'Credit', 'Reminders', 'Risk', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50', whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={12} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      No overdue payments found
                    </TableCell></TableRow>
                  ) : rows.map((row, idx) => {
                    const days = row.days_overdue || 0;
                    const rs = row.reminders_sent || 0;
                    return (
                      <TableRow key={row._id || idx} hover sx={{
                        bgcolor: row.legal_notice_sent ? '#fce4ec' : rs >= 3 ? '#FDF8E8' : 'inherit',
                      }}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.includes(idx)} onChange={() => toggleSelect(idx)} />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={500} variant="body2">{row.user_id?.full_name || '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.user_id?.member_id || ''}</Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2">{row.user_id?.mobile || '-'}</Typography></TableCell>
                        <TableCell><Typography variant="caption">{row.chit_group_id?.group_name || '-'}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{row.due_date ? new Date(row.due_date).toLocaleDateString('en-IN') : '-'}</Typography></TableCell>
                        <TableCell>
                          <Typography fontWeight={600} color={days > 21 ? 'error.main' : days >= 14 ? 'warning.main' : 'text.primary'}>
                            {days}d
                          </Typography>
                        </TableCell>
                        <TableCell><Typography fontWeight={600} variant="body2">{fmt(row.total_amount || row.amount)}</Typography></TableCell>
                        <TableCell>
                          {row.late_fee > 0
                            ? <Typography variant="body2" color="error.main">{fmt(row.late_fee)}</Typography>
                            : <Typography variant="body2" color="text.disabled">-</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip label={row.user_id?.credit_score ?? 500} size="small" variant="outlined"
                            color={(row.user_id?.credit_score ?? 500) >= 700 ? 'success' : (row.user_id?.credit_score ?? 500) >= 400 ? 'warning' : 'error'} />
                        </TableCell>
                        <TableCell>
                          <ReminderProgress sent={rs} legalSent={row.legal_notice_sent} />
                          {row.last_reminder_at && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Last: {new Date(row.last_reminder_at).toLocaleDateString('en-IN')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={row.risk === 'high' ? 'HIGH' : row.risk === 'medium' ? 'MED' : 'LOW'} size="small"
                            color={riskColor(row.risk)} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.3 }}>
                            {/* Send Reminder */}
                            <Tooltip title={rs >= 3 ? 'All 3 reminders sent' : `Send Reminder ${rs + 1}`}>
                              <span>
                                <IconButton size="small" color={rs >= 3 ? 'default' : 'warning'}
                                  disabled={rs >= 3}
                                  onClick={() => openReminderDialog(row)}>
                                  <Badge badgeContent={rs} color={rs >= 3 ? 'error' : rs > 0 ? 'warning' : 'default'} max={3}>
                                    <Campaign fontSize="small" />
                                  </Badge>
                                </IconButton>
                              </span>
                            </Tooltip>

                            {/* Legal Action */}
                            <Tooltip title={row.legal_notice_sent ? `Legal notice sent on ${new Date(row.legal_notice_at).toLocaleDateString('en-IN')}` : rs >= 3 ? 'Issue Legal Notice' : 'Send all 3 reminders first'}>
                              <span>
                                <IconButton size="small" color={row.legal_notice_sent ? 'default' : 'error'}
                                  disabled={rs < 3 || row.legal_notice_sent}
                                  onClick={() => { setSelected([idx]); setLegalDialog(true); }}>
                                  <Gavel fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>

                            {/* Waive Fee */}
                            <Tooltip title="Waive Late Fee">
                              <span>
                                <IconButton size="small" color="success" disabled={!row.late_fee || row.late_fee <= 0 || row.virtual}
                                  onClick={() => setWaiverDialog({ open: true, paymentId: row._id, name: row.user_id?.full_name || '' })}>
                                  <WavingHand fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>

                            {/* Penalize */}
                            <Tooltip title="Apply Credit Penalty">
                              <IconButton size="small" color="error"
                                onClick={() => setPenalizeDialog({
                                  open: true, userId: row.user_id?._id,
                                  name: row.user_id?.full_name || '', groupId: row.chit_group_id?._id
                                })}>
                                <GppBad fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* History */}
                            <Tooltip title="View Action History">
                              <IconButton size="small" color="info"
                                onClick={() => loadHistory(row.user_id?._id, row.chit_group_id?._id, row.user_id?.full_name)}>
                                <History fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div" count={total} page={page} rowsPerPage={50} rowsPerPageOptions={[50]}
              onPageChange={(_, v) => setPage(v)}
            />
          </>
        )}
      </Paper>

      {/* ── Send Reminder Dialog ── */}
      <Dialog open={reminderDialog.open} onClose={() => setReminderDialog({ open: false, row: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Campaign color="warning" /> Send Reminder
        </DialogTitle>
        <DialogContent>
          {reminderDialog.row && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Sending to <strong>{reminderDialog.row.user_id?.full_name}</strong> for <strong>{reminderDialog.row.chit_group_id?.group_name}</strong>
                <br />Overdue: {reminderDialog.row.days_overdue} days | Amount: {fmt(reminderDialog.row.total_amount || reminderDialog.row.amount)}
              </Alert>

              {/* Reminder Progress */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Reminder Progress</Typography>
                <Stepper activeStep={reminderDialog.row.reminders_sent || 0} alternativeLabel>
                  {['1st Reminder', '2nd Reminder (Urgent)', '3rd Final Notice'].map((label, i) => (
                    <Step key={i} completed={i < (reminderDialog.row.reminders_sent || 0)}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>

              {/* Reminder number selection */}
              <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                <InputLabel>Reminder Number</InputLabel>
                <Select value={reminderNum} label="Reminder Number" onChange={e => setReminderNum(e.target.value)}>
                  <MenuItem value={1} disabled={(reminderDialog.row.reminders_sent || 0) >= 1}>1st Reminder — Friendly</MenuItem>
                  <MenuItem value={2} disabled={(reminderDialog.row.reminders_sent || 0) >= 2 || (reminderDialog.row.reminders_sent || 0) < 1}>2nd Reminder — Urgent</MenuItem>
                  <MenuItem value={3} disabled={(reminderDialog.row.reminders_sent || 0) >= 3 || (reminderDialog.row.reminders_sent || 0) < 2}>3rd Reminder — Final Notice</MenuItem>
                </Select>
              </FormControl>

              {/* Channel selection */}
              <Typography variant="subtitle2" gutterBottom>Send Via</Typography>
              <FormGroup row>
                <FormControlLabel control={<Switch checked={channels.sms} onChange={e => setChannels(p => ({ ...p, sms: e.target.checked }))} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Sms fontSize="small" /> SMS</Box>} />
                <FormControlLabel control={<Switch checked={channels.push} onChange={e => setChannels(p => ({ ...p, push: e.target.checked }))} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PhoneAndroid fontSize="small" /> Push Notification</Box>} />
              </FormGroup>

              {reminderNum === 3 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This is the <strong>Final Notice</strong>. Sending this will deduct 25 credit score points and warn about legal action.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReminderDialog({ open: false, row: null })}>Cancel</Button>
          <Button onClick={handleSendReminder} variant="contained" color="warning" disabled={sending || (!channels.sms && !channels.push)}
            startIcon={sending ? <CircularProgress size={16} /> : <Send />}>
            {sending ? 'Sending...' : `Send Reminder ${reminderNum}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk Reminder Dialog ── */}
      <Dialog open={bulkReminderDialog} onClose={() => setBulkReminderDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Campaign color="warning" /> Bulk Send Reminders
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>{selected.length}</strong> member(s) selected. Members who already received this reminder will be skipped.
          </Alert>

          <FormControl size="small" fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Reminder Number</InputLabel>
            <Select value={bulkReminderNum} label="Reminder Number" onChange={e => setBulkReminderNum(e.target.value)}>
              <MenuItem value={1}>1st Reminder — Friendly</MenuItem>
              <MenuItem value={2}>2nd Reminder — Urgent</MenuItem>
              <MenuItem value={3}>3rd Reminder — Final Notice</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" gutterBottom>Send Via</Typography>
          <FormGroup row>
            <FormControlLabel control={<Switch checked={bulkChannels.sms} onChange={e => setBulkChannels(p => ({ ...p, sms: e.target.checked }))} />}
              label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Sms fontSize="small" /> SMS</Box>} />
            <FormControlLabel control={<Switch checked={bulkChannels.push} onChange={e => setBulkChannels(p => ({ ...p, push: e.target.checked }))} />}
              label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PhoneAndroid fontSize="small" /> Push</Box>} />
          </FormGroup>

          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Selected members:
          </Typography>
          {selected.slice(0, 8).map(idx => {
            const r = rows[idx];
            return r && (
              <Typography key={idx} variant="body2" sx={{ ml: 2 }}>
                • {r.user_id?.full_name} — {r.chit_group_id?.group_name} ({r.reminders_sent || 0}/3 sent)
              </Typography>
            );
          })}
          {selected.length > 8 && <Typography variant="body2" sx={{ ml: 2 }}>...and {selected.length - 8} more</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkReminderDialog(false)}>Cancel</Button>
          <Button onClick={handleBulkReminder} variant="contained" color="warning" disabled={sending || (!bulkChannels.sms && !bulkChannels.push)}
            startIcon={sending ? <CircularProgress size={16} /> : <Send />}>
            {sending ? 'Sending...' : `Send Reminder ${bulkReminderNum} to ${selected.length}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Legal Notice Dialog ── */}
      <Dialog open={legalDialog} onClose={() => setLegalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Gavel /> Issue Legal Notice
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This will send a <strong>formal legal notice</strong> via SMS & Push, and <strong>deduct 100 credit score points</strong> from each selected defaulter.
            This action is tracked and cannot be undone.
          </Alert>
          <Typography variant="body2" gutterBottom>
            <strong>{selected.length}</strong> member(s) selected:
          </Typography>
          {selected.slice(0, 10).map(idx => {
            const r = rows[idx];
            return r && (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, mb: 0.5 }}>
                {r.legal_notice_sent
                  ? <Chip label="Already Sent" size="small" color="default" />
                  : <Chip label={`${r.reminders_sent || 0}/3 reminders`} size="small" color={r.reminders_sent >= 3 ? 'error' : 'warning'} />}
                <Typography variant="body2">
                  {r.user_id?.full_name} — {r.chit_group_id?.group_name} ({r.days_overdue}d, {fmt(r.total_amount || r.amount)})
                </Typography>
              </Box>
            );
          })}
          {selected.length > 10 && <Typography variant="body2" sx={{ ml: 2 }}>...and {selected.length - 10} more</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLegalDialog(false)}>Cancel</Button>
          <Button onClick={handleSendLegalNotice} variant="contained" color="error" disabled={sending}
            startIcon={sending ? <CircularProgress size={16} /> : <Gavel />}>
            {sending ? 'Sending...' : 'Confirm Legal Action'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Penalize Dialog ── */}
      <Dialog open={penalizeDialog.open} onClose={() => setPenalizeDialog({ open: false, userId: null, name: '', groupId: null })}>
        <DialogTitle>Apply Credit Score Penalty</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography gutterBottom>Member: <strong>{penalizeDialog.name}</strong></Typography>
          <TextField
            label="Credit Deduction Points" type="number" fullWidth size="small"
            value={penalizeVal} onChange={e => setPenalizeVal(Number(e.target.value))}
            inputProps={{ min: 10, max: 200 }} sx={{ mt: 2 }}
            helperText="Recommended: 50 points per overdue installment" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPenalizeDialog({ open: false, userId: null, name: '', groupId: null })}>Cancel</Button>
          <Button onClick={handlePenalize} variant="contained" color="error">Apply Penalty</Button>
        </DialogActions>
      </Dialog>

      {/* ── Waive Dialog ── */}
      <Dialog open={waiverDialog.open} onClose={() => setWaiverDialog({ open: false, paymentId: null, name: '' })}>
        <DialogTitle>Waive Late Fee</DialogTitle>
        <DialogContent>
          <Typography>Waive the late fee for <strong>{waiverDialog.name}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWaiverDialog({ open: false, paymentId: null, name: '' })}>Cancel</Button>
          <Button onClick={handleWaive} variant="contained" color="success">Confirm Waive</Button>
        </DialogActions>
      </Dialog>

      {/* ── Action History Dialog ── */}
      <Dialog open={historyDialog.open} onClose={() => setHistoryDialog({ open: false, userId: null, groupId: null, name: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History color="info" /> Action History — {historyDialog.name}
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : historyData.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No actions recorded yet</Typography>
          ) : (
            <List dense>
              {historyData.map((a, i) => {
                const icon = a.action_type === 'legal_notice' ? <Gavel color="error" /> :
                  a.action_type === 'penalty' ? <GppBad color="error" /> :
                  a.action_type === 'waiver' ? <WavingHand color="success" /> :
                  <NotificationsActive color={a.action_type === 'reminder_3' ? 'error' : a.action_type === 'reminder_2' ? 'warning' : 'primary'} />;
                const label = a.action_type === 'legal_notice' ? 'Legal Notice' :
                  a.action_type === 'penalty' ? `Penalty (-${a.details?.credit_deduction} credit)` :
                  a.action_type === 'waiver' ? 'Late Fee Waived' :
                  `Reminder ${a.action_type.split('_')[1]}`;
                return (
                  <React.Fragment key={a._id || i}>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={600}>{label}</Typography>
                            {a.channels?.map(ch => (
                              <Chip key={ch} label={ch.toUpperCase()} size="small" variant="outlined"
                                icon={ch === 'sms' ? <Sms sx={{ fontSize: 14 }} /> : <PhoneAndroid sx={{ fontSize: 14 }} />}
                                sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: 10 } }} />
                            ))}
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {new Date(a.created_at).toLocaleString('en-IN')}
                            {a.performed_by?.full_name ? ` by ${a.performed_by.full_name}` : ''}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {i < historyData.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog({ open: false, userId: null, groupId: null, name: '' })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
