import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert,
  CircularProgress, Tooltip, IconButton, Grid, Card, CardContent,
  ToggleButtonGroup, ToggleButton, Checkbox, Badge
} from '@mui/material';
import {
  Warning, GppBad, PersonOff, WavingHand, Refresh, Gavel,
  NotificationsActive, Send, FilterList
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function Defaulters() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [penalizeDialog, setPenalizeDialog] = useState({ open: false, userId: null, name: '' });
  const [penalizeVal, setPenalizeVal] = useState(50);
  const [waiverDialog, setWaiverDialog] = useState({ open: false, paymentId: null, name: '' });
  const [stats, setStats] = useState({ high: 0, medium: 0, low: 0, total: 0 });
  const [riskFilter, setRiskFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [legalDialog, setLegalDialog] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/defaulters`, { params: { page: page + 1, limit: 50, risk: riskFilter } });
      const data = res.data.data || [];
      setRows(data);
      setTotal(res.data.total || 0);
      if (res.data.stats) setStats(res.data.stats);
      setSelected([]);
    } catch (e) {
      setError('Failed to load defaulters');
    } finally { setLoading(false); }
  }, [page, riskFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePenalize = async () => {
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/defaulters/${penalizeDialog.userId}/penalize`, { credit_deduction: penalizeVal });
      toast.success(`Penalty applied: -${penalizeVal} credit score for ${penalizeDialog.name}`);
      setPenalizeDialog({ open: false, userId: null, name: '' });
      fetchData();
    } catch (e) { toast.error('Failed to apply penalty'); }
  };

  const handleWaive = async () => {
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/defaulters/${waiverDialog.paymentId}/waive-fee`);
      toast.success(`Late fee waived for ${waiverDialog.name}`);
      setWaiverDialog({ open: false, paymentId: null, name: '' });
      fetchData();
    } catch (e) { toast.error('Failed to waive fee'); }
  };

  const handleSendAlert = async (row) => {
    const days = row.days_overdue || 0;
    const alertNum = days >= 21 ? 3 : days >= 14 ? 2 : 1;
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/admin/defaulters/send-alert`, {
        user_id: row.user_id?._id, mobile: row.user_id?.mobile,
        name: row.user_id?.full_name || 'Member', days_overdue: days,
        amount: row.total_amount || row.amount, group_name: row.chit_group_id?.group_name || 'Chit Group',
        alert_number: alertNum,
      });
      toast.success(`Alert ${alertNum} sent to ${row.user_id?.full_name}`);
    } catch (e) { toast.error('Failed to send alert'); }
  };

  const handleSendLegalNotice = async () => {
    const targets = selected.map(idx => rows[idx]).filter(Boolean).map(r => ({
      user_id: r.user_id?._id, mobile: r.user_id?.mobile,
      name: r.user_id?.full_name || 'Member', days_overdue: r.days_overdue || 0,
      amount: r.total_amount || r.amount, group_name: r.chit_group_id?.group_name || 'Chit Group',
    }));
    if (!targets.length) { toast.warning('No members selected'); return; }
    setSending(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/admin/defaulters/send-legal-notice`, { defaulters: targets });
      toast.success(res.data.message || 'Legal notices sent');
      setLegalDialog(false);
      setSelected([]);
      fetchData();
    } catch (e) { toast.error('Failed to send legal notices'); }
    finally { setSending(false); }
  };

  const toggleSelect = (idx) => setSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  const toggleAll = () => setSelected(prev => prev.length === rows.length ? [] : rows.map((_, i) => i));

  const riskColor = (r) => r === 'high' ? 'error' : r === 'medium' ? 'warning' : 'info';
  const riskLabel = (r) => r === 'high' ? 'High Risk' : r === 'medium' ? 'Medium Risk' : 'Low Risk';
  const alertCount = (days) => days >= 21 ? 3 : days >= 14 ? 2 : days >= 7 ? 1 : 0;
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Defaulter Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selected.length > 0 && (
            <Button startIcon={<Gavel />} color="error" variant="contained" size="small"
              onClick={() => setLegalDialog(true)}>
              Send Legal Notice ({selected.length})
            </Button>
          )}
          <Button startIcon={<Refresh />} onClick={fetchData} variant="outlined" size="small">Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Defaulters', value: stats.total, color: '#1976d2', icon: <Warning /> },
          { label: 'High Risk (>21 days)', value: stats.high, color: '#d32f2f', icon: <GppBad /> },
          { label: 'Medium Risk (14-21d)', value: stats.medium, color: '#f57c00', icon: <PersonOff /> },
          { label: 'Low Risk (<14 days)', value: stats.low, color: '#388e3c', icon: <WavingHand /> },
        ].map((c, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card sx={{ borderLeft: `4px solid ${c.color}`, cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
              onClick={() => { setRiskFilter(i === 0 ? 'all' : i === 1 ? 'high' : i === 2 ? 'medium' : 'low'); setPage(0); }}>
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

      {/* Risk Filter */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup value={riskFilter} exclusive onChange={(_, v) => { if (v) { setRiskFilter(v); setPage(0); } }} size="small">
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="high" sx={{ color: 'error.main' }}>High Risk</ToggleButton>
          <ToggleButton value="medium" sx={{ color: 'warning.main' }}>Medium Risk</ToggleButton>
          <ToggleButton value="low" sx={{ color: 'info.main' }}>Low Risk</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          <FilterList fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
          Alerts: 7d = 1st, 14d = 2nd, 21d = 3rd (Legal Action)
        </Typography>
      </Box>

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
                    {['Member', 'Mobile', 'Group', 'Due Date', 'Days Overdue', 'Amount Due', 'Late Fee', 'Credit Score', 'Alerts', 'Risk', 'Legal Action'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
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
                    const alerts = alertCount(days);
                    return (
                      <TableRow key={row._id || idx} hover sx={{
                        bgcolor: alerts >= 3 ? 'error.50' : 'inherit',
                        '&:hover': { bgcolor: alerts >= 3 ? '#ffebee' : 'action.hover' }
                      }}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.includes(idx)} onChange={() => toggleSelect(idx)} />
                        </TableCell>
                        <TableCell><Typography fontWeight={500}>{row.user_id?.full_name || '-'}</Typography></TableCell>
                        <TableCell>{row.user_id?.mobile || '-'}</TableCell>
                        <TableCell><Typography variant="caption">{row.chit_group_id?.group_name || '-'}</Typography></TableCell>
                        <TableCell>{row.due_date ? new Date(row.due_date).toLocaleDateString('en-IN') : '-'}</TableCell>
                        <TableCell>
                          <Typography fontWeight={600} color={days > 21 ? 'error.main' : days >= 14 ? 'warning.main' : 'text.primary'}>
                            {days} days
                          </Typography>
                        </TableCell>
                        <TableCell><Typography fontWeight={600}>{fmt(row.total_amount)}</Typography></TableCell>
                        <TableCell>
                          {row.late_fee > 0
                            ? <Typography color="error.main">{fmt(row.late_fee)}</Typography>
                            : <Typography color="text.disabled">₹0</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip label={row.user_id?.credit_score || 650} size="small"
                            color={row.user_id?.credit_score >= 700 ? 'success' : row.user_id?.credit_score >= 500 ? 'warning' : 'error'} />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={`${alerts} alert(s) — Click to send alert SMS`}>
                            <IconButton size="small" color={alerts >= 3 ? 'error' : alerts >= 2 ? 'warning' : 'primary'}
                              onClick={() => handleSendAlert(row)} disabled={days < 7}>
                              <Badge badgeContent={alerts} color={alerts >= 3 ? 'error' : 'warning'}>
                                <NotificationsActive fontSize="small" />
                              </Badge>
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell><Chip label={riskLabel(row.risk)} size="small" color={riskColor(row.risk)} /></TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {alerts >= 3 && (
                              <Tooltip title="Issue Legal Notice">
                                <IconButton size="small" color="error"
                                  onClick={() => { setSelected([idx]); setLegalDialog(true); }}>
                                  <Gavel fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Waive Late Fee">
                              <span>
                                <IconButton size="small" color="success" disabled={!row.late_fee || row.late_fee <= 0 || row.virtual}
                                  onClick={() => setWaiverDialog({ open: true, paymentId: row._id || row.id, name: row.user_id?.full_name || '' })}>
                                  <WavingHand fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Apply Penalty">
                              <IconButton size="small" color="error"
                                onClick={() => setPenalizeDialog({ open: true, userId: row.user_id?._id, name: row.user_id?.full_name || '' })}>
                                <GppBad fontSize="small" />
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

      {/* Penalize Dialog */}
      <Dialog open={penalizeDialog.open} onClose={() => setPenalizeDialog({ open: false, userId: null, name: '' })}>
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
          <Button onClick={() => setPenalizeDialog({ open: false, userId: null, name: '' })}>Cancel</Button>
          <Button onClick={handlePenalize} variant="contained" color="error">Apply Penalty</Button>
        </DialogActions>
      </Dialog>

      {/* Waive Dialog */}
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

      {/* Legal Notice Dialog */}
      <Dialog open={legalDialog} onClose={() => setLegalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Gavel /> Send Legal Notice
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This will send a formal legal notice via SMS and deduct 100 credit score points from each selected defaulter.
          </Alert>
          <Typography variant="body2" gutterBottom>
            <strong>{selected.length}</strong> member(s) selected:
          </Typography>
          {selected.slice(0, 10).map(idx => {
            const r = rows[idx];
            return r && (
              <Typography key={idx} variant="body2" sx={{ ml: 2 }}>
                • {r.user_id?.full_name} — {r.chit_group_id?.group_name} ({r.days_overdue}d overdue, {fmt(r.total_amount)})
              </Typography>
            );
          })}
          {selected.length > 10 && <Typography variant="body2" sx={{ ml: 2 }}>...and {selected.length - 10} more</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLegalDialog(false)}>Cancel</Button>
          <Button onClick={handleSendLegalNotice} variant="contained" color="error" disabled={sending}
            startIcon={sending ? <CircularProgress size={16} /> : <Send />}>
            {sending ? 'Sending...' : 'Confirm & Send Legal Notice'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
