import React, { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../theme/brand';
import {
  isHiddenAuthGateUnlocked,
  unlockHiddenAuthGate,
  verifyHiddenAuthPassword,
} from '../utils/hiddenAuthGate';

export default function HiddenAuthRouteGate({ children }) {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(isHiddenAuthGateUnlocked());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const checkPassword = async () => {
    setError('');
    if (!password.trim()) {
      setError('Enter password');
      return;
    }
    const ok = await verifyHiddenAuthPassword(password);
    if (!ok) {
      setError('Invalid password');
      return;
    }
    unlockHiddenAuthGate();
    setUnlocked(true);
    setPassword('');
  };

  if (unlocked) return children;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.canvas }}>
      <Dialog
        open
        disableEscapeKeyDown
        onClose={() => {}}
        PaperProps={{ sx: { borderRadius: 2, width: 'min(92vw, 420px)' } }}
      >
        <DialogTitle sx={{ fontFamily: brand.fontDisplay, fontWeight: 600 }}>
          Secure access
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            type="password"
            margin="dense"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={Boolean(error)}
            helperText={error || 'Enter access password'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                checkPassword();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => navigate('/')} sx={{ color: brand.muted }}>
            Cancel
          </Button>
          <Button variant="contained" color="secondary" onClick={checkPassword}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
