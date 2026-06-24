import React, { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Button, Card, CardContent, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Grid, LinearProgress, IconButton
} from '@mui/material';
import { Add as AddIcon, Flag as FlagIcon, Close as CloseIcon } from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useActiveMember } from '../../context/ActiveMemberContext';

const CATEGORIES = ['Savings', 'Home', 'Education', 'Marriage', 'Business', 'Vehicle', 'Emergency', 'Other'];

const Goals = () => {
  const { refreshKey } = useActiveMember();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', target_amount: '', category: 'Savings' });

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

  useEffect(() => { fetchGoals(); }, [refreshKey]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.target_amount) {
      toast.error('Goal name and target amount are required');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post('/users/goals', {
        name: form.name.trim(),
        target_amount: Number(form.target_amount),
        category: form.category,
      });
      if (res.data.success) {
        toast.success('Goal created');
        setCreateOpen(false);
        setForm({ name: '', target_amount: '', category: 'Savings' });
        fetchGoals();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

  const updateProgress = async (goal, amount) => {
    try {
      const res = await axios.put(`/users/goals/${goal._id || goal.id}`, {
        current_amount: Number(amount),
      });
      if (res.data.success) {
        toast.success('Progress updated');
        fetchGoals();
      }
    } catch {
      toast.error('Failed to update progress');
    }
  };

  return (
    <Container maxWidth="lg">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Savings Goals</Typography>
          <Typography variant="body2" color="text.secondary">
            Set and track financial goals for your chit journey
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Set Goal
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <FlagIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No goals set yet</Typography>
            <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setCreateOpen(true)}>Create a goal</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {goals.map((g) => {
            const target = Number(g.target_amount || 0);
            const current = Number(g.current_amount || 0);
            const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            return (
              <Grid item xs={12} md={6} key={g._id || g.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography fontWeight={700}>{g.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{g.category}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      ₹{current.toLocaleString('en-IN')} / ₹{target.toLocaleString('en-IN')}
                    </Typography>
                    <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
                    <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}% complete</Typography>
                    <Box mt={2}>
                      <Button size="small" variant="outlined"
                        onClick={() => {
                          const val = window.prompt('Enter current saved amount (₹):', String(current));
                          if (val != null && val !== '') updateProgress(g, val);
                        }}>
                        Update Progress
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Set a Goal
          <IconButton onClick={() => setCreateOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Saving...' : 'Create Goal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Goals;
