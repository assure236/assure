import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button, Stack, Alert, Box, Typography, CircularProgress } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { toast } from 'react-toastify';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

export default function FaceStep() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = async () => {
    setError(null);
    setSnapshot(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch (e) {
      setError('Cannot access camera. Please allow camera access and reload.');
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    c.toBlob((blob) => { if (blob) setSnapshot(blob); }, 'image/jpeg', 0.85);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const submit = async () => {
    if (!snapshot) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', snapshot, 'selfie.jpg');
      const res = await axios.post('/onboarding/face-verify', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.success) {
        toast.success(res.data.message || 'Face verified.');
        navigate('/onboarding/bank', { replace: true });
      } else {
        setError(res.data?.message || 'Face did not match. Please retry.');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Face verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      step="face_match"
      title="Take a live selfie"
      subtitle="We compare your live photo against your KYC photo to ensure it's really you."
    >
      <Stack spacing={2} alignItems="center">
        <Box sx={{
          width: 280, height: 280, borderRadius: '50%', overflow: 'hidden',
          border: '4px solid', borderColor: 'primary.light',
          display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000',
        }}>
          {!snapshot ? (
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={URL.createObjectURL(snapshot)} alt="snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Box>

        {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}

        {!snapshot ? (
          <Button variant="contained" size="large" startIcon={<CameraAltIcon />} onClick={capture} disabled={!stream} sx={{ minWidth: 220 }}>
            Capture
          </Button>
        ) : (
          <Stack direction="row" spacing={1.5} sx={{ width: '100%' }}>
            <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={startCamera} disabled={submitting}>
              Retake
            </Button>
            <Button variant="contained" onClick={submit} disabled={submitting} sx={{ flex: 1 }}>
              {submitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Verify & Continue'}
            </Button>
          </Stack>
        )}

        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Look straight at the camera in good lighting. No masks, glasses optional.
        </Typography>
      </Stack>
    </OnboardingLayout>
  );
}
