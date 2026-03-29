import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Chip, Button,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, MenuItem, Tabs, Tab, Tooltip
} from '@mui/material';
import {
  Add as AddIcon, CheckCircle as ApproveIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const statusColors = { paid: 'success', success: 'success', pending: 'warning', overdue: 'error', failed: 'error', refunded: 'info' };
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const Payments = () => {
  const [tab, setTab] = useState(0);
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [recordDialog, setRecordDialog] = useState(false);
  const [form, setForm] = useState({ user_id: '', chit_group_id: '', month_number: '', amount: '', payment_method: 'cash', notes: '' });
  const [recording, setRecording] = useState(false);
  const [chitGroups, setChitGroups] = useState([]);
  const [stats, setStats] = useState({ total_collections: 0, total_paid: 0, total_pending: 0, total_overdue: 0 });

  const statusFilter = ['all', 'success', 'pending', 'overdue'][tab];

  useEffect(() => { fetchPayments(); }, [page, rowsPerPage, tab]);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page + 1, limit: rowsPerPage });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/payments?${params}`);
      if (res.data.success) {
        const data = res.data.data?.payments || [];
        setPayments(data);
        setTotal(res.data.data?.total || 0);
        // Compute quick stats from full list (fetch all stats when on first tab)
        if (tab === 0) {
          setStats({
            total_collections: data.filter(p => p.payment_status === 'success').reduce((s, p) => s + Number(p.total_amount || 0), 0),
            total_paid: data.filter(p => p.payment_status === 'success').length,
            total_pending: data.filter(p => p.payment_status === 'pending').length,
            total_overdue: data.filter(p => p.payment_status === 'overdue').length,
          });
        }
      }
    } catch (err) { setError('Could not load payments.'); }
    finally { setLoading(false); }
  };

  const openRecordDialog = async () => {
    setForm({ user_id: '', chit_group_id: '', month_number: '', amount: '', payment_method: 'cash', notes: '' });
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/chit-groups?limit=100`);
      if (res.data.success) setChitGroups(res.data.data?.chit_groups || []);
    } catch {}
    setRecordDialog(true);
  };

  const handleRecordPayment = async () => {
    if (!form.user_id || !form.chit_group_id || !form.month_number || !form.amount) {
      toast.error('All required fields must be filled'); return;
    }
    setRecording(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/admin/payments/record`, {
        user_id: form.user_id,
        chit_group_id: form.chit_group_id,
        month_number: parseInt(form.month_number),
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        notes: form.notes,
      });
      if (res.data.success) {
        toast.success('Payment recorded successfully!');
        setRecordDialog(false);
        fetchPayments();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to record payment'); }
    finally { setRecording(false); }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Payments</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openRecordDialog}>
          Record Offline Payment
        </Button>
      </Box>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Total Collected', value: fmt(stats.total_collections), color: 'success.main' },
          { label: 'Paid Count', value: stats.total_paid, color: 'success.light' },
          { label: 'Pending', value: stats.total_pending, color: 'warning.main' },
          { label: 'Overdue', value: stats.total_overdue, color: 'error.main' },
        ].map(({ label, value, color }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="h5" color={color} fontWeight={700}>{value}</Typography>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }} sx={{ mb: 2 }}>
        {['All', 'Paid', 'Pending', 'Overdue'].map((l, i) => <Tab key={i} label={l} />)}
      </Tabs>

      <Card sx={{ borderRadius: 3 }}>
        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box> : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    {['Member', 'Chit Group', 'Month', 'Amount', 'Due Date', 'Status', 'Method', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p._id || p.id} hover>
                      <TableCell>
                        <Typography variant="body2">{p.user_id?.full_name || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.user_id?.mobile}</Typography>
                      </TableCell>
                      <TableCell>{p.chit_group_id?.group_name || '—'}</TableCell>
                      <TableCell>Month {p.month_number}</TableCell>
                      <TableCell>₹{Number(p.total_amount || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>{p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN') : '—'}</TableCell>
                      <TableCell>
                        <Chip label={p.payment_status || 'pending'} size="small"
                          color={statusColors[p.payment_status] || 'default'}
                          sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{p.payment_method || '—'}</TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5}>
                          {p.payment_status !== 'success' && (
                            <Tooltip title="Record payment">
                              <Button size="small" variant="outlined" color="success"
                                startIcon={<ApproveIcon />}
                                onClick={() => openRecordDialog()}>
                                Record
                              </Button>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={recordDialog} onClose={() => setRecordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Offline Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Member User ID *" value={form.user_id}
                onChange={e => setForm({ ...form, user_id: e.target.value })}
                helperText="Enter the member's user ID (MongoDB _id)" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth select label="Chit Group *" value={form.chit_group_id}
                onChange={e => setForm({ ...form, chit_group_id: e.target.value })}>
                {chitGroups.map(g => <MenuItem key={g._id || g.id} value={g._id || g.id}>{g.group_name} ({g.group_number})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Month Number *" type="number" value={form.month_number}
                onChange={e => setForm({ ...form, month_number: e.target.value })} inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Amount (₹) *" type="number" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Payment Method" value={form.payment_method}
                onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                {['cash', 'upi', 'bank_transfer', 'cheque'].map(m => (
                  <MenuItem key={m} value={m} sx={{ textTransform: 'capitalize' }}>{m.replace('_', ' ')}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes" multiline rows={2} value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecordDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordPayment} disabled={recording}
            startIcon={recording ? <CircularProgress size={16} /> : <ApproveIcon />}>
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Payments;

