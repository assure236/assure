import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Grid, Chip, Button,
  CircularProgress, Alert, Divider, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Avatar, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const statusColors = {
  active: 'success', completed: 'default', suspended: 'error',
  pending: 'warning', accepting_members: 'info'
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const auctionDays = Array.from({ length: 31 }, (_, i) => i + 1);

export default function ChitGroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/chit-groups/${id}`);
      if (res.data.success) {
        const { group: grpData, members, auctions, recentPayments, totalCollected } = res.data.data;
        setGroup({ ...grpData, members: members || [], auctions: auctions || [], recentPayments: recentPayments || [], totalCollected: totalCollected || 0 });
      }
    } catch (err) {
      setError('Could not load chit group details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  const handleStatusToggle = async () => {
    if (!group) return;
    const newStatus = group.status === 'active' ? 'suspended' : 'active';
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/chit-groups/${id}`, { status: newStatus });
      toast.success(`Group ${newStatus === 'active' ? 'activated' : 'suspended'}`);
      fetchGroup();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleDeleteGroup = async () => {
    setDeleteLoading(true);
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/admin/chit-groups/${id}`);
      toast.success('Group deleted successfully');
      navigate('/chit-groups');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  const openEdit = () => {
    if (!group) return;
    setEditForm({
      group_name: group.group_name || '',
      group_number: group.group_number || '',
      pso_number: group.pso_number || '',
      chit_value: group.chit_value ?? '',
      duration_months: group.duration_months ?? '',
      monthly_installment: group.monthly_installment ?? '',
      total_members: group.total_members ?? '',
      auction_day: group.auction_day ?? '',
      commencement_date: toDateInput(group.commencement_date || group.start_date),
      description: group.description || '',
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      const duration = Number(next.duration_months || 0);
      const chitValue = Number(next.chit_value || 0);

      if (field === 'duration_months') {
        next.total_members = duration;
      }

      if (field === 'duration_months' || field === 'chit_value') {
        next.monthly_installment = duration > 0 ? Math.round(chitValue / duration) : 0;
      }

      return next;
    });
  };

  const handleEditSave = async () => {
    if (!editForm) return;
    if (!editForm.group_name || !editForm.chit_value || !editForm.duration_months || !editForm.commencement_date || !editForm.auction_day) {
      setEditError('Please fill in all required fields.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        group_name: editForm.group_name.trim(),
        pso_number: editForm.pso_number || '',
        chit_value: Number(editForm.chit_value),
        duration_months: Number(editForm.duration_months),
        total_members: Number(editForm.duration_months),
        monthly_installment: Number(editForm.monthly_installment),
        auction_day: Number(editForm.auction_day),
        commencement_date: editForm.commencement_date,
        description: editForm.description || '',
      };

      const res = await axios.put(`${process.env.REACT_APP_API_URL}/admin/chit-groups/${id}`, payload);
      if (res.data.success) {
        setGroup((prev) => (prev ? { ...prev, ...res.data.data } : res.data.data));
        toast.success('Group updated');
        setEditOpen(false);
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );

  if (error || !group) return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/chit-groups')} sx={{ mb: 2 }}>Back</Button>
      <Alert severity="error">{error || 'Group not found'}</Alert>
    </Container>
  );

  const members = group.members || [];
  const progress = group.duration_months > 0
    ? Math.round(((group.current_month || 0) / group.duration_months) * 100)
    : 0;

  const infoRows = [
    { label: 'Group Number', value: group.group_number },
    { label: 'Chit Value', value: fmt(group.chit_value) },
    { label: 'Monthly Installment', value: fmt(group.monthly_installment) },
    { label: 'Duration', value: `${group.duration_months} months` },
    { label: 'Total Members', value: group.total_members },
    { label: 'Enrolled', value: `${group.enrolled_members || members.length} / ${group.total_members}` },
    { label: 'Current Month', value: `${group.current_month || 0} / ${group.duration_months}` },
    { label: 'Auction Day', value: group.auction_day ? `Day ${group.auction_day} of each month` : '—' },
    { label: 'Start Date', value: fmtDate(group.commencement_date || group.start_date) },
    { label: 'Description', value: group.description || '—' },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/chit-groups')}><BackIcon /></IconButton>
          <Box>
            <Typography variant="h4">{group.group_name}</Typography>
            <Typography variant="body2" color="text.secondary">{group.group_number}</Typography>
          </Box>
          <Chip label={group.status} color={statusColors[group.status] || 'default'} />
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Edit">
            <IconButton onClick={openEdit}><EditIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Delete Group">
            <IconButton color="error" onClick={() => setDeleteOpen(true)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchGroup}><RefreshIcon /></IconButton>
          </Tooltip>
          <Button
            variant={group.status === 'active' ? 'outlined' : 'contained'}
            color={group.status === 'active' ? 'error' : 'success'}
            onClick={handleStatusToggle}
            disabled={group.status === 'completed'}
          >
            {group.status === 'active' ? 'Suspend Group' : 'Activate Group'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Group Info */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Group Details</Typography>
              <Divider sx={{ mb: 2 }} />
              {infoRows.map(({ label, value }) => (
                <Box key={label} display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>{label}</Typography>
                  <Typography variant="body2" fontWeight={600} textAlign="right">{value}</Typography>
                </Box>
              ))}
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Progress — Month {group.current_month || 0} of {group.duration_months}
                </Typography>
                <Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 4, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: 'primary.main', borderRadius: 4 }} />
                </Box>
                <Typography variant="caption" color="text.secondary">{progress}% complete</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Summary */}
        <Grid item xs={12} md={7}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: 'Total Prize Pool', value: fmt(group.chit_value), color: '#0B1F3B' },
              { label: 'Monthly Collection', value: fmt(group.monthly_installment * (group.enrolled_members || members.length)), color: '#388e3c' },
              { label: 'Commission (5%)', value: fmt(group.chit_value * 0.05), color: '#B8960F' },
              { label: 'Members Enrolled', value: `${group.enrolled_members || members.length} / ${group.total_members}`, color: '#7b1fa2' },
            ].map(({ label, value, color }) => (
              <Grid item xs={6} key={label}>
                <Card sx={{ borderTop: `4px solid ${color}`, borderRadius: 2 }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" fontWeight={700}>{value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Members Table */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="h6" fontWeight={700}>Members ({members.length})</Typography>
            </CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    {['Ticket', 'Name', 'Mobile', 'Status', 'Received Prize'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No members enrolled yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m._id || m.id} hover>
                        <TableCell>#{m.ticket_number}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
                              {(m.user_id?.full_name || 'U').charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">{m.user_id?.full_name || '—'}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{m.user_id?.mobile || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={m.is_active !== false ? 'Active' : 'Inactive'}
                            size="small"
                            color={m.is_active !== false ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={m.has_won_auction ? 'Yes' : 'No'}
                            size="small"
                            color={m.has_won_auction ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Chit Group</DialogTitle>
        <DialogContent dividers>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Group Number"
                value={editForm?.group_number || ''}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Group Name"
                value={editForm?.group_name || ''}
                onChange={(e) => handleEditChange('group_name', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="PSO Number"
                value={editForm?.pso_number || ''}
                onChange={(e) => handleEditChange('pso_number', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Chit Value"
                type="number"
                value={editForm?.chit_value ?? ''}
                onChange={(e) => handleEditChange('chit_value', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Duration (months)"
                type="number"
                value={editForm?.duration_months ?? ''}
                onChange={(e) => handleEditChange('duration_months', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Total Members"
                type="number"
                value={editForm?.total_members ?? ''}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Monthly Installment"
                type="number"
                value={editForm?.monthly_installment ?? ''}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Auction Day"
                select
                value={editForm?.auction_day ?? ''}
                onChange={(e) => handleEditChange('auction_day', e.target.value)}
                fullWidth
                required
              >
                {auctionDays.map((day) => (
                  <MenuItem key={day} value={day}>{day}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Commencement Date"
                type="date"
                value={editForm?.commencement_date || ''}
                onChange={(e) => handleEditChange('commencement_date', e.target.value)}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={editForm?.description || ''}
                onChange={(e) => handleEditChange('description', e.target.value)}
                fullWidth
                multiline
                minRows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSaving}>
            {editSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Chit Group</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{group.group_name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteGroup}
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
