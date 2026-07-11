import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppBar, Box, Button, Collapse, Container, Divider, Drawer, IconButton,
  List, ListItemButton, ListItemText, Stack, Toolbar, Typography,
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

const CLOSE_DELAY = 220;

function Logo({ onClick, light = true }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        cursor: 'pointer',
        minWidth: 0,
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
        sx={{ width: 40, height: 40, objectFit: 'contain' }}
      />
      <Box minWidth={0}>
        <Typography
          sx={{
            fontFamily: brand.fontDisplay,
            fontWeight: 600,
            fontSize: { xs: 17, sm: 19 },
            color: light ? '#fff' : brand.navy,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          Assure
        </Typography>
        <Typography
          sx={{
            color: light ? brand.goldSoft : brand.goldDark,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          ChitFunds
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Hover/click dropdown with NO dead zone between trigger and panel — the panel
 * sits flush against the trigger (top: 100%, zero gap) so the pointer never
 * leaves a hoverable element while moving down into it. Visibility is driven by
 * React state (not bare CSS :hover) so a short close-delay survives the diagonal
 * mouse move, and clicking the label always navigates immediately.
 */
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
              fontSize: 16,
              transition: 'transform 0.18s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        }
        sx={{
          color: active || isOpen ? brand.goldSoft : 'rgba(255,255,255,0.82)',
          fontWeight: 700,
          fontSize: 13,
          px: 1.15,
          py: 1,
          textTransform: 'none',
          borderRadius: 2,
          minWidth: 0,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' },
        }}
      >
        {item.label}
      </Button>

      {/* Flush-fit panel: top starts exactly at 100%, no gap, so hover never breaks. */}
      <Box
        className="mkt-dropdown"
        onMouseEnter={onCancelClose}
        sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          pt: 1,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transform: isOpen ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.16s ease, transform 0.16s ease, visibility 0.16s',
          pointerEvents: isOpen ? 'auto' : 'none',
          zIndex: 40,
        }}
      >
        <Box
          sx={{
            minWidth: item.columns.length > 1 ? 480 : 300,
            p: 1.25,
            borderRadius: 2.5,
            bgcolor: 'rgba(7, 20, 40, 0.98)',
            border: '1px solid rgba(201,162,39,0.22)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.45)',
            display: 'grid',
            gridTemplateColumns: item.columns.length > 1 ? '1fr 1fr' : '1fr',
            gap: 1,
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
                    borderRadius: 1.5,
                    textDecoration: 'none',
                    color: 'rgba(255,255,255,0.78)',
                    transition: 'background 0.15s ease, color 0.15s ease',
                    '&:hover': {
                      bgcolor: 'rgba(201,162,39,0.12)',
                      color: brand.goldSoft,
                    },
                  }}
                >
                  <Typography fontWeight={700} fontSize={13.5} color="inherit">
                    {link.label}
                  </Typography>
                  <Typography fontSize={11.5} sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.25 }}>
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
      <Container maxWidth="xl">
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
                      fontWeight: 600,
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
      </Container>
    </Box>
  );
}

export default function MarketingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState('');
  const [openNavId, setOpenNavId] = useState('');
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

  // Close the open dropdown whenever the route changes (after a click navigation).
  useEffect(() => {
    setOpenNavId('');
  }, [location.pathname]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const isActiveGroup = (item) =>
    location.pathname === item.path ||
    location.pathname.startsWith(`${item.path}/`) ||
    item.columns.some((c) => c.links.some((l) => location.pathname === l.path));

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
          bgcolor: 'rgba(7, 20, 40, 0.94)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(201,162,39,0.16)',
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1280,
            width: '100%',
            mx: 'auto',
            px: { xs: 2, md: 3 },
            minHeight: { xs: 64, md: 72 },
            gap: 1,
          }}
        >
          <Logo onClick={() => navigate('/')} />
          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 0.1 }}>
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

          {/* Tablet / mobile: single trigger into the same drawer */}
          <IconButton
            sx={{ display: { xs: 'inline-flex', lg: 'none' }, color: '#fff', ml: 0.5 }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </IconButton>

          <Stack direction="row" spacing={1} sx={{ ml: 1, display: { xs: 'none', sm: 'flex' } }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/login')}
              sx={{
                borderColor: 'rgba(255,255,255,0.28)',
                color: '#fff',
                fontWeight: 700,
                '&:hover': { borderColor: brand.gold, color: brand.goldSoft },
              }}
            >
              Login
            </Button>
            <Button
              variant="contained"
              size="small"
              color="secondary"
              onClick={() => navigate('/register')}
              sx={{ fontWeight: 800 }}
            >
              Join Free
            </Button>
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
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 700 }} />
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
                          primaryTypographyProps={{ fontSize: 14, fontWeight: 700, color: '#fff' }}
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
        <Box sx={{ p: 2, mt: 'auto', display: 'grid', gap: 1 }}>
          <Button fullWidth variant="outlined" onClick={() => { setMobileOpen(false); navigate('/login'); }}
            sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
            Login
          </Button>
          <Button fullWidth variant="contained" color="secondary" onClick={() => { setMobileOpen(false); navigate('/register'); }}>
            Join Free
          </Button>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <MarketingFooter />
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
            radial-gradient(ellipse 70% 60% at 10% 0%, rgba(201,162,39,0.18), transparent 50%),
            linear-gradient(165deg, ${brand.navyDeep} 0%, ${brand.navy} 55%, ${brand.navyMid} 100%)
          `,
          color: '#fff',
          pt: { xs: 5, md: 7 },
          pb: { xs: 5, md: 6 },
        }}
      >
        <Container maxWidth={narrow ? 'md' : 'lg'}>
          {eyebrow && (
            <Typography variant="overline" sx={{ color: brand.goldSoft, display: 'block', mb: 1 }}>
              {eyebrow}
            </Typography>
          )}
          <Typography
            sx={{
              fontFamily: brand.fontDisplay,
              fontWeight: 600,
              fontSize: { xs: '2rem', md: '2.6rem' },
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              mb: subtitle ? 1.5 : 0,
              maxWidth: 720,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 16.5, lineHeight: 1.7, maxWidth: 620 }}>
              {subtitle}
            </Typography>
          )}
          {actions && <Box mt={3}>{actions}</Box>}
        </Container>
      </Box>
      <Container maxWidth={narrow ? 'md' : 'lg'} sx={{ py: { xs: 4, md: 6 } }}>
        {children}
      </Container>
    </Box>
  );
}
