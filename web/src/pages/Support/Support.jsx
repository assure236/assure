import React, { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Grid, Divider, Alert, IconButton
} from '@mui/material';
import {
  Add as AddIcon, SupportAgent as SupportIcon, Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useSearchParams } from 'react-router-dom';
import { useActiveMember } from '../../context/ActiveMemberContext';

const CATEGORIES = [
  'General', 'Payment Issue', 'Auction Related', 'KYC / Documents',
  'Account Issue', 'Profile / Account Issue', 'Technical Bug',
  'Chit Transfer/Cancel', 'Loan Related', 'Other',
];

const toBackendCategory = (ui) =>
  ui === 'Profile / Account Issue' ? 'Account Issue' : ui;

const priorityColor = (p) => {
  const v = (p || '').toLowerCase();
  if (v === 'high' || v === 'urgent') return 'error';
  if (v === 'low') return 'default';
  return 'warning';
};

const statusColor = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'resolved' || v === 'closed') return 'success';
  if (v === 'open' || v === 'pending') return 'warning';
  return 'info';
};

const Support = () => {
  const [searchParams] = useSearchParams();
  const { refreshKey } = useActiveMember();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'General',
    subject: '',
    description: '',
    priority: 'normal',
  });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/users/support/tickets');
      if (res.data.success) setTickets(res.data.data || []);
    } catch {
      toast.error('Could not load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [refreshKey]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const cat = searchParams.get('category');
      setForm((f) => ({
        ...f,
        category: cat && CATEGORIES.includes(cat) ? cat : 'General',
      }));
      setCreateOpen(true);
    }
  }, [searchParams]);

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error('Subject and description are required');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post('/users/support', {
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: toBackendCategory(form.category),
        priority: form.priority === 'high' ? 'high' : 'medium',
      });
      if (res.data.success) {
        toast.success('Ticket raised successfully');
        setCreateOpen(false);
        setForm({ category: 'General', subject: '', description: '', priority: 'normal' });
        fetchTickets();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (ticket) => {
    try {
      const res = await axios.get(`/users/support/tickets/${ticket._id || ticket.id}`);
      if (res.data.success) setDetail(res.data.data);
      else setDetail(ticket);
    } catch {
      setDetail(ticket);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Support</Typography>
          <Typography variant="body2" color="text.secondary">
            Raise and track support tickets for the selected account
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Raise Ticket
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <SupportIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No support tickets yet</Typography>
            <Typography color="text.secondary" mb={2}>Our team typically responds within 24 hours</Typography>
            <Button variant="outlined" onClick={() => setCreateOpen(true)}>Create your first ticket</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {tickets.map((t) => (
            <Grid item xs={12} md={6} key={t._id || t.id}>
              <Card sx={{ cursor: 'pointer' }} onClick={() => openDetail(t)}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption" color="text.secondary">
                      #{t.ticket_number || (t._id || '').slice(-6).toUpperCase()}
                    </Typography>
                    <Chip label={t.status || 'open'} size="small" color={statusColor(t.status)} />
                  </Box>
                  <Typography fontWeight={700} gutterBottom>{t.subject}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{t.description}</Typography>
                  <Box display="flex" gap={1} mt={1.5}>
                    <Chip label={t.category || 'General'} size="small" variant="outlined" />
                    <Chip label={t.priority || 'medium'} size="small" color={priorityColor(t.priority)} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Raise a Ticket
          <IconButton onClick={() => setCreateOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField select fullWidth label="Category" margin="normal" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Subject" margin="normal" value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <TextField fullWidth label="Description" margin="normal" multiline rows={4} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Typography variant="subtitle2" mt={2} mb={1}>Priority</Typography>
          <Box display="flex" gap={1}>
            {['normal', 'high'].map((p) => (
              <Button key={p} variant={form.priority === p ? 'contained' : 'outlined'}
                color={p === 'high' ? 'error' : 'primary'} fullWidth
                onClick={() => setForm({ ...form, priority: p })}>
                {p[0].toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Ticket'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        {detail && (
          <>
            <DialogTitle>{detail.subject}</DialogTitle>
            <DialogContent dividers>
              <Box display="flex" gap={1} mb={2}>
                <Chip label={detail.status} color={statusColor(detail.status)} size="small" />
                <Chip label={detail.category} size="small" variant="outlined" />
                <Chip label={detail.priority} size="small" color={priorityColor(detail.priority)} />
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Ticket #{detail.ticket_number || '—'}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Description</Typography>
              <Typography variant="body2" paragraph>{detail.description}</Typography>
              {detail.resolution && (
                <>
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Resolution</Typography>
                    <Typography variant="body2">{detail.resolution}</Typography>
                  </Alert>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetail(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default Support;
