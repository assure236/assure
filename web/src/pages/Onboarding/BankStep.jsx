import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Stack, TextField, Button, Alert, CircularProgress, Box, Typography } from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { toast } from 'react-toastify';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

export default function BankStep() {
  const navigate = useNavigate();
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    setResult(null);
    if (accountNumber !== confirmAccount) {
      setError('Account numbers do not match.');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase().trim())) {
      setError('Invalid IFSC. Format: ABCD0123456');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/onboarding/bank', {
        account_number: accountNumber,
        ifsc_code: ifsc.toUpperCase().trim(),
      });
      if (res.data?.success) {
        setResult(res.data);
        toast.success(res.data.message || 'Bank verified.');
        setTimeout(() => navigate('/onboarding/cheque', { replace: true }), 1100);
      } else {
        setError(res.data?.message || 'Bank verification failed.');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Bank verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      step="bank"
      title="Add your bank account"
      subtitle="Prize money and dividends will be paid to this account. Account holder name must match your KYC name."
    >
      <Stack spacing={2}>
        <TextField label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} fullWidth inputProps={{ inputMode: 'numeric' }} />
        <TextField label="Re-enter Account Number" value={confirmAccount} onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ''))} fullWidth inputProps={{ inputMode: 'numeric' }} />
        <TextField label="IFSC Code" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} inputProps={{ maxLength: 11, style: { textTransform: 'uppercase' } }} fullWidth />

        {error && <Alert severity="error">{error}</Alert>}
        {result?.success && result.account_holder_name && (
          <Alert severity="success" icon={<AccountBalanceIcon />}>
            <Box>
              <Typography variant="body2"><b>Verified:</b> {result.account_holder_name}</Typography>
              {result.bank_name && <Typography variant="caption">{result.bank_name} {result.branch ? `• ${result.branch}` : ''}</Typography>}
            </Box>
          </Alert>
        )}

        <Button variant="contained" size="large" onClick={submit} disabled={submitting} sx={{ py: 1.4 }}>
          {submitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Verify & Continue'}
        </Button>
      </Stack>
    </OnboardingLayout>
  );
}
