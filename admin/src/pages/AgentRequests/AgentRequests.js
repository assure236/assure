import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Alert, CircularProgress, IconButton, Tooltip, Card, CardContent,
  Grid, FormControl, InputLabel, Select, MenuItem, Avatar
} from '@mui/material';
import { CheckCircle, Cancel, HourglassEmpty, Refresh, Badge } from '@mui/icons-material';
import axios from 'axios';

const STATUS_COLORS = { pending: 'warning', approved: 'success', rejected: 'error' };

export default function AgentRequests() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewDialog, setReviewDialog] = useState({ open: false, request: null });
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/agent-requests`, {
        params: { page: page + 1, limit: 20, ...(statusFilter ? { status: statusFilter } : {}) }
      });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      setError('Failed to load agent requests');
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const [p, a, r] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/admin/agent-requests`, { params: { status: 'pending', limit: 1 } }),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/agent-requests`, { params: { status: 'approved', limit: 1 } }),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/agent-requests`, { params: { status: 'rejected', limit: 1 } }),
      ]);
      setStats({ pending: p.data.total || 0, approved: a.data.total || 0, rejected: r.data.total || 0 });
    } catch (_) {}
  }, []);

  useEffect(() => { fetchData(); fetchStats(); }, [fetchData, fetchStats]);

  const handleReview = async (status) => {
    try {
      setSaving(true);
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/agent-requests/${reviewDialog.request._id}`, {
        status, admin_note: adminNote
      });
      setSuccess(`Request ${status} successfully`);
      setReviewDialog({ open: false, request: null });
      setAdminNote('');
      fetchData();
      fetchStats();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update request');
    } finally { setSaving(false); }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">Agent Requests</Typography>
        <Tooltip title="Refresh"><IconButton onClick={() => { fetchData(); fetchStats(); }}><Refresh /></IconButton></Tooltip>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Pending', value: stats.pending, color: '#F59E0B', icon: <HourglassEmpty /> },
          { label: 'Approved', value: stats.approved, color: '#16A34A', icon: <CheckCircle /> },
          { label: 'Rejected', value: stats.rejected, color: '#DC2626', icon: <Cancel /> },
        ].map(s => (
          <Grid item xs={12} sm={4} key={s.label}>
            <Card sx={{ cursor: 'pointer', border: statusFilter === s.label.toLowerCase() ? `2px solid ${s.color}` : 'none' }}
              onClick={() => setStatusFilter(prev => prev === s.label.toLowerCase() ? '' : s.label.toLowerCase())}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: s.color }}>{s.icon}</Box>
                <Box>
                  <Typography variant="h5" fontWeight="bold">{s.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Member ID</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Reviewed By</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={30} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No agent requests found</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r._id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar src={r.user_id?.profile_image_url} sx={{ width: 32, height: 32 }}>
                        {r.user_id?.full_name?.[0]}
                      </Avatar>
                      {r.user_id?.full_name || 'Unknown'}
                    </Box>
                  </TableCell>
                  <TableCell>{r.user_id?.member_id || '-'}</TableCell>
                  <TableCell>{r.user_id?.phone || '-'}</TableCell>
                  <TableCell><Chip label={r.status} color={STATUS_COLORS[r.status]} size="small" /></TableCell>
                  <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{r.reviewed_by?.full_name || '-'}</TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <Button size="small" variant="outlined" onClick={() => { setReviewDialog({ open: true, request: r }); setAdminNote(''); }}>
                        Review
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={20} rowsPerPageOptions={[20]} />
      </Paper>

      <Dialog open={reviewDialog.open} onClose={() => setReviewDialog({ open: false, request: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Review Agent Request</DialogTitle>
        <DialogContent>
          {reviewDialog.request && (
            <Box mt={1}>
              <Typography><strong>Name:</strong> {reviewDialog.request.user_id?.full_name}</Typography>
              <Typography><strong>Member ID:</strong> {reviewDialog.request.user_id?.member_id}</Typography>
              <Typography><strong>Phone:</strong> {reviewDialog.request.user_id?.phone}</Typography>
              <Typography><strong>Email:</strong> {reviewDialog.request.user_id?.email || '-'}</Typography>
              <TextField label="Admin Note (optional)" fullWidth multiline rows={3} value={adminNote}
                onChange={e => setAdminNote(e.target.value)} sx={{ mt: 2 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialog({ open: false, request: null })}>Cancel</Button>
          <Button onClick={() => handleReview('rejected')} color="error" disabled={saving}>Reject</Button>
          <Button onClick={() => handleReview('approved')} variant="contained" color="success" disabled={saving}>Approve</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
