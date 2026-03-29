import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Paper, Typography, Box, Card, CardContent,
  CircularProgress, LinearProgress, Chip, List, ListItem,
  ListItemText, ListItemAvatar, Avatar, Button, Divider, Alert
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Group as GroupIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendingUpIcon,
  Gavel as GavelIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography color="text.secondary" variant="body2" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
        <Box sx={{
          backgroundColor: `${color}15`, borderRadius: 2,
          p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Box sx={{ color }}>{icon}</Box>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const [dashRes, analyticsRes] = await Promise.allSettled([
        axios.get('/dashboard/member'),
        axios.get('/dashboard/analytics'),
      ]);
      if (dashRes.status === 'fulfilled' && dashRes.value.data.success) {
        setDashboardData(dashRes.value.data.data);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data.success) {
        setAnalytics(analyticsRes.value.data.data);
      }
    } catch (err) {
      setError('Could not load dashboard data. Please refresh.');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const stats = [
    {
      title: 'Active Chit Groups', color: '#1976d2',
      value: dashboardData?.activeGroups || 0,
      icon: <GroupIcon />, subtitle: 'enrolled groups'
    },
    {
      title: 'Total Invested', color: '#2e7d32',
      value: `₹${(dashboardData?.totalInvested || 0).toLocaleString('en-IN')}`,
      icon: <AccountBalanceIcon />, subtitle: 'lifetime contribution'
    },
    {
      title: 'Payments This Month', color: '#ed6c02',
      value: `₹${(dashboardData?.paymentsThisMonth || 0).toLocaleString('en-IN')}`,
      icon: <PaymentIcon />, subtitle: 'this month'
    },
    {
      title: 'Credit Score', color: '#9c27b0',
      value: dashboardData?.user?.credit_score || dashboardData?.creditScore || 500,
      icon: <TrendingUpIcon />, subtitle: 'payment discipline'
    }
  ];

  const kycStatus = dashboardData?.user?.kyc_status || user?.kyc_status || 'pending';
  const memberships = dashboardData?.memberships || [];
  const recentPayments = dashboardData?.recentPayments || [];
  const upcomingAuctions = dashboardData?.upcomingAuctions || [];

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4">
          Welcome back, {user?.full_name || 'Member'}! 👋
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Member ID: {user?.member_id || '—'} &nbsp;|&nbsp; Last login today
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* KYC Banner */}
      {kycStatus !== 'verified' && (
        <Alert
          severity={kycStatus === 'rejected' ? 'error' : 'warning'}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/documents')}>
              Complete KYC
            </Button>
          }
        >
          {kycStatus === 'rejected'
            ? 'Your KYC was rejected. Please re-upload your documents.'
            : 'Complete your KYC verification to access all features.'}
        </Alert>
      )}

      {/* Stats */}
      <Grid container spacing={3} mb={4}>
        {stats.map((stat, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      {/* Analytics Charts */}
      {analytics && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" mb={2}>Monthly Collections (Last 6 Months)</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analytics.monthly_collections} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1976d2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => v > 0 ? `₹${(v/1000).toFixed(0)}k` : '0'} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Amount']} />
                  <Area type="monotone" dataKey="amount" stroke="#1976d2" fill="url(#collGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
              <Typography variant="h6" mb={2}>Payment Status</Typography>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Paid', value: analytics.payment_status?.paid || 0 },
                      { name: 'Pending', value: analytics.payment_status?.pending || 0 },
                      { name: 'Failed', value: analytics.payment_status?.failed || 0 },
                    ]}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value"
                  >
                    {['#4caf50', '#ff9800', '#f44336'].map((color, i) => <Cell key={i} fill={color} />)}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box textAlign="center" mt={1}>
                <Typography variant="body2" color="text.secondary">
                  Total invested: <strong>₹{Number(analytics.total_invested || 0).toLocaleString('en-IN')}</strong>
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Active Chit Groups */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">My Chit Groups</Typography>
              <Button
                size="small" endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/chit-groups')}
              >
                View All
              </Button>
            </Box>
            {memberships.length === 0 ? (
              <Box textAlign="center" py={4}>
                <GroupIcon sx={{ fontSize: 48, color: 'grey.300' }} />
                <Typography color="text.secondary" mt={1}>
                  You haven't enrolled in any chit group yet.
                </Typography>
                <Button
                  variant="contained" sx={{ mt: 2 }}
                  onClick={() => navigate('/chit-groups')}
                >
                  Browse Groups
                </Button>
              </Box>
            ) : (
              memberships.slice(0, 3).map((m, i) => {
                const group = m.chit_group_id || m;
                const progress = group.duration_months > 0
                  ? ((group.current_month || 0) / group.duration_months) * 100
                  : 0;
                return (
                  <Box
                    key={i}
                    sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2, cursor: 'pointer' }}
                    onClick={() => navigate(`/chit-groups/${group._id || group.id}`)}
                  >
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography fontWeight={600}>{group.group_name}</Typography>
                      <Chip
                        label={group.status?.toUpperCase()}
                        size="small"
                        color={group.status === 'active' ? 'success' : 'default'}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      ₹{Number(group.chit_value).toLocaleString('en-IN')} &nbsp;•&nbsp;
                      ₹{Number(group.monthly_installment).toLocaleString('en-IN')}/month
                    </Typography>
                    <LinearProgress
                      variant="determinate" value={progress}
                      sx={{ borderRadius: 2, height: 6 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Month {group.current_month || 0} of {group.duration_months}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Paper>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={5}>
          {/* Upcoming Auctions */}
          <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Upcoming Auctions</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/auctions')}>
                View All
              </Button>
            </Box>
            {upcomingAuctions.length === 0 ? (
              <Typography color="text.secondary" variant="body2" textAlign="center" py={2}>
                No upcoming auctions scheduled.
              </Typography>
            ) : (
              upcomingAuctions.slice(0, 3).map((auction, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                  <Avatar sx={{ bgcolor: auction.status === 'active' ? 'error.main' : 'primary.main' }}>
                    <GavelIcon fontSize="small" />
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {auction.chit_group_id?.group_name || auction.chitGroup?.group_name || 'Chit Group'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Month {auction.month_number} — {auction.status === 'active' ? '🔴 LIVE' : 'Scheduled'}
                    </Typography>
                  </Box>
                </Box>
              ))
            )}
          </Paper>

          {/* Recent Payments */}
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Recent Payments</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/payments')}>
                View All
              </Button>
            </Box>
            {recentPayments.length === 0 ? (
              <Typography color="text.secondary" variant="body2" textAlign="center" py={2}>
                No payments recorded yet.
              </Typography>
            ) : (
              <List disablePadding>
                {recentPayments.slice(0, 4).map((payment, i) => (
                  <React.Fragment key={i}>
                    <ListItem disablePadding sx={{ py: 1 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: payment.payment_status === 'success' ? 'success.light' : 'warning.light', width: 36, height: 36 }}>
                          {payment.payment_status === 'success'
                            ? <CheckCircleIcon fontSize="small" />
                            : <WarningIcon fontSize="small" />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={payment.chit_group_id?.group_name || payment.chitGroup?.group_name || 'Chit Group'}
                        secondary={payment.payment_date
                          ? new Date(payment.payment_date).toLocaleDateString('en-IN')
                          : 'Pending'}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <Typography variant="body2" fontWeight={700} color="primary">
                        ₹{Number(payment.amount || 0).toLocaleString('en-IN')}
                      </Typography>
                    </ListItem>
                    {i < recentPayments.slice(0, 4).length - 1 && <Divider variant="inset" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
