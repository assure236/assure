import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { brand } from '../../theme/brand';

/** Standard page frame used across the member portal. */
export function PageShell({ children, maxWidth = 1180, sx }) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth,
        mx: 'auto',
        px: { xs: 0.5, sm: 1 },
        pb: 4,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}) {
  return (
    <Box
      sx={{
        mb: 3,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { md: 'flex-end' },
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <Typography
            variant="overline"
            sx={{ color: brand.goldDark, display: 'block', mb: 0.5 }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography
          variant="h4"
          sx={{
            color: brand.navy,
            lineHeight: 1.15,
            mb: subtitle ? 0.75 : 0,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, lineHeight: 1.55 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {actions}
        </Stack>
      )}
    </Box>
  );
}

export function Surface({ children, sx, padded = true, accent = false, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: `${brand.radius}px`,
        border: `1px solid ${brand.line}`,
        backgroundColor: 'rgba(255,255,255,0.82)',
        boxShadow: brand.shadowSoft,
        backdropFilter: 'blur(8px)',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...(onClick
          ? {
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: brand.shadowLift,
                borderColor: 'rgba(201,162,39,0.45)',
              },
            }
          : null),
        ...(accent
          ? {
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: `linear-gradient(180deg, ${brand.gold}, ${brand.navy})`,
              },
            }
          : null),
        p: padded ? { xs: 2, sm: 2.5 } : 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function MetricTile({ label, value, hint, icon, onClick, tone = 'navy' }) {
  const tones = {
    navy: { ink: brand.navy, wash: 'rgba(11,31,59,0.06)' },
    gold: { ink: brand.goldDark, wash: 'rgba(201,162,39,0.12)' },
    green: { ink: brand.success, wash: 'rgba(21,128,61,0.08)' },
    blue: { ink: brand.royal, wash: 'rgba(30,58,138,0.08)' },
  };
  const t = tones[tone] || tones.navy;

  return (
    <Surface onClick={onClick} sx={{ height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
        <Box minWidth={0}>
          <Typography variant="overline" sx={{ color: brand.muted, letterSpacing: '0.08em' }}>
            {label}
          </Typography>
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              fontWeight: 600,
              fontSize: { xs: '1.45rem', sm: '1.65rem' },
              color: brand.navy,
              lineHeight: 1.2,
              mt: 0.5,
              wordBreak: 'break-word',
            }}
          >
            {value}
          </Typography>
          {hint && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {hint}
            </Typography>
          )}
        </Box>
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: t.wash,
              color: t.ink,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
      </Box>
    </Surface>
  );
}

export function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 5,
        px: 2,
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 64,
            height: 64,
            mx: 'auto',
            mb: 2,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: brand.mist,
            color: brand.navy,
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="h6" sx={{ mb: 0.75 }}>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: 'auto', mb: actionLabel ? 2 : 0 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>{actionLabel}</Button>
      )}
    </Box>
  );
}

export function SectionTitle({ title, action }) {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={2}>
      <Typography variant="h6">{title}</Typography>
      {action}
    </Box>
  );
}
