import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, TextField,
  Grid, CircularProgress, Link, Divider,
} from '@mui/material';
import { QrCode2, Refresh } from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { brand } from '../../theme/brand';

function PinInput({ pinKey, length = 6, onComplete, autoFocus }) {
  const [values, setValues] = useState(Array(length).fill(''));
  const refs = useRef([]);
  useEffect(() => { setValues(Array(length).fill('')); }, [pinKey, length]);
  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...values]; next[i] = val; setValues(next);
    if (val && i < length - 1) refs.current[i + 1]?.focus();
    if (next.every((v) => v !== '')) onComplete(next.join(''));
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !values[i] && i > 0) refs.current[i - 1]?.focus();
  };
  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', my: 2 }}>
      {values.map((v, i) => (
        <TextField
          key={i}
          inputRef={(el) => (refs.current[i] = el)}
          value={v}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          autoFocus={autoFocus && i === 0}
          inputProps={{
            maxLength: 1,
            style: { textAlign: 'center', fontSize: 22, fontWeight: 700, width: 36, padding: '10px 0' },
          }}
          sx={{ width: 50 }}
        />
      ))}
    </Box>
  );
}

function QrPanel({ onLoginSuccess }) {
  const [sessionId, setSessionId] = useState(null);
  const [qrStatus, setQrStatus] = useState('loading');
  const [timeLeft, setTimeLeft] = useState(120);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const generateQr = useCallback(async () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setQrStatus('loading');
    try {
      const res = await axios.post('/auth/qr-generate');
      setSessionId(res.data.data.sessionId);
      setQrStatus('pending');
      setTimeLeft(120);
    } catch {
      setQrStatus('expired');
    }
  }, []);
  useEffect(() => {
    generateQr();
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, [generateQr]);
  useEffect(() => {
    if (qrStatus !== 'pending') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setQrStatus('expired');
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qrStatus, sessionId]);
  useEffect(() => {
    if (qrStatus !== 'pending' || !sessionId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/auth/qr-status/${sessionId}`);
        const { status, token, refreshToken, user } = res.data.data;
        if (status === 'confirmed') {
          clearInterval(pollRef.current);
          setQrStatus('confirmed');
          onLoginSuccess({ token, refreshToken, user });
        } else if (status === 'expired') {
          clearInterval(pollRef.current);
          setQrStatus('expired');
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [qrStatus, sessionId, onLoginSuccess]);
  const qrValue = sessionId ? `assurechitfunds://qr-login?session=${sessionId}` : '';
  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, '0');
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 4 },
        height: '100%',
        justifyContent: 'center',
        bgcolor: 'rgba(11,31,59,0.03)',
      }}
    >
      <QrCode2 sx={{ fontSize: 36, color: brand.goldDark, mb: 1 }} />
      <Typography variant="h6" gutterBottom>
        Scan with the app
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2.5, maxWidth: 280 }}>
        Open Assure ChitFunds on your phone and scan to sign in on this browser.
      </Typography>
      <Box
        sx={{
          p: 1.5,
          border: `1.5px solid ${qrStatus === 'pending' ? brand.gold : brand.lineStrong}`,
          borderRadius: 2.5,
          bgcolor: '#fff',
          boxShadow: brand.shadowSoft,
        }}
      >
        {qrStatus === 'loading' && (
          <Box sx={{ width: 180, height: 180, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        {qrStatus === 'pending' && <QRCodeSVG value={qrValue} size={180} level="M" />}
        {qrStatus === 'confirmed' && (
          <Box sx={{ width: 180, height: 180, display: 'grid', placeItems: 'center', textAlign: 'center', px: 1 }}>
            <Typography color="success.main" fontWeight={800}>Confirmed</Typography>
            <Typography variant="caption">Signing you in…</Typography>
          </Box>
        )}
        {qrStatus === 'expired' && (
          <Box
            onClick={generateQr}
            sx={{
              width: 180,
              height: 180,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <Refresh sx={{ fontSize: 40, color: brand.muted }} />
            <Typography variant="body2" color="text.secondary">
              Expired — tap to refresh
            </Typography>
          </Box>
        )}
      </Box>
      {qrStatus === 'pending' && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
          Waiting for scan · {mins}:{secs}
        </Typography>
      )}
    </Box>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState('');
  const [mobileInput, setMobileInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQrLoginSuccess = useCallback(async ({ token, refreshToken, user }) => {
    await loginWithToken(token, user);
    toast.success(`Welcome back, ${user.full_name}!`);
    navigate('/dashboard');
  }, [loginWithToken, navigate]);

  const sendOtp = async () => {
    const m = mobileInput.trim();
    if (!/^\d{10}$/.test(m)) return toast.error('Enter a valid 10-digit mobile number');
    setLoading(true);
    try {
      await axios.post('/auth/resend-otp', { mobile: m });
      setMobile(m);
      setStep(1);
      toast.success('OTP sent to +91 ' + m);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (otp) => {
    setLoading(true);
    try {
      const res = await axios.post('/auth/login-otp', {
        mobile,
        otp,
        platform: 'web',
        device_name: 'Web Browser',
      });
      if (res.data.success) {
        const { token, user } = res.data.data;
        await loginWithToken(token, user);
        toast.success(`Welcome back, ${user.full_name || 'Member'}!`);
        navigate('/dashboard');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2, sm: 3 },
        position: 'relative',
        overflow: 'hidden',
        background: `
          radial-gradient(ellipse 70% 50% at 10% 0%, rgba(201,162,39,0.22), transparent 55%),
          radial-gradient(ellipse 60% 45% at 95% 15%, rgba(30,58,138,0.2), transparent 50%),
          linear-gradient(165deg, ${brand.navyDeep} 0%, ${brand.navy} 42%, #143156 100%)
        `,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.2,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ width: '100%', maxWidth: 920, position: 'relative', zIndex: 1 }}>
        <Box textAlign="center" mb={3}>
          <Box
            component="img"
            src="/logo.png"
            alt="Assure ChitFunds"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = '/build/logo.png';
            }}
            sx={{ width: 64, height: 64, mb: 1.5, objectFit: 'contain' }}
          />
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              color: '#fff',
              fontWeight: 600,
              fontSize: { xs: '2rem', sm: '2.5rem' },
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Assure ChitFunds
          </Typography>
          <Typography sx={{ color: brand.goldSoft, mt: 1, fontWeight: 600, letterSpacing: '0.04em' }}>
            Sign in to your member portal
          </Typography>
        </Box>

        <Box
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.14)',
            bgcolor: 'rgba(255,255,255,0.96)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          }}
        >
          <Grid container>
            <Grid item xs={12} md={6} sx={{ borderRight: { md: `1px solid ${brand.line}` } }}>
              <Box sx={{ p: { xs: 3, sm: 4 } }}>
                <Typography variant="overline" sx={{ color: brand.goldDark }}>
                  Mobile OTP
                </Typography>
                <Typography variant="h5" sx={{ mb: 0.75 }}>
                  {step === 0 ? 'Enter mobile number' : 'Verify OTP'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {step === 0 && 'We will send a 6-digit OTP to your registered number.'}
                  {step === 1 && `OTP sent to +91 ${mobile}`}
                </Typography>
                {step === 0 && (
                  <>
                    <TextField
                      fullWidth
                      label="Mobile Number"
                      value={mobileInput}
                      onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                      InputProps={{
                        startAdornment: (
                          <Typography sx={{ mr: 1, color: 'text.secondary', fontWeight: 700 }}>+91</Typography>
                        ),
                      }}
                      inputProps={{ maxLength: 10 }}
                      autoFocus
                      placeholder="10-digit mobile"
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      sx={{ mt: 2.5, py: 1.4 }}
                      onClick={sendOtp}
                      disabled={loading}
                    >
                      {loading ? <CircularProgress size={22} color="inherit" /> : 'Send OTP'}
                    </Button>
                  </>
                )}
                {step === 1 && (
                  <>
                    <Typography variant="body2" align="center" color="text.secondary">
                      Enter the 6-digit OTP
                    </Typography>
                    <PinInput pinKey="otp" length={6} onComplete={verifyOtp} autoFocus />
                    {loading && (
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={24} />
                      </Box>
                    )}
                    <Button variant="text" size="small" onClick={() => setStep(0)} sx={{ mt: 1 }}>
                      Change number
                    </Button>
                  </>
                )}
                <Divider sx={{ my: 3 }} />
                <Typography variant="body2" textAlign="center">
                  New here?{' '}
                  <Link component={RouterLink} to="/register" fontWeight={700}>
                    Create an account
                  </Link>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <QrPanel onLoginSuccess={handleQrLoginSuccess} />
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}
