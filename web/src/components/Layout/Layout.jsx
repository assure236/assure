import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Badge,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Gavel as GavelIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  CardGiftcard as CardGiftcardIcon,
  Help as HelpIcon,
  Notifications as NotifIcon,
  Logout as LogoutIcon,
  BarChart as AnalyticsIcon,
  FamilyRestroom as FamilyIcon,
  AccountBalance as LoanIcon,
  SupportAgent as SupportIcon,
  Flag as GoalsIcon,
  VerifiedUser as KycIcon,
  Description as DocumentsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { useDisplayUser } from '../../hooks/useDisplayUser';
import Chatbot from '../Chatbot/Chatbot';
import MemberSwitcher from '../MemberSwitcher';
import { brand } from '../../theme/brand';
import axios from 'axios';

const drawerWidth = brand.drawerWidth;

const navGroups = [
  {
    label: 'Overview',
    items: [
      { text: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/dashboard' },
      { text: 'Analytics', icon: <AnalyticsIcon fontSize="small" />, path: '/analytics' },
    ],
  },
  {
    label: 'Chits & Money',
    items: [
      { text: 'My Chit Groups', icon: <GroupIcon fontSize="small" />, path: '/chit-groups' },
      { text: 'Auctions', icon: <GavelIcon fontSize="small" />, path: '/auctions' },
      { text: 'Transactions', icon: <PaymentIcon fontSize="small" />, path: '/payments' },
      { text: 'Goals', icon: <GoalsIcon fontSize="small" />, path: '/goals' },
      { text: 'Loans', icon: <LoanIcon fontSize="small" />, path: '/loans' },
    ],
  },
  {
    label: 'Account',
    items: [
      { text: 'KYC', icon: <KycIcon fontSize="small" />, path: '/kyc' },
      { text: 'Documents', icon: <DocumentsIcon fontSize="small" />, path: '/documents' },
      { text: 'Family Members', icon: <FamilyIcon fontSize="small" />, path: '/family-members' },
      { text: 'Referrals', icon: <CardGiftcardIcon fontSize="small" />, path: '/referrals' },
      { text: 'Notifications', icon: <NotifIcon fontSize="small" />, path: '/notifications' },
    ],
  },
  {
    label: 'Help',
    items: [
      { text: 'Support', icon: <SupportIcon fontSize="small" />, path: '/support' },
      { text: 'Help Center', icon: <HelpIcon fontSize="small" />, path: '/help' },
    ],
  },
];

const pageTitleFromPath = (pathname) => {
  const flat = navGroups.flatMap((g) => g.items);
  const hit = flat.find(
    (item) =>
      pathname === item.path ||
      (item.path !== '/dashboard' && pathname.startsWith(item.path))
  );
  if (pathname.startsWith('/profile')) return 'Profile';
  return hit?.text || 'Member Portal';
};

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const displayUser = useDisplayUser();
  const { refreshKey, isSwitched, activeMemberId, profileLoading } = useActiveMember();

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await axios.get('/notifications?unread=true&limit=1');
        if (res.data.success) setUnreadCount(res.data.data.total || 0);
      } catch { /* ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };
  const handleProfileMenuClose = () => setAnchorEl(null);
  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          px: 2.25,
          py: 2.5,
          background: `linear-gradient(160deg, ${brand.navyDeep} 0%, ${brand.navy} 55%, ${brand.navyMid} 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 90% 10%, rgba(201,162,39,0.28), transparent 45%), radial-gradient(circle at 10% 90%, rgba(30,58,138,0.35), transparent 40%)',
            pointerEvents: 'none',
          }}
        />
        <Box display="flex" alignItems="center" gap={1.5} position="relative">
          <Box
            component="img"
            src="/logo.png"
            alt="Assure ChitFunds"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = '/build/logo.png';
            }}
            sx={{
              width: 40,
              height: 40,
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))',
            }}
          />
          <Box minWidth={0}>
            <Typography
              sx={{
                fontFamily: brand.fontDisplay,
                color: '#fff',
                fontWeight: 600,
                fontSize: 18,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              Assure
            </Typography>
            <Typography
              sx={{
                color: brand.goldSoft,
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
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 1.5 }}>
        {navGroups.map((group) => (
          <Box key={group.label} sx={{ mb: 1.75 }}>
            <Typography
              variant="overline"
              sx={{
                px: 1.25,
                color: brand.muted,
                opacity: 0.9,
                display: 'block',
                mb: 0.5,
              }}
            >
              {group.label}
            </Typography>
            <List disablePadding>
              {group.items.map((item) => {
                const active =
                  location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                return (
                  <ListItem key={item.text} disablePadding sx={{ mb: 0.35 }}>
                    <ListItemButton
                      onClick={() => handleMenuClick(item.path)}
                      selected={active}
                      sx={{
                        py: 1,
                        px: 1.25,
                        color: active ? brand.navy : brand.muted,
                        bgcolor: active ? 'rgba(201,162,39,0.12)' : 'transparent',
                        border: active ? `1px solid rgba(201,162,39,0.28)` : '1px solid transparent',
                        '& .MuiListItemIcon-root': {
                          color: active ? brand.goldDark : brand.muted,
                          minWidth: 34,
                        },
                        '&.Mui-selected:hover': {
                          bgcolor: 'rgba(201,162,39,0.18)',
                        },
                        '&:hover': {
                          bgcolor: 'rgba(11,31,59,0.04)',
                        },
                      }}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontSize: 13.5,
                          fontWeight: active ? 700 : 600,
                        }}
                      />
                      {item.path === '/notifications' && unreadCount > 0 && (
                        <Chip
                          size="small"
                          label={unreadCount > 99 ? '99+' : unreadCount}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            fontWeight: 800,
                            bgcolor: brand.navy,
                            color: '#fff',
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Box sx={{ p: 1.5, borderTop: `1px solid ${brand.line}` }}>
        <Box
          onClick={() => handleMenuClick('/profile')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: 1.25,
            borderRadius: 2,
            cursor: 'pointer',
            bgcolor: brand.mist,
            transition: 'background 0.15s ease',
            '&:hover': { bgcolor: 'rgba(11,31,59,0.08)' },
          }}
        >
          <Avatar
            alt={displayUser?.full_name}
            src={displayUser?.profile_image_url}
            sx={{ width: 36, height: 36, bgcolor: brand.navy, fontSize: 14 }}
          >
            {(displayUser?.full_name || 'M')?.charAt(0)}
          </Avatar>
          <Box minWidth={0} flex={1}>
            <Typography noWrap fontWeight={700} fontSize={13}>
              {displayUser?.full_name || 'Member'}
            </Typography>
            <Typography noWrap variant="caption" color="text.secondary">
              {displayUser?.member_id || 'View profile'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          color: brand.navy,
          bgcolor: 'rgba(243,245,248,0.78)',
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${brand.line}`,
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 68 }, gap: 1 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: brand.goldDark, display: { xs: 'none', md: 'block' }, lineHeight: 1.2 }}
            >
              Assure ChitFunds
            </Typography>
            <Typography
              noWrap
              sx={{
                fontFamily: brand.fontDisplay,
                fontWeight: 600,
                fontSize: { xs: 18, sm: 20 },
                letterSpacing: '-0.02em',
              }}
            >
              {pageTitleFromPath(location.pathname)}
            </Typography>
          </Box>
          <Box sx={{ mr: { xs: 0.5, sm: 1 }, minWidth: { xs: 110, sm: 168 } }}>
            <MemberSwitcher compact />
          </Box>
          <IconButton
            onClick={() => navigate('/notifications')}
            sx={{
              border: `1px solid ${brand.line}`,
              bgcolor: 'rgba(255,255,255,0.7)',
              borderRadius: 2,
              mr: 0.75,
            }}
          >
            <Badge badgeContent={unreadCount > 0 ? unreadCount : null} color="error" max={99}>
              <NotifIcon fontSize="small" />
            </Badge>
          </IconButton>
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              p: 0.35,
              border: `1px solid ${brand.line}`,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.7)',
            }}
          >
            <Avatar
              alt={displayUser?.full_name}
              src={displayUser?.profile_image_url}
              sx={{ width: 34, height: 34, bgcolor: brand.navy }}
            >
              {(displayUser?.full_name || activeMemberId || 'M')?.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={() => {
                handleProfileMenuClose();
                navigate('/profile');
              }}
            >
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: `1px solid ${brand.line}`,
              bgcolor: '#FBFCFD',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: `1px solid ${brand.line}`,
              bgcolor: '#FBFCFD',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        className="app-main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          pt: { xs: 10, sm: 11 },
          px: { xs: 1.5, sm: 2.5, md: 3.5 },
          pb: 4,
        }}
      >
        {isSwitched && (
          <Box
            sx={{
              mb: 2.5,
              px: 2,
              py: 1.25,
              borderRadius: 2.5,
              border: '1px solid rgba(201,162,39,0.35)',
              background: 'linear-gradient(90deg, rgba(201,162,39,0.14), rgba(255,255,255,0.7))',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              flexWrap: 'wrap',
            }}
          >
            <Chip
              size="small"
              label={`Viewing ${displayUser?.member_id || activeMemberId || 'family member'}`}
              sx={{ bgcolor: brand.navy, color: '#fff', fontWeight: 700 }}
            />
            <Typography variant="body2" color="text.secondary">
              {profileLoading
                ? 'Loading member details…'
                : `All data below is for ${displayUser?.full_name || 'the selected member'}.`}
            </Typography>
          </Box>
        )}
        <Outlet key={refreshKey} />
      </Box>
      <Chatbot />
    </Box>
  );
};

export default Layout;
