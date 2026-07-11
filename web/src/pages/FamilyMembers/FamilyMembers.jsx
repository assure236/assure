import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Button, CircularProgress,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Avatar
} from '@mui/material';
import {
  PersonAdd as AddIcon, Delete as DeleteIcon,
  FamilyRestroom as FamilyIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { PageShell, PageHeader, Surface, EmptyState } from '../../components/ui/PageKit';
import { brand } from '../../theme/brand';

const FamilyMembers = () => {
  const navigate = useNavigate();
  const { setActiveMemberId, refreshFamilyMembers } = useActiveMember();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [maskedMobile, setMaskedMobile] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/users/family-members?view=manage');
      if (res.data.success) setMembers(res.data.data || []);
    } catch {
      setError('Could not load family members.');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setMemberId('');
    setPanNumber('');
    setOtp('');
    setOtpRequired(false);
    setMaskedMobile('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const mid = memberId.trim().toUpperCase();
    const pan = panNumber.trim().toUpperCase();
    if (!mid) { toast.error('Member ID is required'); return; }
    if (!otpRequired && !pan) { toast.error('PAN is required'); return; }
    if (otpRequired && otp.trim().length < 4) { toast.error('Enter the OTP sent to family member mobile'); return; }

    setSaving(true);
    try {
      const payload = {
        member_id: mid,
        pan_number: pan,
        ...(otpRequired ? { otp: otp.trim() } : {}),
      };
      const res = await axios.post('/users/family-members', payload);
      if (res.data.success) {
        if (res.data.requires_otp) {
          setOtpRequired(true);
          setMaskedMobile(res.data.data?.masked_mobile || res.data.masked_mobile || '');
          toast.success(res.data.message || 'OTP sent to family member mobile');
        } else {
          toast.success(res.data.message || 'Family member linked');
          setDialogOpen(false);
          fetchMembers();
          refreshFamilyMembers();
        }
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
      toast.error('Member must be approved to switch');
      return;
    }
    setActiveMemberId(id);
    navigate('/dashboard');
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Remove ${m.full_name || 'this member'}?`)) return;
    try {
      const res = await axios.delete(`/users/family-members/${m._id || m.id}`);
      if (res.data.success) {
        toast.success('Removed');
        fetchMembers();
        refreshFamilyMembers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Household"
        title="Family Members"
        subtitle="Link an existing Assure member with Member ID + PAN. OTP goes to their registered mobile."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Link Member</Button>
        }
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {members.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<FamilyIcon sx={{ fontSize: 32 }} />}
            title="No family members linked yet"
            description="Link an existing Assure member to manage their account from your portal."
            actionLabel="Link Member"
            onAction={openAdd}
          />
        </Surface>
      ) : (
        <Surface padded={false}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Member ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m._id || m.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: brand.mist, color: brand.navy }}>{(m.full_name || '?')[0]}</Avatar>
                        {m.full_name}
                      </Box>
                    </TableCell>
                    <TableCell>{m.member_id || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={m.status || 'pending'} color={m.status === 'linked' || m.status === 'approved' ? 'success' : 'warning'} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => handleViewAs(m)} sx={{ mr: 1 }}>View As</Button>
                      <IconButton size="small" color="error" onClick={() => handleDelete(m)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{otpRequired ? 'Verify OTP' : 'Link Family Member'}</DialogTitle>
        <DialogContent>
          {!otpRequired ? (
            <>
              <TextField
                fullWidth label="Member ID" margin="normal"
                value={memberId} onChange={(e) => setMemberId(e.target.value.toUpperCase())}
                placeholder="e.g. VA202600001"
              />
              <TextField
                fullWidth label="PAN" margin="normal"
                value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                helperText="Must match the family member's registered PAN"
              />
            </>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                OTP sent to family member's mobile{maskedMobile ? ` (${maskedMobile})` : ''}.
              </Alert>
              <TextField
                fullWidth label="Enter OTP" margin="normal"
                value={otp} onChange={(e) => setOtp(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Please wait…' : otpRequired ? 'Verify & Link' : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default FamilyMembers;
