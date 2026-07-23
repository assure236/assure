import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppBar, Box, Button, Collapse, Divider, Drawer, IconButton,
  List, ListItemButton, ListItemText, Stack, Toolbar, Typography,
  Dialog, DialogActions, DialogContent, DialogTitle, TextField,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandLess,
  ExpandMore,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { footerColumns, marketingNav } from './navConfig';
import { marketingShellSx } from './marketingShell';
import {
  isHiddenAuthGateUnlocked,
  unlockHiddenAuthGate,
  verifyHiddenAuthPassword,
} from '../../utils/hiddenAuthGate';

const CLOSE_DELAY = 220;

function Logo({ onClick, light = true }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.15,
        cursor: 'pointer',
        minWidth: 0,
        flexShrink: 0,
      }}
    >
      <Box
        component="img"
        src="/logo.png"
        alt="Assure ChitFunds"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/build/logo.png';
        }}
        sx={{ width: 38, height: 38, objectFit: 'contain' }}
      />
      <Box minWidth={0}>
        <Typography
          sx={{
            fontFamily: brand.fontDisplay,
            fontWeight: 600,
            fontSize: { xs: 17, sm: 18 },
            color: light ? '#fff' : brand.navy,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}
        >
          Assure
        </Typography>
        <Typography
          sx={{
            color: light ? brand.goldSoft : brand.goldDark,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontFamily: brand.fontBody,
          }}
        >
          ChitFunds
        </Typography>
      </Box>
    </Box>
  );
}

function DesktopDropdown({ item, active, isOpen, onOpen, onScheduleClose, onCancelClose }) {
  return (
    <Box
      className="mkt-nav-item"
      onMouseEnter={onOpen}
      onMouseLeave={onScheduleClose}
      sx={{ position: 'relative' }}
    >
      <Button
        component={RouterLink}
        to={item.path}
        onClick={onOpen}
        endIcon={
          <ExpandMore
            sx={{
              fontSize: 15,
              transition: 'transform 0.18s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        }
        sx={{
          color: active || isOpen ? brand.goldSoft : 'rgba(255,255,255,0.78)',
          fontWeight: 600,
          fontSize: 13.5,
          px: 1.25,
          py: 1,
          textTransform: 'none',
          borderRadius: 1.5,
          minWidth: 0,
          letterSpacing: '0.01em',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' },
        }}
      >
        {item.label}
      </Button>

      <Box
        className="mkt-dropdown"
        onMouseEnter={onCancelClose}
        sx={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: isOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(6px)',
          pt: 1,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.16s ease, transform 0.16s ease, visibility 0.16s',
          pointerEvents: isOpen ? 'auto' : 'none',
          zIndex: 40,
        }}
      >
        <Box
          sx={{
            minWidth: item.columns.length > 1 ? 460 : 280,
            p: 1.5,
            borderRadius: 2,
            bgcolor: '#0A1628',
            border: '1px solid rgba(201,162,39,0.2)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
            display: 'grid',
            gridTemplateColumns: item.columns.length > 1 ? '1fr 1fr' : '1fr',
            gap: 0.75,
          }}
        >
          {item.columns.map((col) => (
            <Box key={col.heading}>
              <Typography
                variant="overline"
                sx={{ px: 1.25, color: brand.gold, display: 'block', mb: 0.5 }}
              >
                {col.heading}
              </Typography>
              {col.links.map((link) => (
                <Box
                  key={link.path}
                  component={RouterLink}
                  to={link.path}
                  onClick={onCancelClose}
                  sx={{
                    display: 'block',
                    px: 1.25,
                    py: 1,
                    borderRadius: 1.25,
                    textDecoration: 'none',
                    color: 'rgba(255,255,255,0.78)',
                    transition: 'background 0.15s ease, color 0.15s ease',
                    '&:hover': {
                      bgcolor: 'rgba(201,162,39,0.1)',
                      color: brand.goldSoft,
                    },
                  }}
                >
                  <Typography fontWeight={600} fontSize={13.5} color="inherit">
                    {link.label}
                  </Typography>
                  <Typography fontSize={12} sx={{ color: 'rgba(255,255,255,0.42)', mt: 0.2, lineHeight: 1.4 }}>
                    {link.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function MarketingFooter() {
  const navigate = useNavigate();
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        bgcolor: brand.navyDeep,
        color: 'rgba(255,255,255,0.78)',
        borderTop: '1px solid rgba(201,162,39,0.18)',
        pt: 6,
        pb: 3,
      }}
    >
      <Box className="mkt-shell" sx={marketingShellSx}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr 1fr 1fr 1fr' },
            gap: 4,
            mb: 4,
          }}
        >
          <Box>
            <Logo onClick={() => navigate('/')} />
            <Typography sx={{ mt: 2, fontSize: 14, lineHeight: 1.7, maxWidth: 280, color: 'rgba(255,255,255,0.55)' }}>
              Digital chit funds for disciplined savers — transparent auctions, clear installments, and a member portal built for everyday use.
            </Typography>
          </Box>
          {footerColumns.map((col) => (
            <Box key={col.heading}>
              <Typography variant="overline" sx={{ color: brand.gold, display: 'block', mb: 1.5 }}>
                {col.heading}
              </Typography>
              <Stack spacing={1}>
                {col.links.map((l) => (
                  <Typography
                    key={l.path}
                    component={RouterLink}
                    to={l.path}
                    sx={{
                      color: 'rgba(255,255,255,0.65)',
                      textDecoration: 'none',
                      fontSize: 13.5,
                      fontWeight: 500,
                      '&:hover': { color: brand.goldSoft },
                    }}
                  >
                    {l.label}
                  </Typography>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2.5 }} />
        <Box
          display="flex"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={1.5}
          alignItems="center"
        >
          <Typography fontSize={12.5} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            © {new Date().getFullYear()} Assure ChitFunds. All rights reserved. Hyderabad, Telangana.
          </Typography>
          <Typography fontSize={12.5} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            support@assure.fund
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function MarketingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState('');
  const [openNavId, setOpenNavId] = useState('');
  const [gateOpen, setGateOpen] = useState(false);
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const closeTimer = useRef(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openNav = useCallback((id) => {
    clearCloseTimer();
    setOpenNavId(id);
  }, [clearCloseTimer]);

  const scheduleCloseNav = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenNavId(''), CLOSE_DELAY);
  }, [clearCloseTimer]);

  useEffect(() => {
    setOpenNavId('');
  }, [location.pathname]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const isActiveGroup = (item) =>
    location.pathname === item.path ||
    location.pathname.startsWith(`${item.path}/`) ||
    item.columns.some((c) => c.links.some((l) => location.pathname === l.path));

  const checkGatePassword = async () => {
    setGateError('');
    const normalized = gatePassword.trim();
    if (!normalized) {
      setGateError('Enter password');
      return;
    }
    const ok = await verifyHiddenAuthPassword(normalized);
    if (ok) {
      unlockHiddenAuthGate();
      setGateUnlocked(true);
      setGatePassword('');
      return;
    }
    setGateError('Invalid password');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: brand.canvas,
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(7, 20, 40, 0.96)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Same rail as hero content — logo left edge = content left, CTAs right = content right */}
        <Toolbar
          disableGutters
          className="mkt-shell"
          sx={{
            ...marketingShellSx,
            position: 'relative',
            minHeight: { xs: 64, md: 70 },
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          {/* LEFT — logo */}
          <Logo onClick={() => navigate('/')} />

          {/* CENTER — tabs absolutely centered in the rail */}
          <Box
            sx={{
              display: { xs: 'none', lg: 'flex' },
              alignItems: 'center',
              gap: 0.25,
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {marketingNav.map((item) => (
              <DesktopDropdown
                key={item.id}
                item={item}
                active={isActiveGroup(item)}
                isOpen={openNavId === item.id}
                onOpen={() => openNav(item.id)}
                onScheduleClose={scheduleCloseNav}
                onCancelClose={clearCloseTimer}
              />
            ))}
          </Box>

          {/* RIGHT — mobile menu */}
          <Stack direction="row" spacing={1} sx={{ ml: 'auto', alignItems: 'center' }}>
            <IconButton
              sx={{ display: { xs: 'inline-flex', lg: 'none' }, color: '#fff' }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: { width: 'min(100%, 360px)', bgcolor: brand.navyDeep, color: '#fff' },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo onClick={() => { setMobileOpen(false); navigate('/'); }} />
          <IconButton sx={{ color: '#fff' }} onClick={() => setMobileOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List sx={{ px: 1 }}>
          {marketingNav.map((item) => {
            const open = openGroup === item.id;
            return (
              <Box key={item.id}>
                <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                  <ListItemButton
                    onClick={() => { setMobileOpen(false); navigate(item.path); }}
                    sx={{ borderRadius: 2, flex: 1 }}
                  >
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
                  </ListItemButton>
                  <IconButton
                    onClick={() => setOpenGroup(open ? '' : item.id)}
                    sx={{ color: '#fff' }}
                    aria-label={`Toggle ${item.label} submenu`}
                  >
                    {open ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                <Collapse in={open}>
                  <List disablePadding sx={{ pl: 1.5, pb: 1 }}>
                    {item.columns.flatMap((c) => c.links).map((link) => (
                      <ListItemButton
                        key={link.path}
                        onClick={() => { setMobileOpen(false); navigate(link.path); }}
                        sx={{ borderRadius: 1.5, py: 0.75 }}
                      >
                        <ListItemText
                          primary={link.label}
                          secondary={link.desc}
                          primaryTypographyProps={{ fontSize: 14, fontWeight: 600, color: '#fff' }}
                          secondaryTypographyProps={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <MarketingFooter />
      <Box
        component="button"
        type="button"
        aria-label="Open secure access"
        onClick={() => {
          setGateOpen(true);
          setGateUnlocked(isHiddenAuthGateUnlocked());
          setGateError('');
          setGatePassword('');
        }}
        sx={{
          position: 'fixed',
          left: 14,
          bottom: 14,
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: 'none',
          p: 0,
          bgcolor: 'rgba(11,31,59,0.8)',
          cursor: 'pointer',
          zIndex: 1305,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
          '&:hover': { bgcolor: brand.goldDark },
        }}
      />
      <Dialog
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        PaperProps={{ sx: { borderRadius: 2, width: 'min(92vw, 420px)' } }}
      >
        <DialogTitle sx={{ fontFamily: brand.fontDisplay, fontWeight: 600 }}>
          Secure access
        </DialogTitle>
        <DialogContent>
          {!gateUnlocked ? (
            <TextField
              autoFocus
              fullWidth
              type="password"
              margin="dense"
              label="Password"
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              error={Boolean(gateError)}
              helperText={gateError || 'Enter access password'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  checkGatePassword();
                }
              }}
            />
          ) : (
            <Stack spacing={1.2} sx={{ pt: 0.5 }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => {
                  setGateOpen(false);
                  navigate('/login');
                }}
              >
                Go to Login
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setGateOpen(false);
                  navigate('/register');
                }}
              >
                Go to Signup
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!gateUnlocked ? (
            <Button onClick={checkGatePassword} variant="contained" color="secondary">
              Continue
            </Button>
          ) : (
            <Button
              onClick={() => {
                setGateUnlocked(false);
                setGateOpen(false);
              }}
            >
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Shared inner page chrome for marketing content pages. */
export function MarketingPage({
  eyebrow,
  title,
  subtitle,
  children,
  actions,
  narrow = false,
}) {
  return (
    <Box>
      <Box
        sx={{
          background: `
            radial-gradient(ellipse 70% 60% at 10% 0%, rgba(201,162,39,0.14), transparent 50%),
            linear-gradient(165deg, ${brand.navyDeep} 0%, ${brand.navy} 55%, ${brand.navyMid} 100%)
          `,
          color: '#fff',
          pt: { xs: 5, md: 6.5 },
          pb: { xs: 5, md: 5.5 },
        }}
      >
        <Box
          className={narrow ? 'mkt-shell mkt-shell--narrow' : 'mkt-shell'}
          sx={{ ...marketingShellSx, ...(narrow ? { maxWidth: 720 } : {}) }}
        >
          {eyebrow && (
            <Typography variant="overline" sx={{ color: brand.goldSoft, display: 'block', mb: 1 }}>
              {eyebrow}
            </Typography>
          )}
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              fontWeight: 700,
              fontSize: { xs: '2.5rem', md: '3rem' },
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              mb: subtitle ? 1.5 : 0,
              maxWidth: 720,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontFamily: brand.fontBody, fontWeight: 400, color: 'rgba(255,255,255,0.68)', fontSize: { xs: 17, md: 19 }, lineHeight: 1.6, maxWidth: 620 }}>
              {subtitle}
            </Typography>
          )}
          {actions && <Box mt={3}>{actions}</Box>}
        </Box>
      </Box>
      <Box
        className={narrow ? 'mkt-shell mkt-shell--narrow' : 'mkt-shell'}
        sx={{ ...marketingShellSx, ...(narrow ? { maxWidth: 720 } : {}), py: { xs: 4, md: 5.5 } }}
      >
        {children}
      </Box>
    </Box>
  );
}
