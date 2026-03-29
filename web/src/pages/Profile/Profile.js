import React, { useState } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Avatar,
  Button, Divider, TextField, Alert, CircularProgress, Chip, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress, Tooltip
} from '@mui/material';
import {
  Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon,
  VerifiedUser as KycIcon, TrendingUp as ScoreIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

// Credit score meter
const CreditScoreMeter = ({ score }) => {
  const s = Number(score || 500);
  const bands = [
    { label: 'Poor', min: 0, max: 499, color: '#f44336' },
    { label: 'Fair', min: 500, max: 599, color: '#ff9800' },
    { label: 'Good', min: 600, max: 699, color: '#2196f3' },
    { label: 'Very Good', min: 700, max: 749, color: '#4caf50' },
    { label: 'Excellent', min: 750, max: 900, color: '#1b5e20' },
  ];
  const band = bands.find(b => s >= b.min && s <= b.max) || bands[0];
  const pct = Math.min(100, Math.max(0, ((s - 300) / 600) * 100));
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
          Credit Score
          <Tooltip title="Based on payment discipline, KYC status, and membership tenure">
            <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          </Tooltip>
        </Typography>
        <Chip label={band.label} size="small" sx={{ bgcolor: band.color, color: 'white', fontWeight: 700, fontSize: 10 }} />
      </Box>
      <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
        <Typography variant="h4" fontWeight={800} color={band.color}>{s}</Typography>
        <Typography variant="caption" color="text.secondary">/ 900</Typography>
        <ScoreIcon sx={{ color: band.color }} />
      </Box>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{ height: 10, borderRadius: 5, bgcolor: `${band.color}20`, '& .MuiLinearProgress-bar': { bgcolor: band.color, borderRadius: 5 } }}
      />
      <Box display="flex" justifyContent="space-between" mt={0.5}>
        <Typography variant="caption" color="text.secondary">300</Typography>
        <Typography variant="caption" color="text.secondary">900</Typography>
      </Box>
      <Box sx={{ mt: 1, p: 1.5, bgcolor: `${band.color}10`, borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          <strong>Score Factors:</strong> Payment regularity, KYC verification, membership tenure, and bid discipline.
        </Typography>
      </Box>
    </Box>
  );
};

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    mobile: user?.mobile || '',
    email: user?.email || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || '',
  });
  const [pwDialog, setPwDialog] = useState(false);
  const [pwData, setPwData] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateProfile(formData);
      if (result?.success !== false) {
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user?.full_name || '',
      mobile: user?.mobile || '',
      email: user?.email || '',
      address: user?.address || '',
      city: user?.city || '',
      state: user?.state || '',
      pincode: user?.pincode || '',
    });
    setEditing(false);
  };

  const handleChangePassword = async () => {
    if (pwData.new_password !== pwData.confirm) {
      setPwError("Passwords do not match");
      return;
    }
    if (pwData.new_password.length < 6) {
      setPwError("Password must be at least 6 characters");
      return;
    }
    try {
      const res = await axios.put('/users/change-password', {
        current_password: pwData.current_password,
        new_password: pwData.new_password,
      });
      if (res.data.success) {
        toast.success('Password changed successfully!');
        setPwDialog(false);
        setPwData({ current_password: '', new_password: '', confirm: '' });
        setPwError('');
      }
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password');
    }
  };

  const kycStatus = user?.kyc_status || 'pending';
  const kycColors = { verified: 'success', pending: 'warning', rejected: 'error' };
  const initials = (user?.full_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" gutterBottom>My Profile</Typography>

      <Grid container spacing={3}>
        {/* Left: Avatar + KYC + Credit Score */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, textAlign: 'center' }}>
            <Box sx={{ background: 'linear-gradient(135deg, #1976d2, #1565c0)', pt: 4, pb: 2, borderRadius: '12px 12px 0 0' }}>
              <Avatar sx={{ width: 90, height: 90, fontSize: 32, bgcolor: 'rgba(255,255,255,0.2)', border: '3px solid white', mx: 'auto', mb: 1.5 }}>
                {initials}
              </Avatar>
              <Typography variant="h6" color="white" fontWeight={700}>{user?.full_name}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>{user?.mobile}</Typography>
            </Box>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <KycIcon color={kycStatus === 'verified' ? 'success' : 'disabled'} />
                  <Typography variant="body2">KYC Status</Typography>
                </Box>
                <Chip label={kycStatus} size="small" color={kycColors[kycStatus] || 'default'}
                  sx={{ textTransform: 'capitalize' }} />
              </Box>
              <Divider sx={{ mb: 2 }} />

              {/* Credit Score meter */}
              <CreditScoreMeter score={user?.credit_score} />

              <Divider sx={{ my: 2 }} />

              <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 2, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block">Member ID</Typography>
                <Typography variant="body2" fontWeight={700}>{user?.member_id || '—'}</Typography>
              </Box>
              <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 2, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block">Member Since</Typography>
                <Typography variant="body2" fontWeight={700}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
                </Typography>
              </Box>

              {kycStatus !== 'verified' && (
                <Alert severity="warning" sx={{ mt: 1, fontSize: 12 }}>
                  Complete KYC to unlock all features and improve your credit score.
                </Alert>
              )}
              <Button fullWidth variant="outlined" sx={{ mt: 2, borderRadius: 2 }} onClick={() => setPwDialog(true)}>
                Change Password
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Personal Info */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Personal Information</Typography>
                {!editing
                  ? <Button startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>
                  : <Box display="flex" gap={1}>
                    <Button startIcon={<CancelIcon />} onClick={handleCancel}>Cancel</Button>
                    <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      onClick={handleSave} disabled={saving}>Save</Button>
                  </Box>
                }
              </Box>
              <Divider sx={{ mb: 3 }} />
              <Grid container spacing={2}>
                {[
                  { field: 'full_name', label: 'Full Name', xs: 12, sm: 6 },
                  { field: 'mobile', label: 'Mobile Number', xs: 12, sm: 6, disabled: true },
                  { field: 'email', label: 'Email', xs: 12, sm: 6 },
                  { field: 'address', label: 'Address', xs: 12 },
                  { field: 'city', label: 'City', xs: 12, sm: 4 },
                  { field: 'state', label: 'State', xs: 12, sm: 4 },
                  { field: 'pincode', label: 'Pincode', xs: 12, sm: 4 },
                ].map(({ field, label, xs, sm, disabled }) => (
                  <Grid item xs={xs} sm={sm} key={field}>
                    {editing
                      ? <TextField fullWidth label={label} size="small"
                        value={formData[field]} disabled={!!disabled}
                        onChange={e => !disabled && setFormData({ ...formData, [field]: e.target.value })} />
                      : <Box>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body1" fontWeight={500}>{user?.[field] || '—'}</Typography>
                        <Divider sx={{ mt: 0.5 }} />
                      </Box>
                    }
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Change Password Dialog */}
      <Dialog open={pwDialog} onClose={() => { setPwDialog(false); setPwError(''); }} maxWidth="xs" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
          {['current_password', 'new_password', 'confirm'].map((field) => (
            <TextField
              key={field} fullWidth label={
                field === 'current_password' ? 'Current Password'
                : field === 'new_password' ? 'New Password' : 'Confirm New Password'
              }
              type="password" size="small" sx={{ mb: 2 }}
              value={pwData[field]} onChange={e => { setPwError(''); setPwData({ ...pwData, [field]: e.target.value }); }}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPwDialog(false); setPwError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleChangePassword}>Change</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Profile;
