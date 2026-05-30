import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Stack, Alert, Box, Divider, TextField, Typography, CircularProgress } from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { toast } from 'react-toastify';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

export default function DigiLockerStep() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [panFile, setPanFile] = useState(null);
  const [aadhaarFront, setAadhaarFront] = useState(null);
  const [aadhaarBack, setAadhaarBack] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/onboarding/status');
      setStatus(res.data?.data);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Handle return from DigiLocker
  useEffect(() => {
    const r = params.get('digilocker');
    if (r === 'success') {
      toast.success('DigiLocker connected successfully.');
      const next = new URLSearchParams(params); next.delete('digilocker'); next.delete('message'); setParams(next, { replace: true });
      setTimeout(() => navigate('/onboarding/face', { replace: true }), 600);
    } else if (r === 'error') {
      toast.error(params.get('message') || 'DigiLocker authorization failed. You can use manual upload below.');
      setShowManual(true);
      const next = new URLSearchParams(params); next.delete('digilocker'); next.delete('message'); setParams(next, { replace: true });
    }
  }, [params, navigate, setParams]);

  const handleConnect = async () => {
    try {
      const res = await axios.get('/digilocker/auth-url');
      if (res.data?.success && (res.data.data?.auth_url || res.data.data?.authUrl)) {
        window.location.href = res.data.data.auth_url || res.data.data.authUrl;
      } else {
        toast.error(res.data?.message || 'DigiLocker is unavailable right now.');
        setShowManual(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'DigiLocker is unavailable. Please use manual upload.');
      setShowManual(true);
    }
  };

  const handleManualSubmit = async () => {
    if (!panFile || !aadhaarFront) {
      toast.error('Please attach PAN and Aadhaar front images.');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('pan_number', pan.toUpperCase());
      form.append('aadhaar_number', aadhaar.replace(/\s/g, ''));
      form.append('pan', panFile);
      form.append('aadhaar_front', aadhaarFront);
      if (aadhaarBack) form.append('aadhaar_back', aadhaarBack);
      const res = await axios.post('/onboarding/manual-kyc', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data?.message || 'Submitted. Admin approval in 24h. Continue onboarding.');
      navigate('/onboarding/face', { replace: true });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyDone = status?.steps?.digilocker?.status === 'completed' || status?.steps?.digilocker?.status === 'manual';

  return (
    <OnboardingLayout
      step="digilocker"
      title="Verify your identity"
      subtitle="Connect DigiLocker to instantly verify your PAN and Aadhaar. If you don't have a DigiLocker account, upload them manually."
      loading={loading}
    >
      {!showManual ? (
        <Stack spacing={2}>
          <Button
            variant="contained"
            size="large"
            startIcon={<VerifiedUserIcon />}
            onClick={handleConnect}
            sx={{ py: 1.6, fontSize: 16, bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' } }}
          >
            Connect DigiLocker
          </Button>
          <Divider sx={{ my: 1 }}>or</Divider>
          <Button variant="outlined" size="large" onClick={() => setShowManual(true)} sx={{ py: 1.4 }}>
            I don't have DigiLocker — Upload manually
          </Button>
          {alreadyDone && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Identity step complete. <Button size="small" onClick={() => navigate('/onboarding/face')}>Continue</Button>
            </Alert>
          )}
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Alert severity="info">
            Admin will approve your KYC within 24 hours. You can continue the remaining onboarding meanwhile.
          </Alert>
          <TextField label="PAN Number" placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }} fullWidth />
          <TextField label="Aadhaar Number (12 digits)" value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))} fullWidth />

          <FilePicker label="PAN Card Photo" file={panFile} onChange={setPanFile} />
          <FilePicker label="Aadhaar Front" file={aadhaarFront} onChange={setAadhaarFront} />
          <FilePicker label="Aadhaar Back (optional)" file={aadhaarBack} onChange={setAadhaarBack} />

          <Stack direction="row" spacing={1.5}>
            <Button variant="text" onClick={() => setShowManual(false)} disabled={submitting}>Back</Button>
            <Button variant="contained" onClick={handleManualSubmit} disabled={submitting} sx={{ flex: 1 }}>
              {submitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Submit & Continue'}
            </Button>
          </Stack>
        </Stack>
      )}
    </OnboardingLayout>
  );
}

function FilePicker({ label, file, onChange }) {
  return (
    <Box sx={{ border: '1.5px dashed #cbd5e1', borderRadius: 2, p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
          {file ? 'Change' : 'Choose'}
          <input hidden type="file" accept="image/*,application/pdf" onChange={(e) => onChange(e.target.files?.[0] || null)} />
        </Button>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file ? file.name : 'No file selected'}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
