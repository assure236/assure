import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, CardContent, List, ListItem,
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
const formatDistance = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const typeConfig = {
  payment: { icon: <PaymentIcon />, color: 'success.main', bg: 'success.light' },
  auction: { icon: <AuctionIcon />, color: 'error.main', bg: 'error.light' },
  chit_group: { icon: <GroupIcon />, color: 'primary.main', bg: 'primary.light' },
  system: { icon: <InfoIcon />, color: 'info.main', bg: 'info.light' },
  kyc: { icon: <WarningIcon />, color: 'warning.main', bg: 'warning.light' },
};

const getConfig = (type) => typeConfig[type] || typeConfig.system;

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0); // 0=all, 1=unread
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setNotifications([]);
    setPage(1);
    fetchNotifications(1, tab === 1);
  }, [tab]);

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

  const handleMarkRead = async (id) => {
    try {
      await axios.put(`/notifications/${id}/mark-read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
    } catch {
      toast.error('Failed to mark as read');
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

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4">Notifications</Typography>
          {unreadCount > 0 && (
            <Typography variant="body2" color="text.secondary">{unreadCount} unread</Typography>
          )}
        </Box>
        <Button startIcon={<ReadAllIcon />} onClick={handleMarkAllRead} disabled={unreadCount === 0} size="small">
          Mark all read
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${total})`} />
        <Tab label="Unread" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && notifications.length === 0 ? (
        <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
      ) : notifications.length === 0 ? (
        <Box textAlign="center" py={10}>
          <NotifIcon sx={{ fontSize: 64, color: 'grey.300' }} />
          <Typography color="text.secondary" mt={2}>
            {tab === 1 ? 'No unread notifications' : 'No notifications yet'}
          </Typography>
        </Box>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <List disablePadding>
            {notifications.map((n, i) => {
              const cfg = getConfig(n.notification_type || n.type);
              const timeAgo = n.created_at
                ? formatDistance(n.created_at)
                : '';
              return (
                <React.Fragment key={n._id || n.id}>
                  {i > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    sx={{
                      bgcolor: n.is_read ? 'transparent' : 'primary.50',
                      py: 2,
                      pr: 1,
                      transition: 'background 0.2s',
                      cursor: !n.is_read ? 'pointer' : 'default',
                    }}
                    onClick={() => !n.is_read && handleMarkRead(n._id)}
                    secondaryAction={
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: n.is_read ? 'grey.100' : 'primary.main', color: n.is_read ? 'text.secondary' : 'white' }}>
                        {n.is_read ? cfg.icon : <UnreadIcon />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="body1" fontWeight={n.is_read ? 400 : 700} component="span">
                            {n.title}
                          </Typography>
                          {!n.is_read && <Chip label="New" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />}
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
        </Card>
      )}
    </Container>
  );
};

export default Notifications;
