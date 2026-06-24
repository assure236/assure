import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Stack, TextField, Button, Alert, CircularProgress, FormControlLabel, Checkbox, Divider, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

export default function AddressStep() {
  const navigate = useNavigate();
  const [permanent, setPermanent] = useState({ address: '', city: '', state: '', pincode: '' });
  const [current, setCurrent] = useState({ address: '', city: '', state: '', pincode: '' });
  const [sameAs, setSameAs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const change = (which, field) => (e) => {
    const v = field === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    if (which === 'permanent') setPermanent({ ...permanent, [field]: v });
    else setCurrent({ ...current, [field]: v });
  };

  const submit = async () => {
    setError(null);
    const { address, city, state, pincode } = permanent;
    if (!address || !city || !state || !pincode) {
      setError('Please fill all permanent address fields.');
      return;
    }
    if (!/^\d{6}$/.test(pincode)) { setError('Pincode must be 6 digits.'); return; }
    if (!sameAs) {
      if (!current.address || !current.city || !current.state || !current.pincode) {
        setError('Please fill all current address fields or tick "Same as permanent".');
        return;
      }
      if (!/^\d{6}$/.test(current.pincode)) { setError('Current pincode must be 6 digits.'); return; }
    }
    setSubmitting(true);
    try {
      await axios.post('/onboarding/address', {
        address, city, state, pincode,
        current_same_as_permanent: sameAs,
        current_address: sameAs ? address : current.address,
        current_city: sameAs ? city : current.city,
        current_state: sameAs ? state : current.state,
        current_pincode: sameAs ? pincode : current.pincode,
      });
      // Mark onboarding complete
      await axios.post('/onboarding/complete');
      toast.success('Onboarding submitted.');
      navigate('/onboarding/done', { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save address.');
    } finally { setSubmitting(false); }
  };

  return (
    <OnboardingLayout
      step="address"
      title="Your address"
      subtitle="Last step. Enter your permanent address. Tick the box if your current address is the same."
    >
      <Stack spacing={2}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Permanent Address</Typography>
        <TextField label="Street / House / Area" value={permanent.address} onChange={change('permanent', 'address')} multiline minRows={2} fullWidth />
        <Stack direction="row" spacing={1.5}>
          <TextField label="City" value={permanent.city} onChange={change('permanent', 'city')} fullWidth />
          <TextField label="State" value={permanent.state} onChange={change('permanent', 'state')} fullWidth />
        </Stack>
        <TextField label="Pincode" value={permanent.pincode} onChange={change('permanent', 'pincode')} inputProps={{ inputMode: 'numeric', maxLength: 6 }} />

        <FormControlLabel
          control={<Checkbox checked={sameAs} onChange={(e) => setSameAs(e.target.checked)} />}
          label="Current address is same as permanent"
        />

        {!sameAs && (
          <>
            <Divider />
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>Current Address</Typography>
            <TextField label="Street / House / Area" value={current.address} onChange={change('current', 'address')} multiline minRows={2} fullWidth />
            <Stack direction="row" spacing={1.5}>
              <TextField label="City" value={current.city} onChange={change('current', 'city')} fullWidth />
              <TextField label="State" value={current.state} onChange={change('current', 'state')} fullWidth />
            </Stack>
            <TextField label="Pincode" value={current.pincode} onChange={change('current', 'pincode')} inputProps={{ inputMode: 'numeric', maxLength: 6 }} />
          </>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Button variant="contained" size="large" onClick={submit} disabled={submitting} sx={{ py: 1.4 }}>
          {submitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Save & Finish Onboarding'}
        </Button>
      </Stack>
    </OnboardingLayout>
  );
}
