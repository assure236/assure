import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, Avatar, Menu, MenuItem,
  Divider, Tooltip, Collapse
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  Gavel as GavelIcon,
  Payment as PaymentIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  AccountBalance as AccountBalanceIcon,
  Warning as WarningIcon,
  MoneyOff as DisbursalIcon,
  Description as DocumentIcon,
  Campaign as CommunicationsIcon,
  Business as BranchIcon,
  SupportAgent as SupportIcon,
  NotificationsActive as PushNotificationIcon,
  ExpandLess, ExpandMore
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';

const drawerWidth = 260;

const navGroups = [
  {
    label: 'Core',
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
      { text: 'Members', icon: <PeopleIcon />, path: '/users' },
      { text: 'Chit Groups', icon: <GroupIcon />, path: '/chit-groups' },
      { text: 'Auctions', icon: <GavelIcon />, path: '/auctions' },
      { text: 'Payments', icon: <PaymentIcon />, path: '/payments' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { text: 'Accounting', icon: <AccountBalanceIcon />, path: '/accounting' },
      { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
      { text: 'Defaulters', icon: <WarningIcon />, path: '/defaulters' },
      { text: 'Disbursals', icon: <DisbursalIcon />, path: '/disbursals' },
    ]
  },
  {
    label: 'Compliance',
    items: [
      { text: 'Documents / KYC', icon: <DocumentIcon />, path: '/documents' },
      { text: 'Communications', icon: <CommunicationsIcon />, path: '/communications' },
      { text: 'Push Notifications', icon: <PushNotificationIcon />, path: '/push-notifications' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { text: 'Branches', icon: <BranchIcon />, path: '/branches' },
      { text: 'Support', icon: <SupportIcon />, path: '/support' },
    ]
  },
  {
    label: 'System',
    items: [
      { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ]
  },
];

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleMenuClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (label) => setCollapsed(p => ({ ...p, [label]: !p[label] }));

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0B1F3B' }}>
      <Toolbar sx={{ bgcolor: '#071428', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 34, height: 34 }} />
          <Box>
            <Typography variant="h6" noWrap fontWeight={700} color="white" sx={{ fontSize: 16, letterSpacing: '-0.3px' }}>Assure ChitFunds</Typography>
            <Typography variant="caption" sx={{ color: '#D4AF37', fontWeight: 500, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Admin Panel</Typography>
          </Box>
        </Box>
      </Toolbar>
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
        {navGroups.map((group, gi) => (
          <Box key={group.label}>
            {gi > 0 && <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />}
            <ListItemButton onClick={() => toggleGroup(group.label)} sx={{ py: 0.5, px: 2 }}>
              <ListItemText
                primary={group.label}
                primaryTypographyProps={{ variant: 'caption', fontWeight: 700, color: 'rgba(212,175,55,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 10 }}
              />
              {collapsed[group.label] ? <ExpandMore fontSize="small" sx={{ color: 'rgba(255,255,255,0.3)' }} /> : <ExpandLess fontSize="small" sx={{ color: 'rgba(255,255,255,0.3)' }} />}
            </ListItemButton>
            <Collapse in={!collapsed[group.label]} timeout="auto">
              <List disablePadding>
                {group.items.map(item => {
                  const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <ListItem key={item.text} disablePadding>
                      <ListItemButton
                        onClick={() => handleMenuClick(item.path)}
                        selected={isActive}
                        sx={{
                          pl: 3, py: 0.75, mx: 1, borderRadius: 1.5,
                          color: 'rgba(255,255,255,0.65)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'white' },
                          '&.Mui-selected': { bgcolor: 'rgba(212,175,55,0.15)', color: '#D4AF37', borderRight: 'none' },
                          '&.Mui-selected:hover': { bgcolor: 'rgba(212,175,55,0.2)' },
                          '&.Mui-selected .MuiListItemIcon-root': { color: '#D4AF37' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 34, color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.4)' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }} />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` }, bgcolor: 'white', color: '#0B1F3B' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600, color: '#0B1F3B' }}>
            Assure Chit Funds — Admin
          </Typography>
          <Tooltip title={user?.full_name || 'Admin'}>
            <Avatar sx={{ cursor: 'pointer', bgcolor: '#D4AF37', color: '#0B1F3B', fontWeight: 700 }} onClick={(e) => setAnchorEl(e.currentTarget)}>
              {(user?.full_name || 'A').charAt(0).toUpperCase()}
            </Avatar>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent"
          sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }} open>
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
