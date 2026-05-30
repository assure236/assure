import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Stack, Button, Alert, CircularProgress, Box, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { toast } from 'react-toastify';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

export default function ChequeStep() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const upload = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('cheque', file);
      const res = await axios.post('/onboarding/cheque', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data?.message || 'Cheque uploaded.');
      navigate('/onboarding/address', { replace: true });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed.');
    } finally { setSubmitting(false); }
  };

  const skip = async () => {
    setSubmitting(true);
    try {
      await axios.post('/onboarding/cheque/skip');
      toast.info('Cheque upload skipped. You can add it later from Documents.');
      navigate('/onboarding/address', { replace: true });
    } catch (e) {
      toast.error('Could not skip. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <OnboardingLayout
      step="cheque"
      title="Cancelled cheque (optional)"
      subtitle="A clear photo of a cancelled cheque from the bank account you added. You can skip this and upload later."
    >
      <Stack spacing={2}>
        <Box sx={{
          border: '2px dashed #94a3b8', borderRadius: 2, p: 3, textAlign: 'center',
          bgcolor: '#f8fafc',
        }}>
          {file ? (
            <Box>
              <img
                src={URL.createObjectURL(file)}
                alt="cheque"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
              />
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>{file.name}</Typography>
            </Box>
          ) : (
            <Box>
              <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.light' }} />
              <Typography sx={{ mt: 1 }}>Tap to choose a clear photo of your cancelled cheque</Typography>
            </Box>
          )}
          <Button component="label" variant="outlined" sx={{ mt: 2 }}>
            {file ? 'Change Photo' : 'Choose Photo'}
            <input hidden type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Button>
        </Box>

        <Alert severity="info">Admin will verify the cheque within 24 hours.</Alert>

        <Stack direction="row" spacing={1.5}>
          <Button variant="text" startIcon={<SkipNextIcon />} onClick={skip} disabled={submitting}>Skip for now</Button>
          <Button variant="contained" onClick={upload} disabled={!file || submitting} sx={{ flex: 1 }}>
            {submitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Upload & Continue'}
          </Button>
        </Stack>
      </Stack>
    </OnboardingLayout>
  );
}
