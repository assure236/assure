import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, CircularProgress, IconButton, Tooltip, Grid, Card, CardContent,
  FormControl, InputLabel, Select
} from '@mui/material';
import {
  Refresh, CheckCircle, Cancel, AccountBalanceWallet, HourglassEmpty,
  AttachMoney, TrendingUp, Visibility
} from '@mui/icons-material';
import axios from 'axios';

const STATUS_COLORS = {
  requested: 'warning', under_review: 'info', approved: 'primary',
  disbursed: 'secondary', active: 'success', closed: 'default',
  rejected: 'error', defaulted: 'error'
};

const LOAN_TYPES = { chit_loan: 'Chit Loan', personal_loan: 'Personal', emergency_loan: 'Emergency' };

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function Loans() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewDialog, setReviewDialog] = useState({ open: false, loan: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, loan: null });
  const [reviewAction, setReviewAction] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [interestRate, setInterestRate] = useState('12');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [loansRes, statsRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/loans/admin/all`, {
          params: { page: page + 1, limit: 20, status: statusFilter }
        }),
        axios.get(`${process.env.REACT_APP_API_URL}/loans/admin/stats`)
      ]);
      setRows(loansRes.data.data?.loans || []);
      setTotal(loansRes.data.data?.total || 0);
      setStats(statsRes.data.data || {});
    } catch (e) {
      setError('Failed to load loans');
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openReview = (loan, action) => {
    setReviewDialog({ open: true, loan });
    setReviewAction(action);
    setApprovedAmount(String(loan.requested_amount || ''));
    setInterestRate(String(loan.interest_rate || 12));
    setRejectionReason('');
  };

  const handleReview = async () => {
    if (!reviewDialog.loan) return;
    try {
      setSaving(true);
      const payload = { action: reviewAction };
      if (reviewAction === 'reject') payload.rejection_reason = rejectionReason;
      if (reviewAction === 'approve') {
        payload.approved_amount = Number(approvedAmount);
        payload.interest_rate = Number(interestRate);
      }
      await axios.put(
        `${process.env.REACT_APP_API_URL}/loans/admin/${reviewDialog.loan._id}/review`,
        payload
      );
      setSuccess(`Loan ${reviewAction}${reviewAction === 'close' ? 'd' : reviewAction.endsWith('e') ? 'd' : 'ed'} successfully`);
      setReviewDialog({ open: false, loan: null });
      fetchData();
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed');
    } finally { setSaving(false); }
  };

  const statCards = [
    { label: 'Total Applications', value: stats.total || 0, icon: <AccountBalanceWallet />, color: '#0B1F3B' },
    { label: 'Pending Review', value: stats.pending || 0, icon: <HourglassEmpty />, color: '#F59E0B' },
    { label: 'Active Loans', value: stats.active || 0, icon: <TrendingUp />, color: '#16A34A' },
    { label: 'Total Disbursed', value: fmt(stats.total_disbursed || 0), icon: <AttachMoney />, color: '#1E3A8A' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Loan Management</Typography>
        <Button startIcon={<Refresh />} onClick={fetchData} variant="outlined">Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((c, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ bgcolor: c.color + '18', p: 1.5, borderRadius: 2, color: c.color }}>
                  {c.icon}
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{c.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        {['all', 'requested', 'under_review', 'approved', 'disbursed', 'active', 'rejected', 'closed'].map(s => (
          <Chip key={s} label={s === 'all' ? 'All' : s.replace('_', ' ')}
            variant={statusFilter === s ? 'filled' : 'outlined'}
            color={statusFilter === s ? 'primary' : 'default'}
            onClick={() => { setStatusFilter(s); setPage(0); }}
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </Box>

      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><b>Loan #</b></TableCell>
                <TableCell><b>Member</b></TableCell>
                <TableCell><b>Type</b></TableCell>
                <TableCell align="right"><b>Amount</b></TableCell>
                <TableCell align="right"><b>Tenure</b></TableCell>
                <TableCell align="right"><b>EMI</b></TableCell>
                <TableCell><b>Status</b></TableCell>
                <TableCell><b>Date</b></TableCell>
                <TableCell align="center"><b>Actions</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No loans found</Typography>
                  </TableCell>
                </TableRow>
              ) : rows.map(loan => (
                <TableRow key={loan._id} hover>
                  <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {loan.loan_number}
                  </TableCell>
                  <TableCell>
                    {loan.user_id?.full_name || loan.user_id?.mobile || '—'}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={LOAN_TYPES[loan.loan_type] || loan.loan_type} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{fmt(loan.approved_amount || loan.requested_amount)}</TableCell>
                  <TableCell align="right">{loan.tenure_months}m</TableCell>
                  <TableCell align="right">{loan.emi_amount ? fmt(loan.emi_amount) : '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={loan.status?.replace('_', ' ')}
                      color={STATUS_COLORS[loan.status] || 'default'}
                      sx={{ textTransform: 'capitalize' }} />
                  </TableCell>
                  <TableCell>{new Date(loan.created_at).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => setDetailDialog({ open: true, loan })}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {(loan.status === 'requested' || loan.status === 'under_review') && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton size="small" color="success" onClick={() => openReview(loan, 'approve')}>
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton size="small" color="error" onClick={() => openReview(loan, 'reject')}>
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {loan.status === 'approved' && (
                        <Tooltip title="Disburse">
                          <Button size="small" variant="outlined" color="primary"
                            onClick={() => openReview(loan, 'disburse')}>Disburse</Button>
                        </Tooltip>
                      )}
                      {(loan.status === 'active' || loan.status === 'disbursed') && (
                        <Tooltip title="Close Loan">
                          <Button size="small" variant="outlined" color="default"
                            onClick={() => openReview(loan, 'close')}>Close</Button>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination component="div" count={total} rowsPerPage={20}
          rowsPerPageOptions={[20]} page={page} onPageChange={(_, p) => setPage(p)} />
      </TableContainer>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onClose={() => setReviewDialog({ open: false, loan: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textTransform: 'capitalize' }}>
          {reviewAction} Loan — {reviewDialog.loan?.loan_number}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <b>Member:</b> {reviewDialog.loan?.user_id?.full_name || reviewDialog.loan?.user_id?.mobile || '—'} &nbsp;|&nbsp;
              <b>Amount:</b> {fmt(reviewDialog.loan?.requested_amount)} &nbsp;|&nbsp;
              <b>Tenure:</b> {reviewDialog.loan?.tenure_months} months
            </Typography>
            {reviewDialog.loan?.purpose && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <b>Purpose:</b> {reviewDialog.loan?.purpose}
              </Typography>
            )}

            {reviewAction === 'approve' && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <TextField label="Approved Amount" type="number" fullWidth
                  value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} />
                <TextField label="Interest Rate (%)" type="number" sx={{ width: 180 }}
                  value={interestRate} onChange={e => setInterestRate(e.target.value)} />
              </Box>
            )}

            {reviewAction === 'reject' && (
              <TextField label="Rejection Reason" multiline rows={3} fullWidth sx={{ mt: 2 }}
                value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
            )}

            {reviewAction === 'disburse' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Approved amount of {fmt(reviewDialog.loan?.approved_amount)} will be marked as disbursed.
              </Alert>
            )}

            {reviewAction === 'close' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This will close the loan. Make sure all dues are settled.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialog({ open: false, loan: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleReview} disabled={saving}
            color={reviewAction === 'reject' ? 'error' : 'primary'}
            startIcon={saving ? <CircularProgress size={16} /> : null}>
            {saving ? 'Processing...' : reviewAction}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onClose={() => setDetailDialog({ open: false, loan: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Loan Details — {detailDialog.loan?.loan_number}</DialogTitle>
        <DialogContent dividers>
          {detailDialog.loan && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              {[
                ['Status', detailDialog.loan.status?.replace('_', ' ')],
                ['Type', LOAN_TYPES[detailDialog.loan.loan_type] || detailDialog.loan.loan_type],
                ['Requested', fmt(detailDialog.loan.requested_amount)],
                ['Approved', detailDialog.loan.approved_amount ? fmt(detailDialog.loan.approved_amount) : '—'],
                ['Interest', `${detailDialog.loan.interest_rate || 12}%`],
                ['Tenure', `${detailDialog.loan.tenure_months} months`],
                ['EMI', detailDialog.loan.emi_amount ? fmt(detailDialog.loan.emi_amount) : '—'],
                ['Outstanding', detailDialog.loan.outstanding_amount ? fmt(detailDialog.loan.outstanding_amount) : '—'],
                ['Applied', new Date(detailDialog.loan.created_at).toLocaleDateString('en-IN')],
                ['Member', detailDialog.loan.user_id?.full_name || detailDialog.loan.user_id?.mobile || '—'],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{value}</Typography>
                </Box>
              ))}
              {detailDialog.loan.purpose && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="caption" color="text.secondary">Purpose</Typography>
                  <Typography variant="body2">{detailDialog.loan.purpose}</Typography>
                </Box>
              )}
              {detailDialog.loan.rejection_reason && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Alert severity="error" sx={{ mt: 1 }}>
                    <b>Rejection Reason:</b> {detailDialog.loan.rejection_reason}
                  </Alert>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog({ open: false, loan: null })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
