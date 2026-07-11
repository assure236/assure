import React from 'react';
import { Box, Container, Paper, Stack, LinearProgress, Typography, IconButton } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { brand } from '../../theme/brand';

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
                bgcolor: done ? brand.success : here ? brand.navy : brand.mist,
                color: done || here ? '#fff' : brand.muted,
                fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                border: here ? `2px solid ${brand.gold}` : 'none',
              }}
            >{done ? '\u2713' : i + 1}</Box>
            {i < STEP_ORDER.length - 1 && (
              <Box sx={{ width: 18, height: 2, bgcolor: done ? brand.success : brand.mist }} />
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
      background: `
        radial-gradient(ellipse 70% 45% at 15% 0%, rgba(201,162,39,0.22), transparent 50%),
        radial-gradient(ellipse 55% 40% at 90% 10%, rgba(30,58,138,0.25), transparent 45%),
        linear-gradient(165deg, ${brand.navyDeep} 0%, ${brand.navy} 50%, ${brand.navyMid} 100%)
      `,
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
            <Typography sx={{ color: '#fff', fontFamily: brand.fontDisplay, fontWeight: 600, fontSize: 20 }}>
              Assure ChitFunds
            </Typography>
          </Box>
          <IconButton onClick={handleLogout} sx={{ color: '#fff' }} title="Logout">
            <LogoutIcon />
          </IconButton>
        </Stack>

        <Paper elevation={0} sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          border: `1px solid ${brand.line}`,
          boxShadow: brand.shadowLift,
        }}>
          <StepDots active={step} />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: brand.navy }}>
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
