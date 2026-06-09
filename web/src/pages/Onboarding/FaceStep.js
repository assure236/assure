import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Button, Stack, Alert, Box, Typography, CircularProgress,
  LinearProgress, Chip,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import LightModeIcon from '@mui/icons-material/LightMode';
import { toast } from 'react-toastify';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

// ─── How the Cashfree Face Liveness flow works ────────────────────────────────
// 1. We open the user's camera (browser MediaDevices API).
// 2. User positions their face in the oval frame and clicks "Capture".
// 3. We POST the JPEG selfie to POST /onboarding/face-verify (multipart).
// 4. Backend sends it to Cashfree VRS /verification/face-liveness
//    using CASHFREE_VRS_CLIENT_ID + CASHFREE_VRS_CLIENT_SECRET.
// 5. Cashfree returns liveness=true/false + liveness_score.
// 6. On success → backend marks face_match step "verified" and we navigate next.
// ─────────────────────────────────────────────────────────────────────────────

export default function FaceStep() {
  const navigate   = useNavigate();
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);

  const [phase, setPhase]         = useState('idle');   // idle | camera | captured | submitting | done | error
  const [snapshot, setSnapshot]   = useState(null);     // Blob
  const [snapshotUrl, setSnapshotUrl] = useState(null); // objectURL for preview
  const [error, setError]         = useState(null);
  const [attempts, setAttempts]   = useState(0);
  const [livenessScore, setLivenessScore] = useState(null);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError(null);
    setSnapshot(null);
    if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); setSnapshotUrl(null); }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('camera');
    } catch (e) {
      setError('Cannot access camera. Please allow camera access in your browser and try again.');
      setPhase('error');
    }
  }, [snapshotUrl]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Capture frame ─────────────────────────────────────────────────────────
  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    c.width  = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const sx  = (v.videoWidth  - size) / 2;
    const sy  = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);

    c.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      const url = URL.createObjectURL(blob);
      setSnapshot(blob);
      setSnapshotUrl(url);
      setPhase('captured');
    }, 'image/jpeg', 0.90);
  };

  // ── Submit to Cashfree via backend ────────────────────────────────────────
  const submit = async () => {
    if (!snapshot) return;
    setPhase('submitting');
    setError(null);
    setAttempts((a) => a + 1);

    try {
      const form = new FormData();
      form.append('photo', snapshot, 'selfie.jpg');

      const res = await axios.post('/onboarding/face-verify', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      if (res.data?.success) {
        const score = res.data?.liveness_score;
        setLivenessScore(score);
        setPhase('done');
        toast.success('Face verified by Cashfree ✅');
        setTimeout(() => navigate('/onboarding/bank', { replace: true }), 1200);
      } else {
        setError(res.data?.message || 'Face liveness check failed. Please try again in good lighting.');
        setPhase('error');
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Face verification failed. Check your connection and try again.';
      setError(msg);
      setPhase('error');
    }
  };

  // ── Retry ─────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    stopCamera();
    setPhase('idle');
    setError(null);
    setSnapshot(null);
    if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); setSnapshotUrl(null); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <OnboardingLayout
      step="face_match"
      title="Selfie verification"
      subtitle="Cashfree's AI checks that you're a real person — not a photo or screen. Takes just a few seconds."
    >
      <Stack spacing={2.5} alignItems="center">

        {/* Camera / Preview circle */}
        <Box sx={{
          width: 280, height: 280,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid',
          borderColor: phase === 'done'  ? 'success.main'
                     : phase === 'error' ? 'error.main'
                     :                    'primary.light',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: '#000',
          position: 'relative',
          transition: 'border-color 0.3s',
        }}>
          {/* Live camera */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: phase === 'camera' ? 'block' : 'none',
            }}
          />

          {/* Snapshot preview */}
          {snapshotUrl && (phase === 'captured' || phase === 'submitting') && (
            <img
              src={snapshotUrl}
              alt="selfie"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {/* Idle placeholder */}
          {phase === 'idle' && (
            <FaceRetouchingNaturalIcon sx={{ fontSize: 80, color: '#475569', opacity: 0.5 }} />
          )}

          {/* Done overlay */}
          {phase === 'done' && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(22,163,74,0.7)', borderRadius: '50%',
            }}>
              <CheckCircleIcon sx={{ fontSize: 80, color: '#fff' }} />
            </Box>
          )}

          {/* Submitting overlay */}
          {phase === 'submitting' && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.55)', borderRadius: '50%',
            }}>
              <CircularProgress size={50} sx={{ color: '#D4AF37' }} />
            </Box>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Box>

        {/* Tips */}
        {(phase === 'idle' || phase === 'camera') && (
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
            {[
              { icon: <LightModeIcon sx={{ fontSize: 14 }} />, text: 'Good lighting' },
              { icon: <FaceRetouchingNaturalIcon sx={{ fontSize: 14 }} />, text: 'Face centered' },
              { icon: <CameraAltIcon sx={{ fontSize: 14 }} />, text: 'No glasses/mask' },
            ].map((tip) => (
              <Chip
                key={tip.text}
                icon={tip.icon}
                label={tip.text}
                size="small"
                variant="outlined"
                sx={{ fontSize: 11 }}
              />
            ))}
          </Stack>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
            {error}
            {attempts >= 2 && (
              <Typography variant="caption" display="block" mt={0.5}>
                Tip: Move to a brighter area and look directly at the camera.
              </Typography>
            )}
          </Alert>
        )}

        {/* Submitting progress */}
        {phase === 'submitting' && (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5} textAlign="center">
              Cashfree is analysing your selfie…
            </Typography>
            <LinearProgress sx={{ borderRadius: 4, height: 6 }} />
          </Box>
        )}

        {/* Done */}
        {phase === 'done' && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ width: '100%', borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={700}>Face liveness confirmed!</Typography>
            {livenessScore !== null && (
              <Typography variant="caption">Confidence score: {Math.round(livenessScore * 100)}%</Typography>
            )}
          </Alert>
        )}

        {/* Action buttons */}
        <Box sx={{ width: '100%' }}>
          {phase === 'idle' && (
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<CameraAltIcon />}
              onClick={startCamera}
              sx={{
                py: 1.8, fontSize: 16, fontWeight: 700,
                bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' },
                borderRadius: 2,
              }}
            >
              Open Camera
            </Button>
          )}

          {phase === 'camera' && (
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<CameraAltIcon />}
              onClick={capture}
              sx={{
                py: 1.8, fontSize: 16, fontWeight: 700,
                bgcolor: '#D4AF37', color: '#0B1F3B',
                '&:hover': { bgcolor: '#E3C668' },
                borderRadius: 2,
              }}
            >
              Capture Selfie
            </Button>
          )}

          {phase === 'captured' && (
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                size="large"
                startIcon={<RestartAltIcon />}
                onClick={handleRetry}
                sx={{ flex: 1, py: 1.6, borderRadius: 2 }}
              >
                Retake
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={submit}
                sx={{
                  flex: 2, py: 1.6, fontWeight: 700,
                  bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' },
                  borderRadius: 2,
                }}
              >
                Verify &amp; Continue
              </Button>
            </Stack>
          )}

          {phase === 'error' && (
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<RestartAltIcon />}
              onClick={handleRetry}
              sx={{
                py: 1.8, fontSize: 15, fontWeight: 700,
                bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' },
                borderRadius: 2,
              }}
            >
              Try Again
            </Button>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ opacity: 0.75 }}>
          Powered by Cashfree Face Liveness · Your selfie is not stored publicly
        </Typography>

      </Stack>
    </OnboardingLayout>
  );
}
