import React from 'react';
import { Box, Container, Paper, Stack, LinearProgress, Typography, IconButton } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const STEP_ORDER = [
  { key: 'digilocker', label: 'Identity' },
  { key: 'face_match', label: 'Face' },
  { key: 'bank',       label: 'Bank' },
  { key: 'cheque',     label: 'Cheque' },
  { key: 'address',    label: 'Address' },
  { key: 'done',       label: 'Done' },
];

function StepDots({ active }) {
  const idx = STEP_ORDER.findIndex((s) => s.key === active);
  return (
    <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="center" sx={{ mb: 3 }}>
      {STEP_ORDER.map((s, i) => {
        const done = i < idx;
        const here = i === idx;
        return (
          <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: here ? 30 : 24, height: here ? 30 : 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: done ? 'success.main' : here ? 'primary.main' : 'grey.300',
                color: '#fff', fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
              }}
            >{done ? '\u2713' : i + 1}</Box>
            {i < STEP_ORDER.length - 1 && (
              <Box sx={{ width: 18, height: 2, bgcolor: done ? 'success.main' : 'grey.300' }} />
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

export default function OnboardingLayout({
  step, title, subtitle, children, loading = false, footer,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0B1F3B 0%, #1E3A8A 60%, #0B1F3B 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, px: 2,
    }}>
      <Container maxWidth="sm" sx={{ px: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, px: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img
              src="/logo.png"
              alt="Assure"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/build/logo.png'; }}
              style={{ height: 36, width: 36, borderRadius: 8, objectFit: 'cover' }}
            />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>Assure ChitFunds</Typography>
          </Box>
          <IconButton onClick={handleLogout} sx={{ color: '#fff' }} title="Logout">
            <LogoutIcon />
          </IconButton>
        </Stack>

        <Paper elevation={6} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
          <StepDots active={step} />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
              {subtitle}
            </Typography>
          )}

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {children}

          {footer && <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #eee' }}>{footer}</Box>}
        </Paper>

        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2, color: '#ffffffaa' }}>
          Step-by-step onboarding · Secure · One screen at a time
        </Typography>
      </Container>
    </Box>
  );
}
