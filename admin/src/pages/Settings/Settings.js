import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Grid, TextField,
  Button, CircularProgress, Alert, Divider, Switch, FormControlLabel, Paper, Chip
} from '@mui/material';
import { Save as SaveIcon, Cloud as CloudIcon, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const Settings = () => {
  const [settings, setSettings] = useState({
    company_name: 'Assure ChitFunds',
    company_email: '',
    company_phone: '',
    company_address: '',
    late_fee_percentage: '2',
    kyc_required: true,
    referral_reward_amount: '500',
    default_credit_score: '650',
    maintenance_mode: false,
    allow_registration: true,
    show_credit_score: false,
    sms_notifications: true,
    email_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [erpStatus, setErpStatus] = useState(null); // null | 'testing' | { connected, user } | { error }

  useEffect(() => { fetchSettings(); fetchErpStatus(); }, []);

  const fetchErpStatus = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/erpnext/status`);
      if (res.data.data?.configured) {
        setErpStatus({ configured: true });
      } else {
        setErpStatus({ configured: false });
      }
    } catch { setErpStatus({ configured: false }); }
  };

  const testErpConnection = async () => {
    setErpStatus({ configured: true, testing: true });
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/erpnext/test`);
      if (res.data.success) {
        setErpStatus({ configured: true, connected: true, user: res.data.data.user });
        toast.success(`ERPNext connected as ${res.data.data.user}`);
      }
    } catch (err) {
      setErpStatus({ configured: true, connected: false, error: err.response?.data?.message || 'Connection failed' });
      toast.error('ERPNext connection failed');
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/settings`);
      if (res.data.success) setSettings(prev => ({ ...prev, ...res.data.data }));
    } catch (err) {
      // Settings endpoint may not exist yet — use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/admin/settings`, settings);
      if (res.data.success) toast.success('Settings saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = (field) => (e) => setSettings(s => ({ ...s, [field]: e.target.value }));
  const toggle = (field) => (e) => setSettings(s => ({ ...s, [field]: e.target.checked }));

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Settings</Typography>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave} disabled={saving}>
          Save Settings
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Company Info */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Company Information</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {[
                  { field: 'company_name', label: 'Company Name' },
                  { field: 'company_email', label: 'Support Email', type: 'email' },
                  { field: 'company_phone', label: 'Support Phone' },
                  { field: 'company_address', label: 'Address', rows: 3 },
                ].map(({ field, label, type, rows }) => (
                  <Grid item xs={12} key={field}>
                    <TextField fullWidth label={label} type={type || 'text'}
                      value={settings[field] || ''} onChange={set(field)}
                      multiline={!!rows} rows={rows} size="small" />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Financial Settings</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {[
                  { field: 'late_fee_percentage', label: 'Late Fee (%)', type: 'number', min: 0, max: 100 },
                  { field: 'referral_reward_amount', label: 'Referral Reward (₹)', type: 'number', min: 0 },
                  { field: 'default_credit_score', label: 'Default Credit Score', type: 'number', min: 0, max: 1000 },
                ].map(({ field, label, type, min, max }) => (
                  <Grid item xs={12} key={field}>
                    <TextField fullWidth label={label} type={type}
                      value={settings[field] || ''} onChange={set(field)}
                      inputProps={{ min, max }} size="small" />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Feature Toggles */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Feature Toggles</Typography>
              <Divider sx={{ mb: 2 }} />
              {[
                { field: 'kyc_required', label: 'Require KYC for Chit Group Enrollment' },
                { field: 'allow_registration', label: 'Allow New User Registration' },
                { field: 'show_credit_score', label: 'Show Credit Score on Member Dashboard' },
                { field: 'maintenance_mode', label: 'Maintenance Mode (blocks all member logins)' },
              ].map(({ field, label }) => (
                <Box key={field} display="flex" justifyContent="space-between" alignItems="center" py={1}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2">{label}</Typography>
                  <Switch checked={!!settings[field]} onChange={toggle(field)}
                    color={field === 'maintenance_mode' ? 'error' : 'primary'} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notification Settings</Typography>
              <Divider sx={{ mb: 2 }} />
              {[
                { field: 'sms_notifications', label: 'SMS Notifications to Members' },
                { field: 'email_notifications', label: 'Email Notifications to Members' },
              ].map(({ field, label }) => (
                <Box key={field} display="flex" justifyContent="space-between" alignItems="center" py={1}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2">{label}</Typography>
                  <Switch checked={!!settings[field]} onChange={toggle(field)} />
                </Box>
              ))}
              <Alert severity="info" sx={{ mt: 2, fontSize: 12 }}>
                SMS & Email gateway integration (Twilio/SendGrid) will be added in Phase 5.
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* ERPNext Integration (Optional) */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, border: erpStatus?.connected ? '1px solid #4caf50' : '1px solid #e0e0e0' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <CloudIcon sx={{ fontSize: 32, color: erpStatus?.connected ? '#4caf50' : '#9e9e9e' }} />
                <Box flex={1}>
                  <Typography variant="h6">ERPNext Integration <Chip label="Optional" size="small" variant="outlined" sx={{ ml: 1, fontSize: 11 }} /></Typography>
                  <Typography variant="body2" color="text.secondary">
                    Optionally sync members, payments, and chit groups with an external ERPNext instance. Your built-in accounting system works independently.
                  </Typography>
                </Box>
                {erpStatus?.connected && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main" fontWeight={600}>
                      Connected as {erpStatus.user}
                    </Typography>
                  </Box>
                )}
                {erpStatus?.connected === false && erpStatus?.error && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ErrorIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="error.main" fontWeight={600}>
                      {erpStatus.error}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              {!erpStatus?.configured ? (
                <Alert severity="info" icon={false}>
                  <Typography variant="body2"><strong>Not configured</strong> — This is optional. Your built-in Accounting &amp; Finance module (Accounting page) handles all double-entry bookkeeping, P&amp;L, Balance Sheet, and Cash Flow reports without ERPNext.</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    To enable external ERPNext sync, set <code>ERPNEXT_URL</code>, <code>ERPNEXT_API_KEY</code>, and <code>ERPNEXT_API_SECRET</code> in your backend <code>.env</code> file.
                  </Typography>
                </Alert>
              ) : (
                <Box display="flex" gap={2} alignItems="center">
                  <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">ERPNext URL</Typography>
                    <Typography variant="body2" fontWeight={600}>{process.env.REACT_APP_ERPNEXT_URL || 'Configured in backend .env'}</Typography>
                  </Paper>
                  <Button
                    variant="contained"
                    startIcon={erpStatus?.testing ? <CircularProgress size={16} color="inherit" /> : <CloudIcon />}
                    onClick={testErpConnection}
                    disabled={erpStatus?.testing}
                  >
                    {erpStatus?.testing ? 'Testing...' : 'Test Connection'}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Settings;

