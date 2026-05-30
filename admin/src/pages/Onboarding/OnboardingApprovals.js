import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, Paper, Stack, Chip, Button, Avatar,
  Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab,
  Tooltip,
} from '@mui/material';
import axios from 'axios';
import { toast } from 'react-toastify';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';

const STEP_LABEL = {
  manual_kyc: 'Manual KYC',
  bank: 'Bank Verification',
  cheque: 'Cancelled Cheque',
};

const STATUS_COLOR = {
  pending_review: 'warning',
  uploaded: 'info',
  verified: 'success',
  approved: 'success',
  rejected: 'error',
};

export default function OnboardingApprovals() {
  const [tab, setTab] = useState('all');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null); // { user_id, step, full_name }
  const [rejectReason, setRejectReason] = useState('');
  const [docDialog, setDocDialog] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get('/admin/onboarding/pending');
      setData(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load pending onboarding submissions.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const approve = async (user_id, step) => {
    try {
      await axios.post(`/admin/onboarding/${user_id}/${step}/approve`);
      toast.success(`${STEP_LABEL[step]} approved.`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Approval failed.');
    }
  };

  const reject = async () => {
    if (!rejectDialog) return;
    try {
      await axios.post(`/admin/onboarding/${rejectDialog.user_id}/${rejectDialog.step}/reject`, { reason: rejectReason });
      toast.info(`${STEP_LABEL[rejectDialog.step]} rejected.`);
      setRejectDialog(null); setRejectReason('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Reject failed.');
    }
  };

  // Flatten into pending step rows
  const rows = [];
  for (const u of data) {
    const o = u.onboarding || {};
    if (o.manual_kyc?.status === 'pending_review') rows.push({ user: u, step: 'manual_kyc', status: o.manual_kyc.status, when: o.manual_kyc.submitted_at });
    if (o.bank?.status === 'pending_review') rows.push({ user: u, step: 'bank', status: o.bank.status, when: o.bank.completed_at, extra: o.bank });
    if (o.cheque?.status === 'uploaded') rows.push({ user: u, step: 'cheque', status: o.cheque.status, when: o.cheque.completed_at });
  }
  const filtered = tab === 'all' ? rows : rows.filter((r) => r.step === tab);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Onboarding Approvals</Typography>
          <Typography variant="body2" color="text.secondary">Manual KYC uploads, bank-name mismatches, and cancelled-cheque uploads awaiting your review.</Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined">Refresh</Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="all" label={`All (${rows.length})`} />
        <Tab value="manual_kyc" label={`Manual KYC (${rows.filter((r) => r.step === 'manual_kyc').length})`} />
        <Tab value="bank" label={`Bank (${rows.filter((r) => r.step === 'bank').length})`} />
        <Tab value="cheque" label={`Cheque (${rows.filter((r) => r.step === 'cheque').length})`} />
      </Tabs>

      <Paper sx={{ p: 0, borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">Nothing pending. All caught up!</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Step</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={`${r.user._id}-${r.step}-${i}`} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar src={r.user.profile_image_url} sx={{ width: 36, height: 36 }}>
                        {(r.user.full_name || '?').charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{r.user.full_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.user.member_id} · {r.user.mobile}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={STEP_LABEL[r.step]}
                      color={STATUS_COLOR[r.status] || 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {r.step === 'bank' && r.extra ? (
                      <Box>
                        <Typography variant="caption">
                          Holder: <b>{r.extra.account_holder_name || '—'}</b><br />
                          Score: {r.extra.name_match_score ?? 'n/a'}<br />
                          {r.extra.rejection_reason && <span style={{ color: '#b91c1c' }}>{r.extra.rejection_reason}</span>}
                        </Typography>
                      </Box>
                    ) : (
                      <Tooltip title="View user docs in Documents page">
                        <Button size="small" startIcon={<VisibilityIcon />} onClick={() => setDocDialog(r.user)}>
                          View
                        </Button>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{r.when ? new Date(r.when).toLocaleString('en-IN') : '—'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => approve(r.user._id, r.step)}
                        variant="contained"
                      >Approve</Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => { setRejectDialog({ user_id: r.user._id, step: r.step, full_name: r.user.full_name }); setRejectReason(''); }}
                        variant="outlined"
                      >Reject</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={!!rejectDialog} onClose={() => setRejectDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject {rejectDialog ? STEP_LABEL[rejectDialog.step] : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Member: <b>{rejectDialog?.full_name}</b>
          </Typography>
          <TextField
            label="Reason (will be shown to member)"
            multiline
            minRows={3}
            fullWidth
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={reject} disabled={!rejectReason.trim()}>Reject</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!docDialog} onClose={() => setDocDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{docDialog?.full_name} — Submitted Documents</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Open the <b>Documents / KYC</b> page from the sidebar to review and download files. This dialog shows summary only.
          </Alert>
          {docDialog && (
            <Box>
              <Typography variant="body2"><b>Member ID:</b> {docDialog.member_id}</Typography>
              <Typography variant="body2"><b>Mobile:</b> {docDialog.mobile}</Typography>
              <Typography variant="body2"><b>Email:</b> {docDialog.email}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
