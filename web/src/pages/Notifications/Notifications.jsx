import React, { useState, useEffect } from 'react';
import {
  Typography, Box, List, ListItem,
  ListItemAvatar, ListItemText, Avatar, Chip, CircularProgress, Alert,
  Button, IconButton, Divider, Tabs, Tab
} from '@mui/material';
import {
  Notifications as NotifIcon, NotificationsActive as UnreadIcon,
  Delete as DeleteIcon, DoneAll as ReadAllIcon,
  Payment as PaymentIcon, Gavel as AuctionIcon,
  Group as GroupIcon, Info as InfoIcon, Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { PageShell, PageHeader, Surface, EmptyState } from '../../components/ui/PageKit';
import { brand } from '../../theme/brand';

const formatDistance = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const typeConfig = {
  payment_reminder: { icon: <PaymentIcon />, color: brand.success, bg: 'rgba(21,128,61,0.08)' },
  payment_received: { icon: <PaymentIcon />, color: brand.success, bg: 'rgba(21,128,61,0.08)' },
  payment: { icon: <PaymentIcon />, color: brand.success, bg: 'rgba(21,128,61,0.08)' },
  auction_alert: { icon: <AuctionIcon />, color: brand.danger, bg: 'rgba(198,40,40,0.08)' },
  auction_result: { icon: <AuctionIcon />, color: brand.danger, bg: 'rgba(198,40,40,0.08)' },
  auction: { icon: <AuctionIcon />, color: brand.danger, bg: 'rgba(198,40,40,0.08)' },
  dividend_credit: { icon: <PaymentIcon />, color: brand.success, bg: 'rgba(21,128,61,0.08)' },
  wallet_update: { icon: <PaymentIcon />, color: brand.success, bg: 'rgba(21,128,61,0.08)' },
  disbursal_update: { icon: <PaymentIcon />, color: brand.success, bg: 'rgba(21,128,61,0.08)' },
  chit_group: { icon: <GroupIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  chit_transfer_request: { icon: <GroupIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  chit_cancel_request: { icon: <GroupIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  admin_chit_transfer: { icon: <GroupIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  admin_chit_cancel: { icon: <GroupIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  kyc_update: { icon: <WarningIcon />, color: brand.warning, bg: 'rgba(196,127,10,0.08)' },
  document_verified: { icon: <WarningIcon />, color: brand.warning, bg: 'rgba(196,127,10,0.08)' },
  kyc: { icon: <WarningIcon />, color: brand.warning, bg: 'rgba(196,127,10,0.08)' },
  referral_bonus: { icon: <InfoIcon />, color: brand.goldDark, bg: 'rgba(201,162,39,0.12)' },
  loan_update: { icon: <InfoIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  support_update: { icon: <InfoIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  account_update: { icon: <InfoIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  profile_edit_request: { icon: <InfoIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  profile_edit_approved: { icon: <InfoIcon />, color: brand.success, bg: 'rgba(21,128,61,0.08)' },
  profile_edit_rejected: { icon: <InfoIcon />, color: brand.danger, bg: 'rgba(198,40,40,0.08)' },
  system: { icon: <InfoIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
  general: { icon: <InfoIcon />, color: brand.navy, bg: 'rgba(11,31,59,0.06)' },
};

const getConfig = (type) => typeConfig[type] || typeConfig.system;

const screenRoutes = {
  dashboard: '/dashboard',
  kyc: '/kyc',
  documents: '/documents',
  payments: '/payments',
  auctions: '/auctions',
  chit_groups: '/chit-groups',
  referrals: '/referrals',
  loans: '/loans',
  support: '/support',
  profile: '/profile',
  wallet: '/payments',
  goals: '/goals',
  notifications: '/notifications',
  help: '/help',
};

/** Resolve in-app path from notification type + optional data payload. */
const resolveNotificationPath = (n) => {
  const data = n.data && typeof n.data === 'object' ? n.data : {};
  const type = n.type || n.notification_type || '';

  if (data.screen && screenRoutes[data.screen]) return screenRoutes[data.screen];
  if (data.path && typeof data.path === 'string' && data.path.startsWith('/')) return data.path;
  if (data.auction_id) return `/auctions/${data.auction_id}`;
  if (data.chit_group_id) return `/chit-groups/${data.chit_group_id}`;

  switch (type) {
    case 'payment_reminder':
    case 'payment_received':
    case 'payment':
    case 'dividend_credit':
    case 'wallet_update':
    case 'disbursal_update':
      return '/payments';
    case 'auction_alert':
    case 'auction_result':
    case 'auction':
      return data.auction_id ? `/auctions/${data.auction_id}` : '/auctions';
    case 'kyc_update':
    case 'kyc':
      return '/kyc';
    case 'document_verified':
      return '/documents';
    case 'referral_bonus':
      return '/referrals';
    case 'loan_update':
      return '/loans';
    case 'support_update':
      return '/support';
    case 'chit_group':
    case 'chit_transfer_request':
    case 'chit_cancel_request':
    case 'admin_chit_transfer':
    case 'admin_chit_cancel':
      return data.chit_group_id ? `/chit-groups/${data.chit_group_id}` : '/chit-groups';
    case 'account_update':
    case 'profile_edit_request':
    case 'profile_edit_approved':
    case 'profile_edit_rejected':
      return '/profile';
    default:
      return null;
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { refreshKey } = useActiveMember();

  useEffect(() => {
    setNotifications([]);
    setPage(1);
    fetchNotifications(1, tab === 1);
  }, [tab, refreshKey]);

  const fetchNotifications = async (p = 1, unreadOnly = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: p, limit: 20 });
      if (unreadOnly) params.append('unread', 'true');
      const res = await axios.get(`/notifications?${params}`);
      if (res.data.success) {
        const { notifications: rows, total: t, totalPages } = res.data.data;
        setNotifications(prev => p === 1 ? rows : [...prev, ...rows]);
        setTotal(t);
        setHasMore(p < totalPages);
      }
    } catch (err) {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      setTotal(prev => prev - 1);
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchNotifications(next, tab === 1);
  };

  const handleOpen = async (n) => {
    if (!n.is_read) {
      try {
        await axios.put(`/notifications/${n._id}/mark-read`);
        setNotifications((prev) => prev.map((row) => (row._id === n._id ? { ...row, is_read: true } : row)));
      } catch {
        /* still allow navigation */
      }
    }
    const path = resolveNotificationPath(n);
    if (path) navigate(path);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <PageShell maxWidth={760}>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Stay updated on payments, auctions, and account activity'}
        actions={
          <Button startIcon={<ReadAllIcon />} onClick={handleMarkAllRead} disabled={unreadCount === 0} size="small">
            Mark all read
          </Button>
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${total})`} />
        <Tab label="Unread" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && notifications.length === 0 ? (
        <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
      ) : notifications.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<NotifIcon sx={{ fontSize: 32 }} />}
            title={tab === 1 ? 'No unread notifications' : 'No notifications yet'}
            description={tab === 1 ? 'You are all caught up.' : 'Alerts about payments, auctions, and account updates will appear here.'}
          />
        </Surface>
      ) : (
        <Surface padded={false}>
          <List disablePadding>
            {notifications.map((n, i) => {
              const cfg = getConfig(n.notification_type || n.type);
              const timeAgo = n.created_at ? formatDistance(n.created_at) : '';
              const canNavigate = !!resolveNotificationPath(n);
              return (
                <React.Fragment key={n._id || n.id}>
                  {i > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    sx={{
                      bgcolor: n.is_read ? 'transparent' : brand.mist,
                      py: 2,
                      pr: 1,
                      transition: 'background 0.2s',
                      cursor: canNavigate || !n.is_read ? 'pointer' : 'default',
                    }}
                    onClick={() => handleOpen(n)}
                    secondaryAction={
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: n.is_read ? brand.mist : cfg.bg, color: n.is_read ? brand.muted : cfg.color }}>
                        {n.is_read ? cfg.icon : <UnreadIcon />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="body1" fontWeight={n.is_read ? 400 : 700} component="span">
                            {n.title}
                          </Typography>
                          {!n.is_read && (
                            <Chip
                              label="New"
                              size="small"
                              sx={{ height: 18, fontSize: 10, bgcolor: brand.gold, color: brand.navy, fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" mt={0.5}>{n.message || n.body}</Typography>
                          <Typography variant="caption" color="text.disabled" mt={0.5} display="block">{timeAgo}</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
          {hasMore && (
            <Box textAlign="center" py={2}>
              <Button onClick={loadMore} disabled={loading}>
                {loading ? <CircularProgress size={20} /> : 'Load More'}
              </Button>
            </Box>
          )}
        </Surface>
      )}
    </PageShell>
  );
};

export default Notifications;
