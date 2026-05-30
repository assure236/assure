import React, { useEffect, useState, useRef } from 'react';
import { Popover, Box, Typography, Button, Stack, LinearProgress } from '@mui/material';

/**
 * Lightweight MUI-based product tour.
 * Pass `steps`: [{ selector: '#id', title, body, placement: 'bottom'|'right'|... }]
 * Calls `onDone()` when finished or skipped.
 */
export default function SimpleTour({ steps, onDone }) {
  const [idx, setIdx] = useState(0);
  const [anchor, setAnchor] = useState(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const step = steps[idx];
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setAnchor(el), 350);
    } else {
      setAnchor(null);
      setTimeout(() => next(), 500); // skip missing target
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const finish = () => {
    visibleRef.current = false;
    setAnchor(null);
    onDone?.();
  };

  const next = () => {
    if (idx + 1 >= steps.length) finish();
    else setIdx(idx + 1);
  };

  if (!steps || !steps.length) return null;
  const step = steps[idx];

  return (
    <Popover
      open={!!anchor && visibleRef.current}
      anchorEl={anchor}
      onClose={() => {}}
      anchorOrigin={{ vertical: step.placement === 'top' ? 'top' : 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: step.placement === 'top' ? 'bottom' : 'top', horizontal: 'center' }}
      disableRestoreFocus
      slotProps={{ paper: { sx: { p: 2, maxWidth: 320, borderRadius: 2, boxShadow: 6, border: '1px solid', borderColor: 'primary.light' } } }}
    >
      <Stack spacing={1}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {step.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {step.body}
        </Typography>
        <LinearProgress variant="determinate" value={((idx + 1) / steps.length) * 100} sx={{ borderRadius: 1 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
          <Button size="small" color="inherit" onClick={finish}>Skip tour</Button>
          <Box>
            <Typography variant="caption" sx={{ mr: 1 }}>{idx + 1} / {steps.length}</Typography>
            <Button size="small" variant="contained" onClick={next}>
              {idx + 1 >= steps.length ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Popover>
  );
}
