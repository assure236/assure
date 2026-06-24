import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Badge,
  Box,
  CssBaseline,
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
  Divider
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Gavel as GavelIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  CardGiftcard as CardGiftcardIcon,
  Help as HelpIcon,
  Notifications as NotifIcon,
  Logout as LogoutIcon,
  BarChart as AnalyticsIcon,
  FamilyRestroom as FamilyIcon,
  AccountBalance as LoanIcon,
  SupportAgent as SupportIcon,
  Flag as GoalsIcon,
  VerifiedUser as KycIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { useDisplayUser } from '../../hooks/useDisplayUser';
import Chatbot from '../Chatbot/Chatbot';
import MemberSwitcher from '../MemberSwitcher';
import axios from 'axios';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'My Chit Groups', icon: <GroupIcon />, path: '/chit-groups' },
  { text: 'Auctions', icon: <GavelIcon />, path: '/auctions' },
  { text: 'Payments', icon: <PaymentIcon />, path: '/payments' },
  { text: 'Goals', icon: <GoalsIcon />, path: '/goals' },
  { text: 'KYC', icon: <KycIcon />, path: '/kyc' },
  { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  { text: 'Loans', icon: <LoanIcon />, path: '/loans' },
  { text: 'Documents', icon: <DescriptionIcon />, path: '/documents' },
  { text: 'Notifications', icon: <NotifIcon />, path: '/notifications' },
  { text: 'Family Members', icon: <FamilyIcon />, path: '/family-members' },
  { text: 'Support', icon: <SupportIcon />, path: '/support' },
  { text: 'Referrals', icon: <CardGiftcardIcon />, path: '/referrals' },
  { text: 'Help Center', icon: <HelpIcon />, path: '/help' }
];

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const displayUser = useDisplayUser();
  const { refreshKey } = useActiveMember();

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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate('/login');
  };

  const drawer = (
    <div>
      <Toolbar sx={{ bgcolor: '#0B1F3B', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Assure"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/build/logo.png';
          }}
          sx={{ width: 32, height: 32, mr: 1.5, objectFit: 'contain' }}
        />
        <Box>
          <Typography variant="h6" noWrap fontWeight={700} sx={{ color: 'white', fontSize: 15 }}>
            Assure Chits
          </Typography>
          <Typography variant="caption" sx={{ color: '#D4AF37', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
            Member Portal
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 0.5, py: 1 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => handleMenuClick(item.path)}
                selected={active}
                sx={{
                  '&.Mui-selected': { bgcolor: '#0B1F3B', color: 'white', '& .MuiListItemIcon-root': { color: '#D4AF37' } },
                  '&.Mui-selected:hover': { bgcolor: '#1E3A8A' },
                  '&:hover': { bgcolor: 'rgba(11,31,59,0.06)' },
                  borderRadius: 1.5, mx: 0.5, mb: 0.25
                }}
              >
                <ListItemIcon sx={{ color: active ? '#D4AF37' : '#475569', minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'white',
          color: '#0B1F3B',
          boxShadow: '0 1px 3px rgba(11,31,59,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Member Portal
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'block' }, mr: 2 }}>
            <MemberSwitcher compact />
          </Box>
          <IconButton color="inherit" onClick={() => navigate('/notifications')} sx={{ mr: 1 }}>
            <Badge badgeContent={unreadCount > 0 ? unreadCount : null} color="error" max={99}>
              <NotifIcon />
            </Badge>
          </IconButton>
          <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }}>
            <Avatar alt={displayUser?.full_name} src={displayUser?.profile_image_url}>
              {displayUser?.full_name?.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/profile'); }}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8
        }}
      >
        <Outlet key={refreshKey} />
      </Box>
      <Chatbot />
    </Box>
  );
};

export default Layout;
