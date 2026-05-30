import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Button, Box, Typography, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OnboardingLayout from '../../components/Onboarding/OnboardingLayout';

export default function DoneStep() {
  const navigate = useNavigate();
  const [count, setCount] = useState(8);

  useEffect(() => {
    if (count <= 0) {
      navigate('/dashboard?onboarding=just_completed', { replace: true });
      return;
    }
    const id = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(id);
  }, [count, navigate]);

  return (
    <OnboardingLayout step="done" title="Onboarding complete!" subtitle="">
      <Stack spacing={3} alignItems="center">
        <Box sx={{
          width: 96, height: 96, borderRadius: '50%', bgcolor: 'success.main',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <CheckCircleIcon sx={{ fontSize: 56 }} />
        </Box>
        <Typography variant="body1" textAlign="center">
          Thank you! Your details have been submitted.<br />
          <b>Admin will approve your account within 24 hours.</b>
        </Typography>
        <Alert severity="info" sx={{ width: '100%' }}>
          You can explore the dashboard in the meantime. We'll notify you once approval is granted.
        </Alert>
        <Button variant="contained" size="large" fullWidth onClick={() => navigate('/dashboard?onboarding=just_completed', { replace: true })}>
          Go to Dashboard ({count})
        </Button>
      </Stack>
    </OnboardingLayout>
  );
}
