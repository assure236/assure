import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button, Stack, Alert, Box, Typography, CircularProgress,
  Stepper, Step, StepLabel, Chip, LinearProgress,
} from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { toast } from 'react-toastify';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

// ─── How the Cashfree DigiLocker flow works ───────────────────────────────────
// 1. We call POST /onboarding/digilocker/create-url  →  backend creates a
//    Cashfree verification session and returns a {url, verification_id}.
// 2. We open that URL in a new tab. The user logs in to DigiLocker, consents
//    to share Aadhaar + PAN, and Cashfree redirects them back to our
//    CASHFREE_DIGILOCKER_REDIRECT_URL (assure.fund/onboarding/digilocker).
// 3. On that redirect we receive ?cf_digilocker=success&verification_id=xxx
//    (or error). We call POST /onboarding/digilocker/sync with the
//    verification_id to pull the documents from Cashfree into our database.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000;  // poll every 3 s while waiting
const MAX_POLLS       = 60;     // give up after ~3 minutes

export default function DigiLockerStep() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();

  // UI state
  const [phase, setPhase]           = useState('idle'); // idle | creating | waiting | syncing | done | error
  const [verificationId, setVerificationId] = useState(null);
  const [error, setError]           = useState(null);
  const [pollCount, setPollCount]   = useState(0);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const pollTimer  = useRef(null);
  const pollsRef   = useRef(0);

  // ── Check if this step is already complete ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/onboarding/status');
        const step = res.data?.data?.steps?.digilocker;
        if (step?.status === 'completed' || step?.status === 'manual') {
          setAlreadyDone(true);
        }
      } catch (_) {}
    })();
  }, []);

  // ── Handle Cashfree redirect back to this page ────────────────────────────
  // Cashfree redirects to: /onboarding/digilocker?verification_id=xxx
  // (No cf_digilocker param — Cashfree only appends verification_id)
  useEffect(() => {
    const vid = searchParams.get('verification_id') || searchParams.get('reference_id');

    if (vid) {
      setVerificationId(vid);
      setPhase('syncing');
      syncWithBackend(vid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1: Create Cashfree DigiLocker URL ────────────────────────────────
  const handleStart = async () => {
    setError(null);
    setPhase('creating');
    try {
      const res = await axios.post('/onboarding/digilocker/create-url', {
        user_flow: 'signup',
      });
      if (!res.data?.success || !res.data?.data?.url) {
        throw new Error(res.data?.message || 'Unable to start DigiLocker verification.');
      }
      const { url, verification_id } = res.data.data;
      setVerificationId(verification_id);
      setPhase('waiting');

      // Open Cashfree DigiLocker URL in new tab
      window.open(url, '_blank', 'noopener,noreferrer');

      // Start polling — in case redirect doesn't fire (user closed tab etc.)
      startPolling(verification_id);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to start DigiLocker. Please try again.');
      setPhase('error');
    }
  };

  // ── Step 3: Sync verified docs from Cashfree into our DB ─────────────────
  const syncWithBackend = useCallback(async (vid) => {
    setPhase('syncing');
    stopPolling();
    try {
      const res = await axios.post('/onboarding/digilocker/sync', {
        verification_id: vid,
      });
      if (res.data?.success && res.data?.completed) {
        setPhase('done');
        toast.success('DigiLocker verified! Aadhaar & PAN confirmed ✅');
        setTimeout(() => navigate('/onboarding/face', { replace: true }), 1200);
      } else {
        // Not yet authenticated on Cashfree side
        const status = res.data?.data?.status || 'PENDING';
        if (status === 'PENDING' || status === 'INITIATED') {
          // Still waiting — keep polling
          setPhase('waiting');
          startPolling(vid);
        } else {
          setError(`DigiLocker status: ${status}. Please try again.`);
          setPhase('error');
        }
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Sync failed. Please try again.');
      setPhase('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── Polling helper — backend polls Cashfree status ───────────────────────
  const startPolling = useCallback((vid) => {
    stopPolling();
    pollsRef.current = 0;
    pollTimer.current = setInterval(async () => {
      pollsRef.current += 1;
      setPollCount(pollsRef.current);

      if (pollsRef.current >= MAX_POLLS) {
        stopPolling();
        setError('Timed out waiting for DigiLocker. Please try again.');
        setPhase('error');
        return;
      }

      try {
        const res = await axios.post('/onboarding/digilocker/sync', { verification_id: vid });
        if (res.data?.success && res.data?.completed) {
          stopPolling();
          setPhase('done');
          toast.success('DigiLocker verified! Aadhaar & PAN confirmed ✅');
          setTimeout(() => navigate('/onboarding/face', { replace: true }), 1200);
        }
        // else keep polling
      } catch (_) { /* keep polling */ }
    }, POLL_INTERVAL_MS);
  }, [navigate]);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []); // cleanup on unmount

  // ── Retry ─────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    stopPolling();
    setPhase('idle');
    setError(null);
    setVerificationId(null);
    setPollCount(0);
    pollsRef.current = 0;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <OnboardingLayout
      step="digilocker"
      title="Verify your identity"
      subtitle="We use Cashfree's secure DigiLocker integration to instantly verify your Aadhaar and PAN. No documents need to be uploaded manually."
      loading={false}
    >
      <Stack spacing={3}>

        {/* Already done */}
        {alreadyDone && phase === 'idle' && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={600}>Identity already verified!</Typography>
            <Button size="small" onClick={() => navigate('/onboarding/face')} sx={{ mt: 0.5 }}>
              Continue →
            </Button>
          </Alert>
        )}

        {/* How it works — shown only in idle */}
        {phase === 'idle' && !alreadyDone && (
          <>
            <Box sx={{ bgcolor: '#f0f4ff', borderRadius: 2, p: 2 }}>
              <Typography variant="body2" fontWeight={600} color="primary.main" mb={1}>
                How it works
              </Typography>
              <Stepper activeStep={-1} orientation="vertical" sx={{ '& .MuiStepLabel-label': { fontSize: 13 } }}>
                {[
                  'Click "Verify with DigiLocker" below',
                  'A secure Cashfree page opens in a new tab',
                  'Log in to DigiLocker and approve sharing of Aadhaar & PAN',
                  'Return here — verification completes automatically',
                ].map((label, i) => (
                  <Step key={i} active={false} completed={false}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={<VerifiedUserIcon />}
              onClick={handleStart}
              sx={{
                py: 1.8, fontSize: 16, fontWeight: 700,
                bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' },
                borderRadius: 2,
              }}
            >
              Verify with DigiLocker
            </Button>
          </>
        )}

        {/* Creating session */}
        {phase === 'creating' && (
          <Stack alignItems="center" spacing={2} py={2}>
            <CircularProgress size={44} />
            <Typography variant="body2" color="text.secondary">
              Creating secure verification session…
            </Typography>
          </Stack>
        )}

        {/* Waiting — user is on Cashfree DigiLocker tab */}
        {phase === 'waiting' && (
          <Stack spacing={2}>
            <Alert
              severity="info"
              icon={<HourglassEmptyIcon />}
              sx={{ borderRadius: 2 }}
            >
              <Typography variant="body2" fontWeight={600}>
                DigiLocker page is open in a new tab
              </Typography>
              <Typography variant="caption">
                Complete verification there. This page will update automatically.
              </Typography>
            </Alert>

            <Box sx={{ px: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Waiting for DigiLocker response… ({pollCount}/{MAX_POLLS})
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(pollCount / MAX_POLLS) * 100}
                sx={{ borderRadius: 4, height: 6 }}
              />
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={handleStart}
              >
                Reopen tab
              </Button>
              <Button
                variant="text"
                size="small"
                color="error"
                onClick={handleRetry}
              >
                Start over
              </Button>
            </Stack>
          </Stack>
        )}

        {/* Syncing — pulling docs from Cashfree */}
        {phase === 'syncing' && (
          <Stack alignItems="center" spacing={2} py={2}>
            <CircularProgress size={44} color="success" />
            <Typography variant="body2" color="text.secondary">
              Fetching your verified documents from DigiLocker…
            </Typography>
          </Stack>
        )}

        {/* Done */}
        {phase === 'done' && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              Aadhaar &amp; PAN verified successfully!
            </Typography>
            <Typography variant="caption">Redirecting to next step…</Typography>
          </Alert>
        )}

        {/* Error */}
        {phase === 'error' && (
          <Stack spacing={2}>
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
            <Button variant="contained" onClick={handleRetry} sx={{ bgcolor: '#0B1F3B', '&:hover': { bgcolor: '#1E3A8A' } }}>
              Try Again
            </Button>
          </Stack>
        )}

        {/* Always show verified badge if already done */}
        {alreadyDone && (
          <Chip
            icon={<CheckCircleIcon />}
            label="Identity Verified"
            color="success"
            variant="outlined"
            sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
          />
        )}
      </Stack>
    </OnboardingLayout>
  );
}
