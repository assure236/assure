import React, { useState } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Grid, TextField,
  Button, CircularProgress, Alert, MenuItem, Divider
} from '@mui/material';
import { ArrowBack as BackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const AUCTION_DAYS = Array.from({ length: 31 }, (_, i) => i + 1); // 1-31 day of month

const CreateChitGroup = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    group_name: '',
    pso_number: '',
    chit_value: '',
    duration_months: '',
    monthly_installment: '',
    total_members: '',
    auction_day: '1',
    commencement_date: '',
    description: '',
  });

  const handleChange = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => {
      const updated = { ...prev, [field]: val };

      // In a chit fund: total_members always equals duration_months
      if (field === 'duration_months' && updated.duration_months) {
        const dm = Number(updated.duration_months);
        updated.total_members = String(dm);
      }

      // Recalculate monthly_installment whenever chit_value or total_members changes
      const cv = Number(updated.chit_value);
      const tm = Number(updated.total_members);
      if (cv > 0 && tm > 0) {
        updated.monthly_installment = Math.round(cv / tm).toString();
      }

      return updated;
    });
  };

  const validate = () => {
    if (!form.group_name.trim()) return 'Group name is required';
    if (!form.chit_value || Number(form.chit_value) <= 0) return 'Valid chit value is required';
    if (!form.duration_months || Number(form.duration_months) < 2) return 'Duration must be at least 2 months';
    const members = Number(form.total_members);
    if (!form.total_members || members < 10 || members > 100) return 'Total members must be between 10 and 100';
    if (!form.commencement_date) return 'Start date is required';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/admin/chit-groups`, {
        group_name: form.group_name,
        chit_value: Number(form.chit_value),
        duration_months: Number(form.duration_months),
        monthly_installment: Number(form.monthly_installment),
        total_members: Number(form.total_members),
        auction_day: Number(form.auction_day),
        commencement_date: form.commencement_date,
        pso_number: form.pso_number,
        description: form.description,
        status: 'not_started',
      });
      if (res.data.success) {
        toast.success('Chit group created successfully!');
        navigate('/chit-groups');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create chit group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/chit-groups')} sx={{ mb: 2 }}>
        Back to Chit Groups
      </Button>
      <Typography variant="h4" gutterBottom>Create Chit Group</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Typography variant="h6" gutterBottom>Group Information</Typography>
            <Divider sx={{ mb: 3 }} />
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Group Name *" value={form.group_name}
                  onChange={handleChange('group_name')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="PSO Number" value={form.pso_number}
                  onChange={handleChange('pso_number')}
                  helperText="Prior Sanction Order number" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Chit Value (₹) *" type="number" value={form.chit_value}
                  onChange={handleChange('chit_value')} inputProps={{ min: 1000 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Duration (Months) *" type="number" value={form.duration_months}
                  onChange={handleChange('duration_months')} inputProps={{ min: 2, max: 60 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Monthly Installment (₹)" type="number"
                  value={form.monthly_installment} onChange={handleChange('monthly_installment')}
                  helperText="Auto-calculated from Chit Value / Duration" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Total Members" type="number" value={form.total_members}
                  InputProps={{ readOnly: true }}
                  helperText="Auto-set from Duration (Members = Months)" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Auction Day of Month *" value={form.auction_day}
                  onChange={handleChange('auction_day')}
                  helperText="Day of month on which the auction is held">
                  {AUCTION_DAYS.map(d => <MenuItem key={d} value={String(d)}>{d}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Start Date *" type="date" value={form.commencement_date}
                  onChange={handleChange('commencement_date')}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: new Date().toISOString().split('T')[0] }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description (optional)" multiline rows={3}
                  value={form.description} onChange={handleChange('description')}
                  inputProps={{ maxLength: 500 }} />
              </Grid>
            </Grid>

            <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
              <Button onClick={() => navigate('/chit-groups')}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={saving}
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}>
                {saving ? 'Creating…' : 'Create Group'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default CreateChitGroup;

