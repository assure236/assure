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
      { text: 'Defaulters', icon: <WarningIcon />, path: '/defaulters' },
      { text: 'Disbursals', icon: <DisbursalIcon />, path: '/disbursals' },
    ]
  },
  {
    label: 'Compliance',
    items: [
      { text: 'Documents / KYC', icon: <DocumentIcon />, path: '/documents' },
      { text: 'Communications', icon: <CommunicationsIcon />, path: '/communications' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { text: 'Branches', icon: <BranchIcon />, path: '/branches' },
      { text: 'Support', icon: <SupportIcon />, path: '/support' },
      { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ bgcolor: 'primary.main' }}>
        <Box>
          <Typography variant="h6" noWrap fontWeight={700} color="white">Assure ChitFunds</Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.7)">Admin Panel</Typography>
        </Box>
      </Toolbar>
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {navGroups.map((group, gi) => (
          <Box key={group.label}>
            {gi > 0 && <Divider sx={{ my: 0.5 }} />}
            <ListItemButton onClick={() => toggleGroup(group.label)} sx={{ py: 0.5, px: 2 }}>
              <ListItemText
                primary={group.label}
                primaryTypographyProps={{ variant: 'caption', fontWeight: 700, color: 'text.secondary', letterSpacing: 1, textTransform: 'uppercase' }}
              />
              {collapsed[group.label] ? <ExpandMore fontSize="small" sx={{ color: 'text.disabled' }} /> : <ExpandLess fontSize="small" sx={{ color: 'text.disabled' }} />}
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
                          pl: 3, py: 0.75,
                          '&.Mui-selected': { bgcolor: 'primary.50', color: 'primary.main', borderRight: '3px solid', borderColor: 'primary.main' },
                          '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: isActive ? 'primary.main' : 'text.secondary' }}>
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
      <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Assure Chit Funds — Admin
          </Typography>
          <Tooltip title={user?.full_name || 'Admin'}>
            <Avatar sx={{ cursor: 'pointer', bgcolor: 'secondary.main' }} onClick={(e) => setAnchorEl(e.currentTarget)}>
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
