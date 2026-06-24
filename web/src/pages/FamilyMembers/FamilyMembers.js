import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Button, CircularProgress,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControlLabel, Switch, Avatar, Paper
} from '@mui/material';
import {
  PersonAdd as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  FamilyRestroom as FamilyIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useActiveMember } from '../../context/ActiveMemberContext';

const RELATIONSHIPS = ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'other'];

const emptyForm = {
  full_name: '', relationship: 'spouse', mobile: '', email: '',
  date_of_birth: '', gender: '', aadhaar_number: '', pan_number: '', is_nominee: false
};

const FamilyMembers = () => {
  const navigate = useNavigate();
  const { setActiveMemberId } = useActiveMember();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/users/family-members');
      if (res.data.success) setMembers(res.data.data || []);
    } catch {
      setError('Could not load family members.');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (m) => {
    setEditId(m._id || m.id);
    setForm({
      full_name: m.full_name || '',
      relationship: m.relationship || 'spouse',
      mobile: m.mobile || '',
      email: m.email || '',
      date_of_birth: m.date_of_birth || '',
      gender: m.gender || '',
      aadhaar_number: m.aadhaar_number || '',
      pan_number: m.pan_number || '',
      is_nominee: m.is_nominee || false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, pan_number: form.pan_number.toUpperCase() };
      let res;
      if (editId) {
        res = await axios.put(`/users/family-members/${editId}`, payload);
      } else {
        res = await axios.post('/users/family-members', payload);
      }
      if (res.data.success) {
        toast.success(editId ? 'Member updated' : 'Member added');
        setDialogOpen(false);
        fetchMembers();
      } else {
        toast.error(res.data.message || 'Operation failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleViewAs = (m) => {
    const id = (m.member_id || '').toString().trim().toUpperCase();
    if (!id || !['approved', 'linked'].includes(m.status)) {
      toast.info('Member must be approved/linked before you can view their account');
      return;
    }
    setActiveMemberId(id);
    toast.success(`Now viewing ${m.full_name || id}`);
    navigate('/dashboard');
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Remove ${m.full_name} from your family list?`)) return;
    try {
      const res = await axios.delete(`/users/family-members/${m._id || m.id}`);
      if (res.data.success) {
        toast.success('Family member removed');
        fetchMembers();
      }
    } catch {
      toast.error('Failed to remove member');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (error) return <Container sx={{ py: 4 }}><Alert severity="error">{error}</Alert></Container>;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>Family Members</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add Member
        </Button>
      </Box>

      {members.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, borderRadius: 3 }}>
          <FamilyIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No family members added yet</Typography>
          <Typography color="text.secondary" mb={2}>Link your family members for easy chit management</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Your First Member</Button>
        </Paper>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['Name', 'Relationship', 'Mobile', 'Email', 'Nominee', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map(m => (
                  <TableRow key={m._id || m.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light', fontSize: 14 }}>
                          {(m.full_name || '?')[0].toUpperCase()}
                        </Avatar>
                        <Typography fontWeight={600}>{m.full_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{m.relationship}</TableCell>
                    <TableCell>{m.mobile || '—'}</TableCell>
                    <TableCell>{m.email || '—'}</TableCell>
                    <TableCell>
                      {m.is_nominee ? <Chip label="Nominee" size="small" color="success" /> : '—'}
                    </TableCell>
                    <TableCell>
                      {['approved', 'linked'].includes(m.status) && m.member_id && (
                        <Button size="small" variant="outlined" sx={{ mr: 1 }} onClick={() => handleViewAs(m)}>
                          View
                        </Button>
                      )}
                      <IconButton size="small" color="primary" onClick={() => openEdit(m)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(m)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Family Member' : 'Add Family Member'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField label="Full Name *" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} fullWidth />
            <TextField label="Relationship *" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} select fullWidth>
              {RELATIONSHIPS.map(r => <MenuItem key={r} value={r} sx={{ textTransform: 'capitalize' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</MenuItem>)}
            </TextField>
            <TextField label="Mobile" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} fullWidth />
            <TextField label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth />
            <TextField label="Date of Birth" placeholder="DD/MM/YYYY" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} fullWidth />
            <TextField label="Gender" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} select fullWidth>
              <MenuItem value="">Select</MenuItem>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField label="Aadhaar Number" value={form.aadhaar_number} onChange={e => setForm({ ...form, aadhaar_number: e.target.value })} fullWidth />
            <TextField label="PAN Number" value={form.pan_number} onChange={e => setForm({ ...form, pan_number: e.target.value })} fullWidth inputProps={{ style: { textTransform: 'uppercase' } }} />
            <FormControlLabel
              control={<Switch checked={form.is_nominee} onChange={e => setForm({ ...form, is_nominee: e.target.checked })} color="primary" />}
              label="Mark as Nominee"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editId ? 'Update' : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FamilyMembers;
