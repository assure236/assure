import React, { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Button, Card, CardContent, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Grid, LinearProgress, IconButton, Checkbox, FormControlLabel, FormGroup, Chip
} from '@mui/material';
import {
  Add as AddIcon, Flag as FlagIcon, Close as CloseIcon,
  Edit as EditIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useActiveMember } from '../../context/ActiveMemberContext';

const CATEGORIES = ['Savings', 'Home', 'Education', 'Marriage', 'Business', 'Vehicle', 'Emergency', 'Other'];

const Goals = () => {
  const { refreshKey } = useActiveMember();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);
  const [chits, setChits] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    category: 'Savings',
    linked_chit_group_ids: [],
  });

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/users/goals');
      if (res.data.success) setGoals(res.data.data || []);
    } catch {
      toast.error('Could not load goals');
    } finally {
      setLoading(false);
    }
  };

  const fetchChits = async () => {
    try {
      const res = await axios.get('/chit-groups/my-groups');
      if (res.data.success) {
        const rows = res.data.data || [];
        setChits(rows.map((row) => {
          const g = row.chit_group_id && typeof row.chit_group_id === 'object' ? row.chit_group_id : row;
          return {
            id: String(g._id || g.id || row.chit_group_id || ''),
            name: g.group_name || 'Chit Group',
            invested: Number(row.total_paid || row.invested || 0),
          };
        }).filter((c) => c.id));
      }
    } catch { /* optional */ }
  };

  useEffect(() => {
    fetchGoals();
    fetchChits();
  }, [refreshKey]);

  const openCreate = () => {
    setEditGoal(null);
    setForm({ name: '', target_amount: '', category: 'Savings', linked_chit_group_ids: [] });
    setDialogOpen(true);
  };

  const openEdit = (g) => {
    setEditGoal(g);
    setForm({
      name: g.name || '',
      target_amount: String(g.target_amount || ''),
      category: g.category || 'Savings',
      linked_chit_group_ids: (g.linked_chit_group_ids || []).map(String),
    });
    setDialogOpen(true);
  };

  const toggleChit = (id) => {
    setForm((prev) => {
      const set = new Set(prev.linked_chit_group_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, linked_chit_group_ids: [...set] };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.target_amount) {
      toast.error('Goal name and target amount are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        target_amount: Number(form.target_amount),
        category: form.category,
        linked_chit_group_ids: form.linked_chit_group_ids,
      };
      const res = editGoal
        ? await axios.put(`/users/goals/${editGoal._id || editGoal.id}`, payload)
        : await axios.post('/users/goals', payload);
      if (res.data.success) {
        toast.success(editGoal ? 'Goal updated' : 'Goal created');
        setDialogOpen(false);
        fetchGoals();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g) => {
    if (!window.confirm(`Delete goal “${g.name}”?`)) return;
    try {
      await axios.delete(`/users/goals/${g._id || g.id}`);
      toast.success('Goal deleted');
      fetchGoals();
    } catch {
      toast.error('Failed to delete goal');
    }
  };

  return (
    <Container maxWidth="lg">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Set a Goal</Typography>
          <Typography variant="body2" color="text.secondary">
            Track savings goals and link your chit schemes
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Set a Goal
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <FlagIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No goals set yet</Typography>
            <Button variant="outlined" sx={{ mt: 2 }} onClick={openCreate}>Create a goal</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {goals.map((g) => {
            const target = Number(g.target_amount || 0);
            const current = Number(g.current_amount || g.invested_amount || 0);
            const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            const investedFromChits = Number(g.invested_amount || g.linked_invested || 0);
            return (
              <Grid item xs={12} md={6} key={g._id || g.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography fontWeight={700}>{g.name}</Typography>
                      <Box>
                        <IconButton size="small" onClick={() => openEdit(g)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(g)}><DeleteIcon fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">{g.category}</Typography>
                    <Typography variant="body2" color="text.secondary" mb={1} mt={1}>
                      ₹{current.toLocaleString('en-IN')} / ₹{target.toLocaleString('en-IN')}
                    </Typography>
                    {investedFromChits > 0 ? (
                      <Chip size="small" label={`Invested (linked chits): ₹${investedFromChits.toLocaleString('en-IN')}`} sx={{ mb: 1 }} />
                    ) : null}
                    <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
                    <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}% complete</Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editGoal ? 'Modify Goal' : 'Set a Goal'}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField select fullWidth label="Category" margin="normal" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Goal Name" margin="normal" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth label="Target Amount (₹)" type="number" margin="normal"
            value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Link Chit Schemes</Typography>
          {chits.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No active chits to link yet.</Typography>
          ) : (
            <FormGroup>
              {chits.map((c) => (
                <FormControlLabel
                  key={c.id}
                  control={
                    <Checkbox
                      checked={form.linked_chit_group_ids.includes(c.id)}
                      onChange={() => toggleChit(c.id)}
                    />
                  }
                  label={`${c.name} — Invested: ₹${Number(c.invested || 0).toLocaleString('en-IN')}`}
                />
              ))}
            </FormGroup>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editGoal ? 'Save Changes' : 'Create Goal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Goals;
