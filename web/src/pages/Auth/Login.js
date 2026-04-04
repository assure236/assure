import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, TextField,
  Grid, Divider, Chip, CircularProgress, Link
} from '@mui/material';
import { QrCode2, Refresh } from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

function PinInput({ pinKey, length = 6, onComplete, autoFocus }) {
  const [values, setValues] = useState(Array(length).fill(''));
  const refs = useRef([]);
  useEffect(() => { setValues(Array(length).fill('')); }, [pinKey, length]);
  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...values]; next[i] = val; setValues(next);
    if (val && i < length - 1) refs.current[i + 1]?.focus();
    if (next.every(v => v !== '')) onComplete(next.join(''));
  };
  const handleKeyDown = (i, e) => { if (e.key === 'Backspace' && !values[i] && i > 0) refs.current[i - 1]?.focus(); };
  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', my: 2 }}>
      {values.map((v, i) => (
        <TextField key={i} inputRef={el => (refs.current[i] = el)} value={v}
          onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
          autoFocus={autoFocus && i === 0}
          inputProps={{ maxLength: 1, style: { textAlign: 'center', fontSize: 22, fontWeight: 700, width: 36, padding: '10px 0' } }}
          sx={{ width: 50 }} />
      ))}
    </Box>
  );
}

function QrPanel({ onLoginSuccess }) {
  const [sessionId, setSessionId] = useState(null);
  const [qrStatus, setQrStatus] = useState('loading');
  const [timeLeft, setTimeLeft] = useState(120);
  const pollRef = useRef(null); const timerRef = useRef(null);
  const generateQr = useCallback(async () => {
    clearInterval(pollRef.current); clearInterval(timerRef.current);
    setQrStatus('loading');
    try {
      const res = await axios.post('/auth/qr-generate');
      setSessionId(res.data.data.sessionId); setQrStatus('pending'); setTimeLeft(120);
    } catch { setQrStatus('expired'); }
  }, []);
  useEffect(() => { generateQr(); return () => { clearInterval(pollRef.current); clearInterval(timerRef.current); }; }, [generateQr]);
  useEffect(() => {
    if (qrStatus !== 'pending') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { setQrStatus('expired'); clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qrStatus, sessionId]);
  useEffect(() => {
    if (qrStatus !== 'pending' || !sessionId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/auth/qr-status/${sessionId}`);
        const { status, token, refreshToken, user } = res.data.data;
        if (status === 'confirmed') { clearInterval(pollRef.current); setQrStatus('confirmed'); onLoginSuccess({ token, refreshToken, user }); }
        else if (status === 'expired') { clearInterval(pollRef.current); setQrStatus('expired'); }
      } catch {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [qrStatus, sessionId, onLoginSuccess]);
  const qrValue = sessionId ? `assure://qr-login?session=${sessionId}` : '';
  const mins = Math.floor(timeLeft / 60); const secs = String(timeLeft % 60).padStart(2, '0');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3, py: 4, height: '100%', justifyContent: 'center' }}>
      <QrCode2 sx={{ fontSize: 44, color: 'primary.main', mb: 1 }} />
      <Typography variant="h6" fontWeight={700} gutterBottom>Quick Login with App</Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Open <strong>Assure ChitFunds</strong> on your phone and scan to login instantly
      </Typography>
      <Box sx={{ p: 1.5, border: '2px solid', borderColor: qrStatus === 'pending' ? 'primary.main' : 'grey.300', borderRadius: 2, bgcolor: 'white' }}>
        {qrStatus === 'loading' && <Box sx={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>}
        {qrStatus === 'pending' && <QRCodeSVG value={qrValue} size={200} level="M" />}
        {qrStatus === 'confirmed' && (
          <Box sx={{ width: 200, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Typography color="success.main" variant="h4">✓</Typography>
            <Typography variant="body2" color="success.main" fontWeight={700}>Confirmed!</Typography>
            <Typography variant="caption">Logging you in...</Typography>
          </Box>
        )}
        {qrStatus === 'expired' && (
          <Box onClick={generateQr} sx={{ width: 200, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>
            <Refresh sx={{ fontSize: 52, color: 'grey.400' }} />
            <Typography variant="body2" color="text.secondary" align="center">QR expired<br />Tap to refresh</Typography>
          </Box>
        )}
      </Box>
      {qrStatus === 'pending' && (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={12} />
          <Typography variant="caption" color="text.secondary">Waiting for scan · {mins}:{secs}</Typography>
        </Box>
      )}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2, width: '100%' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>How to scan:</Typography>
        {['Open Assure ChitFunds app on your phone', 'Tap the QR scanner icon (top of screen)', 'Point camera at this code — login is instant'].map((s, i) => (
          <Typography key={i} variant="caption" color="text.secondary" display="block">{i + 1}. {s}</Typography>
        ))}
      </Box>
    </Box>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithToken } = useAuth();
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
      const res = await axios.post('/auth/resend-otp', { mobile: m });
      setMobile(m); setStep(1); toast.success('OTP sent to +91 ' + m);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const verifyOtp = async (otp) => {
    setLoading(true);
    try {
      const res = await axios.post('/auth/verify-otp', { mobile, otp, type: 'mobile' });
      if (res.data.success) { setStep(2); toast.success('OTP verified!'); }
    } catch (e) { toast.error(e.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const loginWithMpin = async (mpin) => {
    setLoading(true);
    try {
      const result = await login({ mobile, mpin });
      if (result?.success) navigate('/dashboard');
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={6} sx={{ width: '100%', maxWidth: 900, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 2.5, px: 3, textAlign: 'center' }}>
          <Box component="img" src="/logo.png" alt="Assure ChitFunds" sx={{ width: 56, height: 56, mb: 1 }} />
          <Typography variant="h4" fontWeight={800}>Assure Chit Funds</Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>Member Portal — Login</Typography>
        </Box>
        <Grid container>
          <Grid item xs={12} md={6} sx={{ borderRight: { md: '1px solid' }, borderColor: { md: 'divider' } }}>
            <Box sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                {step === 0 ? 'Enter your mobile number' : step === 1 ? 'Verify OTP' : 'Enter your MPIN'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {step === 0 && "We'll send a 6-digit OTP to your registered number"}
                {step === 1 && `OTP sent to +91 ${mobile}`}
                {step === 2 && 'Enter your 6-digit MPIN to access your account'}
              </Typography>
              {step === 0 && (
                <>
                  <TextField fullWidth label="Mobile Number" value={mobileInput}
                    onChange={e => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>+91</Typography> }}
                    inputProps={{ maxLength: 10 }} autoFocus placeholder="10-digit mobile" />
                  <Button fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.5, fontWeight: 700 }}
                    onClick={sendOtp} disabled={loading}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : 'Send OTP'}
                  </Button>
                </>
              )}
              {step === 1 && (
                <>
                  <Typography variant="body2" align="center" color="text.secondary">Enter the 6-digit OTP</Typography>
                  <PinInput pinKey="otp" length={6} onComplete={verifyOtp} autoFocus />
                  {loading && <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>}
                  <Button variant="text" size="small" onClick={() => setStep(0)} sx={{ mt: 1 }}>← Change number</Button>
                </>
              )}
              {step === 2 && (
                <>
                  <Typography variant="body2" align="center" color="text.secondary">Enter your 6-digit MPIN</Typography>
                  <PinInput pinKey="mpin" length={6} onComplete={loginWithMpin} autoFocus />
                  {loading && <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>}
                  <Button variant="text" size="small" onClick={() => setStep(0)} sx={{ mt: 1 }}>← Back</Button>
                </>
              )}
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="body2">
                  Don't have an account?{' '}
                  <Link component={RouterLink} to="/register" fontWeight={600}>Register here</Link>
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
            <QrPanel onLoginSuccess={handleQrLoginSuccess} />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
