import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, CircularProgress, IconButton, Tooltip, Grid, Card, CardContent,
  Divider, FormControl, InputLabel, Select
} from '@mui/material';
import {
  Add, Edit, SupportAgent, CheckCircle, HourglassEmpty, Close, Refresh, FiberNew
} from '@mui/icons-material';
import axios from 'axios';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const STATUS_COLORS = { open: 'error', in_progress: 'warning', resolved: 'success', closed: 'default' };
const PRIORITY_COLORS = { low: 'default', medium: 'info', high: 'warning', urgent: 'error' };

const defaultForm = { subject: '', description: '', priority: 'medium', user_name: 'Admin User' };

export default function Support() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [updateDialog, setUpdateDialog] = useState({ open: false, ticket: null });
  const [form, setForm] = useState(defaultForm);
  const [resolution, setResolution] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/support/tickets`, {
        params: { page: page + 1, limit: 20, status: statusFilter }
      });
      setRows(res.data.data?.tickets || []);
      setTotal(res.data.data?.total || 0);
    } catch (e) {
      setError('Failed to load tickets');
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.subject || !form.description) { setError('Subject and description are required'); return; }
    try {
      setSaving(true);
      await axios.post(`${process.env.REACT_APP_API_URL}/admin/support/tickets`, form);
      setSuccess('Ticket created');
      setCreateDialog(false);
      setForm(defaultForm);
      fetchData();
    } catch (e) { setError('Failed to create ticket'); } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);
      const payload = {};
      if (updateStatus) payload.status = updateStatus;
      if (resolution) payload.resolution = resolution;
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/support/tickets/${updateDialog.ticket.id}`, payload);
      setSuccess('Ticket updated');
      setUpdateDialog({ open: false, ticket: null });
      setResolution('');
      setUpdateStatus('');
      fetchData();
    } catch (e) { setError('Failed to update ticket'); } finally { setSaving(false); }
  };

  const openUpdate = (ticket) => {
    setUpdateDialog({ open: true, ticket });
    setUpdateStatus(ticket.status);
    setResolution(ticket.resolution || '');
  };

  // Stats
  const byStatus = STATUSES.map(s => ({ status: s, count: rows.filter(r => r.status === s).length }));
  const openCount = rows.filter(r => r.status === 'open').length;
  const inProgressCount = rows.filter(r => r.status === 'in_progress').length;
  const resolvedCount = rows.filter(r => r.status === 'resolved' || r.status === 'closed').length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Support Tickets</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={fetchData} variant="outlined">Refresh</Button>
          <Button startIcon={<Add />} variant="contained" onClick={() => setCreateDialog(true)}>New Ticket</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Open', value: openCount, color: '#d32f2f', icon: <FiberNew /> },
          { label: 'In Progress', value: inProgressCount, color: '#B8960F', icon: <HourglassEmpty /> },
          { label: 'Resolved / Closed', value: resolvedCount, color: '#388e3c', icon: <CheckCircle /> },
          { label: 'Total Tickets', value: total, color: '#0B1F3B', icon: <SupportAgent /> },
        ].map((c, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card sx={{ borderTop: `4px solid ${c.color}`, cursor: 'pointer' }}
              onClick={() => { setStatusFilter(i === 0 ? 'open' : i === 1 ? 'in_progress' : i === 2 ? 'resolved' : 'all'); setPage(0); }}>
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
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            {statusFilter === 'all' ? 'All Tickets' : `${statusFilter.replace('_', ' ')} Tickets`}
          </Typography>
          <TextField select label="Status Filter" size="small" value={statusFilter} sx={{ minWidth: 150 }}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
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
                    {['Ticket ID', 'Subject', 'Created By', 'Priority', 'Status', 'Created At', 'Resolution', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                      No tickets found. Click "New Ticket" to create one.
                    </TableCell></TableRow>
                  ) : rows.map(ticket => (
                    <TableRow key={ticket._id || ticket.id} hover sx={{ opacity: ticket.status === 'closed' ? 0.7 : 1 }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{ticket.id}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" fontWeight={500}>{ticket.subject}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ticket.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{ticket.user_id?.full_name || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={ticket.priority} size="small" color={PRIORITY_COLORS[ticket.priority]} sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={ticket.status.replace('_', ' ')} size="small" color={STATUS_COLORS[ticket.status]} sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('en-IN') : '—'}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>
                        <Typography variant="caption" color="text.secondary">{ticket.resolution || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Update Ticket">
                          <IconButton size="small" onClick={() => openUpdate(ticket)} color="primary">
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
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

      {/* Create Ticket Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Support Ticket</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Subject *" fullWidth size="small" value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description *" multiline rows={4} fullWidth size="small" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <MenuItem key={p} value={p} sx={{ textTransform: 'capitalize' }}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Submitted By" fullWidth size="small" value={form.user_name}
                onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={saving}>
            {saving ? 'Creating...' : 'Create Ticket'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Ticket Dialog */}
      <Dialog open={updateDialog.open} onClose={() => setUpdateDialog({ open: false, ticket: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Update Ticket — {updateDialog.ticket?.id}</DialogTitle>
        <DialogContent>
          {updateDialog.ticket && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Subject</Typography>
                <Typography fontWeight={500}>{updateDialog.ticket.subject}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography variant="body2">{updateDialog.ticket.description}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Update Status</InputLabel>
                  <Select label="Update Status" value={updateStatus} onChange={e => setUpdateStatus(e.target.value)}>
                    {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField label="Resolution / Notes" multiline rows={3} fullWidth size="small"
                  value={resolution} onChange={e => setResolution(e.target.value)}
                  placeholder="Add resolution notes or admin response..." />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialog({ open: false, ticket: null })}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Update Ticket'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
