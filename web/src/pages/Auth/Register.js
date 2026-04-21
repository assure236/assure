import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, TextField,
  Grid, Stepper, Step, StepLabel, CircularProgress, Link
} from '@mui/material';
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

const STEPS = ['Mobile Verification', 'Email Verification'];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: '', mobile: '', email: '', referral_code: '' });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Step 0: send mobile OTP
  const sendMobileOtp = async () => {
    if (!form.full_name.trim()) return toast.error('Enter your full name');
    if (!/^\d{10}$/.test(form.mobile)) return toast.error('Enter a valid 10-digit mobile number');
    setLoading(true);
    try {
      const res = await axios.post('/auth/resend-otp', { mobile: form.mobile });
      setStep(1); toast.success('OTP sent to +91 ' + form.mobile);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  // Step 1: verify mobile OTP
  const verifyMobileOtp = async (otp) => {
    setLoading(true);
    try {
      const res = await axios.post('/auth/verify-otp', { mobile: form.mobile, otp, type: 'mobile' });
      if (res.data.success) { setStep(2); toast.success('Mobile verified!'); }
      else toast.error(res.data.message || 'Invalid OTP');
    } catch (e) { toast.error(e.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  // Step 2: send email OTP
  const sendEmailOtp = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Enter a valid email address');
    setLoading(true);
    try {
      await axios.post('/auth/resend-otp', { email: form.email, type: 'email' });
      setStep(3); toast.success('OTP sent to ' + form.email);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to send email OTP'); }
    finally { setLoading(false); }
  };

  // Step 3: verify email OTP — then auto-register (no MPIN)
  const verifyEmailOtp = async (otp) => {
    setLoading(true);
    try {
      const res = await axios.post('/auth/verify-otp', { email: form.email, otp, type: 'email' });
      if (res.data.success) {
        toast.success('Email verified!');
        await handleRegister();
      } else {
        toast.error(res.data.message || 'Invalid OTP');
      }
    } catch (e) { toast.error(e.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    // Auto-generate a random 6-digit value to satisfy the backend MPIN field.
    // The user no longer enters or uses an MPIN.
    const autoPin = String(Math.floor(100000 + Math.random() * 900000));
    const result = await register({
      full_name: form.full_name.trim(),
      mobile: form.mobile,
      email: form.email,
      mpin: autoPin,
      referral_code: form.referral_code.trim() || undefined,
    });
    if (result?.success) navigate('/dashboard');
  };

  // Stepper display: steps 0,1 = "Mobile Verification", 2,3 = "Email Verification"
  const activeStep = step <= 1 ? 0 : 1;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={6} sx={{ width: '100%', maxWidth: 560, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 2.5, px: 3, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={800}>Assure Chit Funds</Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>Create your account</Typography>
        </Box>

        <Box sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {STEPS.map(label => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {/* Step 0: Name + Mobile */}
          {step === 0 && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>Enter your details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth required label="Full Name" value={form.full_name}
                    onChange={e => update('full_name', e.target.value)} autoFocus />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth required label="Mobile Number" value={form.mobile}
                    onChange={e => update('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>+91</Typography> }}
                    inputProps={{ maxLength: 10 }} placeholder="10-digit mobile" />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Referral Code (optional)" value={form.referral_code}
                    onChange={e => update('referral_code', e.target.value)} />
                </Grid>
              </Grid>
              <Button fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.5, fontWeight: 700 }}
                onClick={sendMobileOtp} disabled={loading}>
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Send Mobile OTP'}
              </Button>
            </>
          )}

          {/* Step 1: Mobile OTP */}
          {step === 1 && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>Verify Mobile</Typography>
              <Typography variant="body2" color="text.secondary">OTP sent to +91 {form.mobile}</Typography>
              <PinInput pinKey="motp" length={6} onComplete={verifyMobileOtp} autoFocus />
              {loading && <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>}
              <Button variant="text" size="small" onClick={() => setStep(0)}>← Back</Button>
            </>
          )}

          {/* Step 2: Email */}
          {step === 2 && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>Enter your email</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>We'll send an OTP to verify your email</Typography>
              <TextField fullWidth required label="Email Address" type="email" value={form.email}
                onChange={e => update('email', e.target.value)} autoFocus />
              <Button fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.5, fontWeight: 700 }}
                onClick={sendEmailOtp} disabled={loading}>
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Send Email OTP'}
              </Button>
            </>
          )}

          {/* Step 3: Email OTP */}
          {step === 3 && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>Verify Email</Typography>
              <Typography variant="body2" color="text.secondary">OTP sent to {form.email}</Typography>
              <PinInput pinKey="eotp" length={6} onComplete={verifyEmailOtp} autoFocus />
              {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}><CircularProgress size={24} /></Box>}
              <Button variant="text" size="small" onClick={() => setStep(2)}>← Back</Button>
            </>
          )}

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" fontWeight={600}>Login here</Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
