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
  const MAX_FACE_API_ATTEMPTS = 2;
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

  const validateSelfieQuality = async (blob) => {
    try {
      const image = await createImageBitmap(blob);
      const probeCanvas = document.createElement('canvas');
      const size = 256;
      probeCanvas.width = size;
      probeCanvas.height = size;
      const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true });
      probeCtx.drawImage(image, 0, 0, size, size);

      const img = probeCtx.getImageData(0, 0, size, size);
      const data = img.data;
      let lumSum = 0;
      for (let i = 0; i < data.length; i += 4) {
        lumSum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      const pixelCount = data.length / 4;
      const avgLum = lumSum / pixelCount;
      if (avgLum < 55) {
        return { ok: false, message: 'Image is too dark. Move to a brighter place and try again.' };
      }

      if (window.FaceDetector) {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await detector.detect(probeCanvas);
        if (!faces?.length) {
          return { ok: false, message: 'Face not detected clearly. Keep your face fully visible and centered.' };
        }
        const face = faces[0].boundingBox;
        const centerX = face.x + face.width / 2;
        const centerY = face.y + face.height / 2;
        const centered =
          Math.abs(centerX - size / 2) < size * 0.18 &&
          Math.abs(centerY - size / 2) < size * 0.2;
        const faceAreaRatio = (face.width * face.height) / (size * size);
        if (!centered || faceAreaRatio < 0.08) {
          return { ok: false, message: 'Keep your face centered and closer to the camera before verifying.' };
        }
      }

      return { ok: true };
    } catch (_) {
      return { ok: true };
    }
  };

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
    if (attempts >= MAX_FACE_API_ATTEMPTS) {
      setError('Maximum attempts reached for this session. Please try again later.');
      setPhase('error');
      return;
    }
    const quality = await validateSelfieQuality(snapshot);
    if (!quality.ok) {
      setError(quality.message);
      setPhase('captured');
      return;
    }
    setPhase('submitting');
    setError(null);
    const nextAttempt = attempts + 1;
    setAttempts(nextAttempt);

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
        const baseMessage = res.data?.message || 'Face liveness check failed. Please try again in good lighting.';
        setError(nextAttempt >= MAX_FACE_API_ATTEMPTS
          ? `${baseMessage} Attempt limit reached for this session. Please try again later.`
          : baseMessage);
        setPhase('error');
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Face verification failed. Check your connection and try again.';
      setError(nextAttempt >= MAX_FACE_API_ATTEMPTS
        ? `${msg} Attempt limit reached for this session. Please try again later.`
        : msg);
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

        {phase === 'idle' && (
          <Alert severity="info" sx={{ width: '100%', borderRadius: 2 }}>
            Be in a well-lit room, look straight at the camera, and remove hat or glasses before opening camera.
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
            {error}
            {attempts >= 2 && (
              <Typography variant="caption" display="block" mt={0.5}>
                Attempt limit reached for this session. Please try again later.
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
              disabled={attempts >= MAX_FACE_API_ATTEMPTS}
                sx={{
                  flex: 2, py: 1.6, fontWeight: 700,
                  bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' },
                  borderRadius: 2,
                }}
              >
                {attempts >= MAX_FACE_API_ATTEMPTS ? 'Attempt limit reached' : 'Verify & Continue'}
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
              disabled={attempts >= MAX_FACE_API_ATTEMPTS}
              sx={{
                py: 1.8, fontSize: 15, fontWeight: 700,
                bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' },
                borderRadius: 2,
              }}
            >
              {attempts >= MAX_FACE_API_ATTEMPTS ? 'Try later' : 'Try Again'}
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
