import React, { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Button, Chip, CircularProgress,
  Grid, Alert
} from '@mui/material';
import {
  VerifiedUser as VerifiedIcon, AccountBalance as BankIcon,
  Description as DocIcon, Fingerprint as FaceIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useActiveMember } from '../../context/ActiveMemberContext';

const statusChip = (status) => {
  const s = (status || 'not_started').toLowerCase();
  if (s === 'verified') return { label: 'Verified', color: 'success' };
  if (s === 'pending') return { label: 'Pending Review', color: 'warning' };
  if (s === 'rejected') return { label: 'Rejected', color: 'error' };
  return { label: 'Not Started', color: 'default' };
};

const KYC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [kycData, setKycData] = useState(null);
  const { refreshKey } = useActiveMember();

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/kyc/status');
      if (res.data.success) setKycData(res.data.data);
    } catch {
      toast.error('Could not load KYC status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const dl = searchParams.get('digilocker');
    if (dl === 'success') toast.success('DigiLocker connected successfully');
    if (dl === 'error') toast.error('DigiLocker verification failed');
  }, [searchParams, refreshKey]);

  const openDigilocker = async () => {
    try {
      const res = await axios.get('/kyc/digilocker/init?platform=web');
      if (res.data.success) {
        const url = res.data.data?.auth_url || res.data.auth_url;
        if (url) window.location.href = url;
        else toast.error('DigiLocker URL not received');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'DigiLocker init failed');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
    );
  }

  const kycStatus = kycData?.kyc_status || 'not_started';
  const chip = statusChip(kycStatus);
  const panDone = !!(kycData?.pan_number || kycData?.pan_verified);
  const aadhaarDone = !!(kycData?.aadhaar_number || kycData?.aadhaar_verified);
  const digilockerDone = !!kycData?.digilocker_id;

  return (
    <Container maxWidth="md">
      <Typography variant="h4" fontWeight={700} gutterBottom>KYC Verification</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Complete identity verification to unlock payouts and disbursements
      </Typography>

      <Alert severity={chip.color === 'success' ? 'success' : 'info'} sx={{ mb: 3 }}>
        Status: <Chip label={chip.label} color={chip.color} size="small" sx={{ ml: 1 }} />
      </Alert>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={4}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <VerifiedIcon color={panDone ? 'success' : 'disabled'} />
            <Typography variant="caption" display="block" mt={1}>PAN</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={4}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <FaceIcon color={aadhaarDone ? 'success' : 'disabled'} />
            <Typography variant="caption" display="block" mt={1}>Aadhaar</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={4}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <BankIcon color={digilockerDone ? 'success' : 'disabled'} />
            <Typography variant="caption" display="block" mt={1}>DigiLocker</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <VerifiedIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography fontWeight={700} gutterBottom>DigiLocker</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Link Aadhaar and PAN via government DigiLocker
              </Typography>
              <Button variant="contained" fullWidth onClick={openDigilocker}>
                Connect DigiLocker
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <DocIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography fontWeight={700} gutterBottom>Onboarding KYC</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Complete PAN, Aadhaar OTP, face match and bank steps
              </Typography>
              <Button variant="outlined" fullWidth onClick={() => navigate('/onboarding/digilocker')}>
                Open Onboarding
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <DocIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography fontWeight={700} gutterBottom>Manual Upload</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Upload PAN, Aadhaar and supporting documents
              </Typography>
              <Button variant="outlined" fullWidth onClick={() => navigate('/documents')}>
                Go to Documents
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default KYC;
