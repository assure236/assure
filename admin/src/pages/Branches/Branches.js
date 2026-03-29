import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, IconButton, Tooltip,
  Grid, Card, CardContent, Divider, Switch, FormControlLabel
} from '@mui/material';
import { Add, Edit, Delete, Business, LocationOn, Phone, Email } from '@mui/icons-material';
import axios from 'axios';

const defaultForm = { name: '', city: '', state: '', manager: '', phone: '', email: '', address: '' };

export default function Branches() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState({ open: false, mode: 'add', branch: null });
  const [form, setForm] = useState(defaultForm);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, branch: null });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/branches`);
      setRows(res.data.data || []);
    } catch (e) {
      setError('Failed to load branches');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setForm(defaultForm); setDialog({ open: true, mode: 'add', branch: null }); };
  const openEdit = (b) => { setForm({ name: b.name, city: b.city, state: b.state, manager: b.manager, phone: b.phone || '', email: b.email || '', address: b.address || '' }); setDialog({ open: true, mode: 'edit', branch: b }); };

  const handleSave = async () => {
    if (!form.name || !form.city) { setError('Branch name and city are required'); return; }
    try {
      setSaving(true);
      if (dialog.mode === 'add') {
        await axios.post(`${process.env.REACT_APP_API_URL}/admin/branches`, form);
        setSuccess('Branch created successfully');
      } else {
        await axios.put(`${process.env.REACT_APP_API_URL}/admin/branches/${dialog.branch.id}`, form);
        setSuccess('Branch updated successfully');
      }
      setDialog({ open: false, mode: 'add', branch: null });
      fetchData();
    } catch (e) { setError('Failed to save branch'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/admin/branches/${deleteDialog.branch.id}`);
      setSuccess('Branch deleted');
      setDeleteDialog({ open: false, branch: null });
      fetchData();
    } catch (e) { setError('Failed to delete branch'); }
  };

  const toggleActive = async (branch) => {
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/branches/${branch.id}`, { is_active: !branch.is_active });
      fetchData();
    } catch (e) { setError('Failed to update branch status'); }
  };

  const activeCount = rows.filter(r => r.is_active).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Branch Management</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={openAdd}>Add Branch</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Branches', value: rows.length, color: '#1976d2', icon: <Business /> },
          { label: 'Active Branches', value: activeCount, color: '#388e3c', icon: <LocationOn /> },
          { label: 'Inactive', value: rows.length - activeCount, color: '#f57c00', icon: <Business /> },
        ].map((c, i) => (
          <Grid item xs={4} key={i}>
            <Card sx={{ borderLeft: `4px solid ${c.color}` }}>
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

      {/* Branch Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Grid container spacing={2}>
          {rows.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ py: 8, textAlign: 'center' }}>
                <Business sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">No branches configured. Add your first branch.</Typography>
                <Button startIcon={<Add />} variant="contained" sx={{ mt: 2 }} onClick={openAdd}>Add Branch</Button>
              </Paper>
            </Grid>
          ) : rows.map(branch => (
            <Grid item xs={12} sm={6} md={4} key={branch.id}>
              <Card sx={{ border: `1px solid`, borderColor: branch.is_active ? 'primary.light' : 'grey.300', opacity: branch.is_active ? 1 : 0.75 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>{branch.name}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">{branch.city}, {branch.state}</Typography>
                      </Box>
                    </Box>
                    <Chip label={branch.is_active ? 'Active' : 'Inactive'} size="small" color={branch.is_active ? 'success' : 'default'} />
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {branch.manager && (
                      <Typography variant="body2"><strong>Manager:</strong> {branch.manager}</Typography>
                    )}
                    {branch.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">{branch.phone}</Typography>
                      </Box>
                    )}
                    {branch.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Email sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">{branch.email}</Typography>
                      </Box>
                    )}
                    {branch.address && (
                      <Typography variant="caption" color="text.secondary">{branch.address}</Typography>
                    )}
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <FormControlLabel
                      control={<Switch checked={!!branch.is_active} size="small" onChange={() => toggleActive(branch)} />}
                      label={<Typography variant="caption">{branch.is_active ? 'Active' : 'Inactive'}</Typography>}
                    />
                    <Box>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(branch)}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, branch })}><Delete fontSize="small" /></IconButton></Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, mode: 'add', branch: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.mode === 'add' ? 'Add New Branch' : 'Edit Branch'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Branch Name *" fullWidth size="small" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="City *" fullWidth size="small" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="State" fullWidth size="small" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Branch Manager" fullWidth size="small" value={form.manager} onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Phone" fullWidth size="small" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Email" type="email" fullWidth size="small" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Address" multiline rows={2} fullWidth size="small" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, mode: 'add', branch: null })}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : dialog.mode === 'add' ? 'Create Branch' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, branch: null })}>
        <DialogTitle>Delete Branch</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteDialog.branch?.name}</strong>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, branch: null })}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
