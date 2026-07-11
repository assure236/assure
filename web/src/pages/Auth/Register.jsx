import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, TextField,
  Grid, Stepper, Step, StepLabel, CircularProgress, Link, Divider
} from '@mui/material';
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

  const sendMobileOtp = async () => {
    if (!form.full_name.trim()) return toast.error('Enter your full name');
    if (!/^\d{10}$/.test(form.mobile)) return toast.error('Enter a valid 10-digit mobile number');
    setLoading(true);
    try {
      await axios.post('/auth/resend-otp', { mobile: form.mobile });
      setStep(1); toast.success('OTP sent to +91 ' + form.mobile);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const verifyMobileOtp = async (otp) => {
    setLoading(true);
    try {
      const res = await axios.post('/auth/verify-otp', { mobile: form.mobile, otp, type: 'mobile' });
      if (res.data.success) { setStep(2); toast.success('Mobile verified!'); }
      else toast.error(res.data.message || 'Invalid OTP');
    } catch (e) { toast.error(e.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const sendEmailOtp = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Enter a valid email address');
    setLoading(true);
    try {
      await axios.post('/auth/resend-otp', { email: form.email, type: 'email' });
      setStep(3); toast.success('OTP sent to ' + form.email);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to send email OTP'); }
    finally { setLoading(false); }
  };

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
    const autoPin = String(Math.floor(100000 + Math.random() * 900000));
    const result = await register({
      full_name: form.full_name.trim(),
      mobile: form.mobile,
      email: form.email,
      mpin: autoPin,
      referral_code: form.referral_code.trim() || undefined,
    });
    if (result?.success) {
      try {
        const s = await axios.get('/onboarding/status');
        const next = s.data?.data?.next_step;
        const path = ({
          digilocker: '/onboarding/digilocker',
          face_match: '/onboarding/face',
          bank: '/onboarding/bank',
          cheque: '/onboarding/cheque',
          address: '/onboarding/address',
          complete: '/onboarding/done',
        })[next] || '/onboarding/digilocker';
        navigate(path, { replace: true });
      } catch {
        navigate('/onboarding/digilocker', { replace: true });
      }
    }
  };

  const activeStep = step <= 1 ? 0 : 1;

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

      <Box sx={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>
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
            Create your member account
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
          <Box sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="overline" sx={{ color: brand.goldDark }}>
              Registration
            </Typography>
            <Typography variant="h5" sx={{ mb: 0.75, color: brand.navy }}>
              {step <= 1 ? 'Verify your mobile' : 'Verify your email'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Complete both steps to activate your account
            </Typography>

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {STEPS.map(label => (
                <Step key={label}><StepLabel>{label}</StepLabel></Step>
              ))}
            </Stepper>

            {step === 0 && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: brand.navy }}>Enter your details</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField fullWidth required label="Full Name" value={form.full_name}
                      onChange={e => update('full_name', e.target.value)} autoFocus />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth required label="Mobile Number" value={form.mobile}
                      onChange={e => update('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary', fontWeight: 700 }}>+91</Typography> }}
                      inputProps={{ maxLength: 10 }} placeholder="10-digit mobile" />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Referral Code (optional)" value={form.referral_code}
                      onChange={e => update('referral_code', e.target.value)} />
                  </Grid>
                </Grid>
                <Button fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.4 }}
                  onClick={sendMobileOtp} disabled={loading}>
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Send Mobile OTP'}
                </Button>
              </>
            )}

            {step === 1 && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: brand.navy }}>Verify Mobile</Typography>
                <Typography variant="body2" color="text.secondary">OTP sent to +91 {form.mobile}</Typography>
                <PinInput pinKey="motp" length={6} onComplete={verifyMobileOtp} autoFocus />
                {loading && <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>}
                <Button variant="text" size="small" onClick={() => setStep(0)}>Change number</Button>
              </>
            )}

            {step === 2 && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: brand.navy }}>Enter your email</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>We'll send an OTP to verify your email</Typography>
                <TextField fullWidth required label="Email Address" type="email" value={form.email}
                  onChange={e => update('email', e.target.value)} autoFocus />
                <Button fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.4 }}
                  onClick={sendEmailOtp} disabled={loading}>
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Send Email OTP'}
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: brand.navy }}>Verify Email</Typography>
                <Typography variant="body2" color="text.secondary">OTP sent to {form.email}</Typography>
                <PinInput pinKey="eotp" length={6} onComplete={verifyEmailOtp} autoFocus />
                {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}><CircularProgress size={24} /></Box>}
                <Button variant="text" size="small" onClick={() => setStep(2)}>Change email</Button>
              </>
            )}

            <Divider sx={{ my: 3 }} />
            <Typography variant="body2" textAlign="center">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" fontWeight={700}>Sign in</Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
