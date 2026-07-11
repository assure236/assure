import React, { useEffect, useState } from 'react';
import {
  Box, TextField, Button, MenuItem,
  CircularProgress, Alert, FormControlLabel, Checkbox
} from '@mui/material';
import { Cancel as CancelIcon } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { PageShell, PageHeader, Surface, EmptyState } from '../../components/ui/PageKit';

const CancelChit = () => {
  const navigate = useNavigate();
  const { refreshKey } = useActiveMember();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState({ chit_group_id: '', reason: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/users/my-chit-groups');
        if (res.data.success) {
          const active = (res.data.data || []).filter((g) =>
            ['active', 'running', 'open'].includes((g.status || g.chit_group?.status || '').toLowerCase())
          );
          setGroups(active);
        }
      } catch {
        toast.error('Could not load your chit groups');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.chit_group_id || !form.reason.trim()) {
      toast.error('Please fill all fields');
      return;
    }
    if (!confirmed) {
      toast.error('Please confirm you understand the cancellation terms');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/chit-groups/cancel-request', {
        chit_group_id: form.chit_group_id,
        reason: form.reason.trim(),
      });
      if (res.data.success) {
        toast.success('Cancellation request submitted');
        navigate('/chit-groups');
      } else {
        toast.error(res.data.message || 'Failed to submit');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  }

  return (
    <PageShell maxWidth={560}>
      <PageHeader
        eyebrow="Membership"
        title="Cancel Chit"
        subtitle="Request cancellation of your chit group membership"
      />

      <Alert severity="warning" sx={{ mb: 2 }}>
        Cancellation may forfeit dividends and is subject to admin approval and group terms.
      </Alert>

      {groups.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<CancelIcon />}
            title="No active chit groups"
            description="You have no active chit groups eligible for cancellation."
            actionLabel="View Chit Groups"
            onAction={() => navigate('/chit-groups')}
          />
        </Surface>
      ) : (
        <Surface>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField select fullWidth label="Select Chit Group" margin="normal" required
              value={form.chit_group_id}
              onChange={(e) => setForm({ ...form, chit_group_id: e.target.value })}>
              {groups.map((g) => {
                const id = g.chit_group_id?._id || g.chit_group_id || g._id || g.id;
                const name = g.chit_group?.group_name || g.group_name || 'Chit Group';
                return <MenuItem key={id} value={id}>{name}</MenuItem>;
              })}
            </TextField>
            <TextField fullWidth label="Reason for cancellation" margin="normal" multiline rows={3} required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <FormControlLabel
              control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
              label="I understand that cancellation may have financial implications and is subject to approval"
            />
            <Box mt={2} display="flex" gap={1}>
              <Button variant="outlined" onClick={() => navigate(-1)}>Back</Button>
              <Button type="submit" variant="contained" color="error" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Cancellation Request'}
              </Button>
            </Box>
          </Box>
        </Surface>
      )}
    </PageShell>
  );
};

export default CancelChit;
