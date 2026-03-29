import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Alert, Tooltip, IconButton, Grid
} from '@mui/material';
import {
  AccountBalance as DisbursalIcon, CheckCircle as ApproveIcon,
  Cancel as RejectIcon, Refresh as RefreshIcon, Info as InfoIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const statusColor = { pending: 'warning', disbursed: 'success', rejected: 'error' };

const Disbursals = () => {
  const [disbursals, setDisbursals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disburseDialog, setDisburseDialog] = useState(null); // selected auction
  const [rejectDialog, setRejectDialog] = useState(null);
  const [refNumber, setRefNumber] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpAction, setOtpAction] = useState(''); // 'disburse' or 'reject'

  const fetchDisbursals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('admin/disbursals');
      setDisbursals(res.data.data?.disbursals || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load disbursals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisbursals(); }, [fetchDisbursals]);

  const handleDisburse = async () => {
    if (!refNumber.trim()) { toast.error('Please enter a reference number'); return; }
    if (!otpVerified) { toast.error('Please verify OTP first'); return; }
    setSubmitting(true);
    try {
      await axios.put(`admin/disbursals/${disburseDialog.auction_id}/disburse`, { reference_number: refNumber });
      toast.success('Disbursal approved and marked as disbursed!');
      setDisburseDialog(null);
      setRefNumber('');
      resetOtp();
      fetchDisbursals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve disbursal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!otpVerified) { toast.error('Please verify OTP first'); return; }
    setSubmitting(true);
    try {
      await axios.put(`admin/disbursals/${rejectDialog.auction_id}/reject`, { reason: rejectReason });
      toast.success('Disbursal rejected.');
      setRejectDialog(null);
      setRejectReason('');
      resetOtp();
      fetchDisbursals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject disbursal');
    } finally {
      setSubmitting(false);
    }
  };

  const sendOtp = async (action, targetId) => {
    try {
      const res = await axios.post('admin/otp/send', { action, target_id: targetId });
      toast.success(res.data.message || 'OTP sent!');
      setOtpSent(true);
      setOtpAction(action);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  const verifyOtp = async (action, targetId) => {
    if (!otp.trim()) { toast.error('Enter OTP'); return; }
    try {
      const res = await axios.post('admin/otp/verify', { action, target_id: targetId, otp: otp.trim() });
      if (res.data.success) {
        toast.success('OTP verified!');
        setOtpVerified(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    }
  };

  const resetOtp = () => {
    setOtpSent(false);
    setOtp('');
    setOtpVerified(false);
    setOtpAction('');
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  // Summary stats
  const pending = disbursals.filter(d => d.status === 'pending');
  const disbursed = disbursals.filter(d => d.status === 'disbursed');
  const rejected = disbursals.filter(d => d.status === 'rejected');
  const totalPending = pending.reduce((s, d) => s + Number(d.disbursal_amount || 0), 0);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <DisbursalIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4">Disbursal Management</Typography>
        </Box>
        <IconButton onClick={fetchDisbursals} title="Refresh"><RefreshIcon /></IconButton>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Pending Disbursals', value: pending.length, sub: fmt(totalPending) + ' awaiting', color: '#ff9800' },
          { label: 'Disbursed', value: disbursed.length, sub: 'Completed', color: '#4caf50' },
          { label: 'Rejected', value: rejected.length, sub: 'Declined', color: '#f44336' },
          { label: 'Total', value: disbursals.length, sub: 'All records', color: '#1976d2' },
        ].map((s) => (
          <Grid item xs={12} sm={6} md={3} key={s.label}>
            <Card sx={{ borderLeft: `4px solid ${s.color}`, borderRadius: 3 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h4" fontWeight={700} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {pending.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {pending.length} disbursal(s) pending approval — total {fmt(totalPending)} awaiting disbursement.
        </Alert>
      )}

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
          ) : disbursals.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={8} color="text.secondary">
              <DisbursalIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography>No completed auctions with disbursal records yet.</Typography>
              <Typography variant="caption">Disbursals appear after auction winners are selected.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell>Auction / Group</TableCell>
                    <TableCell>Winner</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Chit Value</TableCell>
                    <TableCell align="right">Winning Bid</TableCell>
                    <TableCell align="right">Commission (5%)</TableCell>
                    <TableCell align="right">Dividend/Member</TableCell>
                    <TableCell align="right">Winner Gets</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {disbursals.map((d) => (
                    <TableRow key={d.auction_id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{d.group_name}</Typography>
                        <Typography variant="caption" color="text.secondary">#{d.auction_id?.slice(0,8)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{d.winner_name || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{d.winner_mobile}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">Month {d.month_number}</Typography>
                      </TableCell>
                      <TableCell align="right">{fmt(d.chit_value)}</TableCell>
                      <TableCell align="right">{fmt(d.winning_bid_amount)}</TableCell>
                      <TableCell align="right">
                        <Typography color="error.main" variant="body2">{fmt(d.commission_amount)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="info.main" variant="body2">{fmt(d.dividend_per_member)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="success.main">{fmt(d.disbursal_amount)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={d.status || 'pending'} size="small" color={statusColor[d.status] || 'default'}
                          sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {d.reference_number || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {(!d.status || d.status === 'pending') && (
                          <Box display="flex" gap={1} justifyContent="center">
                            <Tooltip title="Approve & Disburse">
                              <Button size="small" variant="contained" color="success" startIcon={<ApproveIcon />}
                                onClick={() => setDisburseDialog(d)}>Disburse</Button>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <Button size="small" variant="outlined" color="error" startIcon={<RejectIcon />}
                                onClick={() => setRejectDialog(d)}>Reject</Button>
                            </Tooltip>
                          </Box>
                        )}
                        {d.status === 'disbursed' && (
                          <Chip icon={<ApproveIcon />} label="Disbursed" color="success" size="small" />
                        )}
                        {d.status === 'rejected' && (
                          <Chip icon={<RejectIcon />} label="Rejected" color="error" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={!!disburseDialog} onClose={() => { setDisburseDialog(null); setRefNumber(''); resetOtp(); }} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Disbursal</DialogTitle>
        <DialogContent>
          {disburseDialog && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Approve disbursal of <strong>{fmt(disburseDialog.disbursal_amount)}</strong> to <strong>{disburseDialog.winner_name}</strong> (Month {disburseDialog.month_number} of {disburseDialog.group_name}).
              </Alert>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Chit Value: {fmt(disburseDialog.chit_value)} | Winning Bid: {fmt(disburseDialog.winning_bid_amount)}<br/>
                Commission (5%): {fmt(disburseDialog.commission_amount)} | Dividend/Member: {fmt(disburseDialog.dividend_per_member)}<br/>
                Winner Receives: {fmt(disburseDialog.disbursal_amount)}
              </Alert>
              <TextField
                fullWidth label="Transaction / Reference Number" value={refNumber}
                onChange={e => setRefNumber(e.target.value)}
                helperText="NEFT/IMPS/UPI reference number for the bank transfer"
                sx={{ mt: 1 }}
              />
              {/* OTP Section */}
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Admin OTP Verification</Typography>
                {!otpSent ? (
                  <Button variant="outlined" size="small" onClick={() => sendOtp('disburse', disburseDialog.auction_id)}>
                    Send OTP
                  </Button>
                ) : !otpVerified ? (
                  <Box display="flex" gap={1} alignItems="center">
                    <TextField size="small" label="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)}
                      inputProps={{ maxLength: 6 }} sx={{ width: 150 }} />
                    <Button variant="contained" size="small" onClick={() => verifyOtp('disburse', disburseDialog.auction_id)}>
                      Verify
                    </Button>
                    <Button size="small" onClick={() => sendOtp('disburse', disburseDialog.auction_id)}>Resend</Button>
                  </Box>
                ) : (
                  <Alert severity="success" sx={{ py: 0 }}>OTP Verified ✓</Alert>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDisburseDialog(null); setRefNumber(''); resetOtp(); }}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleDisburse} disabled={submitting || !otpVerified}>
            {submitting ? <CircularProgress size={20} /> : 'Confirm Disbursal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onClose={() => { setRejectDialog(null); setRejectReason(''); resetOtp(); }} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Disbursal</DialogTitle>
        <DialogContent>
          {rejectDialog && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Rejecting disbursal for <strong>{rejectDialog.winner_name}</strong> — Month {rejectDialog.month_number} of <strong>{rejectDialog.group_name}</strong>.
              </Alert>
              <TextField fullWidth label="Reason for Rejection (optional)" multiline rows={3}
                value={rejectReason} onChange={e => setRejectReason(e.target.value)} sx={{ mt: 1 }} />
              {/* OTP Section */}
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Admin OTP Verification</Typography>
                {!otpSent ? (
                  <Button variant="outlined" size="small" onClick={() => sendOtp('reject', rejectDialog.auction_id)}>
                    Send OTP
                  </Button>
                ) : !otpVerified ? (
                  <Box display="flex" gap={1} alignItems="center">
                    <TextField size="small" label="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)}
                      inputProps={{ maxLength: 6 }} sx={{ width: 150 }} />
                    <Button variant="contained" size="small" onClick={() => verifyOtp('reject', rejectDialog.auction_id)}>
                      Verify
                    </Button>
                    <Button size="small" onClick={() => sendOtp('reject', rejectDialog.auction_id)}>Resend</Button>
                  </Box>
                ) : (
                  <Alert severity="success" sx={{ py: 0 }}>OTP Verified ✓</Alert>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRejectDialog(null); setRejectReason(''); resetOtp(); }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleReject} disabled={submitting || !otpVerified}>
            {submitting ? <CircularProgress size={20} /> : 'Reject Disbursal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Disbursals;
