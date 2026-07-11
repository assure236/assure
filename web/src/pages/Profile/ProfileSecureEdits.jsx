import React, { useState } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Alert, CircularProgress
} from '@mui/material';
import axios from 'axios';
import { toast } from 'react-toastify';

/** Email / Address / Bank change flows matching mobile OTP & proof uploads. */
const ProfileSecureEdits = ({ user, onUpdated }) => {
  const [emailOpen, setEmailOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  const [addressForm, setAddressForm] = useState({
    address: '', city: '', state: '', pincode: '',
    current_address: '', current_city: '', current_state: '', current_pincode: '',
  });
  const [addressFile, setAddressFile] = useState(null);
  const [addressBusy, setAddressBusy] = useState(false);

  const [bankForm, setBankForm] = useState({
    bank_account_number: '', bank_ifsc_code: '', bank_name: '',
  });
  const [bankFile, setBankFile] = useState(null);
  const [bankBusy, setBankBusy] = useState(false);
  const [ifscLooking, setIfscLooking] = useState(false);

  const openEmail = () => {
    setEmail(user?.email || '');
    setEmailOtp('');
    setEmailOtpSent(false);
    setEmailOpen(true);
  };

  const openAddress = () => {
    setAddressForm({
      address: user?.address || '',
      city: user?.city || '',
      state: user?.state || '',
      pincode: user?.pincode || '',
      current_address: user?.current_address || '',
      current_city: user?.current_city || '',
      current_state: user?.current_state || '',
      current_pincode: user?.current_pincode || '',
    });
    setAddressFile(null);
    setAddressOpen(true);
  };

  const openBank = () => {
    setBankForm({
      bank_account_number: '',
      bank_ifsc_code: user?.bank_ifsc_code || '',
      bank_name: user?.bank_name || '',
    });
    setBankFile(null);
    setBankOpen(true);
  };

  const sendEmailOtp = async () => {
    setEmailBusy(true);
    try {
      const res = await axios.post('/users/profile/change-email/send-otp', { email: email.trim() });
      if (res.data.success) {
        setEmailOtpSent(true);
        toast.success(res.data.message || 'OTP sent to email');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email OTP');
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyEmailOtp = async () => {
    setEmailBusy(true);
    try {
      const res = await axios.post('/users/profile/change-email/verify-otp', {
        email: email.trim(),
        otp: emailOtp.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Email updated');
        setEmailOpen(false);
        onUpdated?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setEmailBusy(false);
    }
  };

  const submitAddress = async () => {
    if (!addressFile) {
      toast.error('Address proof document is required');
      return;
    }
    setAddressBusy(true);
    try {
      const fd = new FormData();
      Object.entries(addressForm).forEach(([k, v]) => fd.append(k, v || ''));
      fd.append('address_proof', addressFile);
      const res = await axios.put('/users/profile/change-address', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Address submitted for review');
        setAddressOpen(false);
        onUpdated?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit address change');
    } finally {
      setAddressBusy(false);
    }
  };

  const lookupIfsc = async () => {
    const ifsc = bankForm.bank_ifsc_code.trim().toUpperCase();
    if (ifsc.length < 11) return;
    setIfscLooking(true);
    try {
      const res = await axios.get(`/users/bank/ifsc/${ifsc}`);
      if (res.data.success && res.data.data) {
        setBankForm((f) => ({
          ...f,
          bank_ifsc_code: ifsc,
          bank_name: res.data.data.BANK || res.data.data.bank_name || f.bank_name,
        }));
      }
    } catch {
      toast.error('Could not look up IFSC');
    } finally {
      setIfscLooking(false);
    }
  };

  const submitBank = async () => {
    if (!bankFile) {
      toast.error('Bank proof document is required');
      return;
    }
    setBankBusy(true);
    try {
      const fd = new FormData();
      fd.append('bank_account_number', bankForm.bank_account_number.trim());
      fd.append('bank_ifsc_code', bankForm.bank_ifsc_code.trim().toUpperCase());
      fd.append('bank_name', bankForm.bank_name.trim());
      fd.append('bank_proof', bankFile);
      const res = await axios.put('/users/profile/change-bank', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Bank details submitted for review');
        setBankOpen(false);
        onUpdated?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit bank change');
    } finally {
      setBankBusy(false);
    }
  };

  return (
    <>
      <Box display="flex" flexDirection="column" gap={1} mt={2}>
        <Button variant="outlined" fullWidth onClick={openEmail}>Change Email (OTP)</Button>
        <Button variant="outlined" fullWidth onClick={openAddress}>Change Address (with proof)</Button>
        <Button variant="outlined" fullWidth onClick={openBank}>Change Bank Details (with proof)</Button>
      </Box>

      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Email</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            We will send an OTP to the new email address to verify ownership.
          </Typography>
          <TextField
            fullWidth label="New Email" size="small" margin="dense"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          {emailOtpSent && (
            <TextField
              fullWidth label="OTP" size="small" margin="dense"
              value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
          {!emailOtpSent ? (
            <Button variant="contained" onClick={sendEmailOtp} disabled={emailBusy}>
              {emailBusy ? <CircularProgress size={18} /> : 'Send OTP'}
            </Button>
          ) : (
            <Button variant="contained" onClick={verifyEmailOtp} disabled={emailBusy}>
              {emailBusy ? <CircularProgress size={18} /> : 'Verify & Save'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={addressOpen} onClose={() => setAddressOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Address</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Address changes require proof upload and admin approval (usually within 24 hours).
          </Alert>
          {[
            ['address', 'Permanent Address'],
            ['city', 'City'],
            ['state', 'State'],
            ['pincode', 'Pincode'],
            ['current_address', 'Current Address (optional)'],
            ['current_city', 'Current City'],
            ['current_state', 'Current State'],
            ['current_pincode', 'Current Pincode'],
          ].map(([field, label]) => (
            <TextField
              key={field}
              fullWidth label={label} size="small" margin="dense"
              value={addressForm[field]}
              onChange={(e) => setAddressForm({ ...addressForm, [field]: e.target.value })}
            />
          ))}
          <Button variant="outlined" component="label" fullWidth sx={{ mt: 1 }}>
            {addressFile ? addressFile.name : 'Upload address proof (required)'}
            <input hidden type="file" accept="image/*,.pdf" onChange={(e) => setAddressFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddressOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitAddress} disabled={addressBusy}>
            {addressBusy ? <CircularProgress size={18} /> : 'Submit for Review'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bankOpen} onClose={() => setBankOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Bank Details</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Bank changes require proof (cancelled cheque / passbook) and admin approval.
          </Alert>
          <TextField
            fullWidth label="Account Number" size="small" margin="dense"
            value={bankForm.bank_account_number}
            onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value.replace(/\D/g, '') })}
          />
          <Box display="flex" gap={1} alignItems="center">
            <TextField
              fullWidth label="IFSC" size="small" margin="dense"
              value={bankForm.bank_ifsc_code}
              onChange={(e) => setBankForm({ ...bankForm, bank_ifsc_code: e.target.value.toUpperCase() })}
              onBlur={lookupIfsc}
            />
            <Button onClick={lookupIfsc} disabled={ifscLooking} sx={{ mt: 0.5 }}>
              {ifscLooking ? '…' : 'Lookup'}
            </Button>
          </Box>
          <TextField
            fullWidth label="Bank Name" size="small" margin="dense"
            value={bankForm.bank_name}
            onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
          />
          <Button variant="outlined" component="label" fullWidth sx={{ mt: 1 }}>
            {bankFile ? bankFile.name : 'Upload bank proof (required)'}
            <input hidden type="file" accept="image/*,.pdf" onChange={(e) => setBankFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBankOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitBank} disabled={bankBusy}>
            {bankBusy ? <CircularProgress size={18} /> : 'Submit for Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProfileSecureEdits;
