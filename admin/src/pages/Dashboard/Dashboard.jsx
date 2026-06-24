import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Typography, Box, Card, CardContent,
  CircularProgress, Alert, Divider, List, ListItem, ListItemText,
  ListItemAvatar, Avatar, Chip, Button, LinearProgress, Tooltip
} from '@mui/material';
import {
  People as PeopleIcon, GroupWork as GroupIcon,
  AccountBalance as MoneyIcon, Gavel as GavelIcon,
  TrendingUp as TrendIcon, Warning as WarningIcon,
  CheckCircle, PendingActions, Assessment, Refresh,
  ArrowForward
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const PIE_COLORS = ['#0B1F3B', '#388e3c', '#B8960F', '#d32f2f'];

const StatCard = ({ title, value, icon, color, sub, onClick }) => (
  <Card sx={{ borderRadius: 3, height: '100%', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.2s', '&:hover': onClick ? { boxShadow: 4 } : {} }} onClick={onClick}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h4" fontWeight={700} mt={0.5}>{value ?? '—'}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
        <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>{icon}</Avatar>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [pl, setPl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, plRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/admin/dashboard`),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/accounting/pl`).catch(() => null),
      ]);
      if (dashRes.data.success) setStats(dashRes.data.data);
      if (plRes?.data?.success) setPl(plRes.data.data);
    } catch (err) {
      setError('Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  const s = stats || {};
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  // KYC progress
  const kycTotal = (s.verified_kyc || 0) + (s.pending_kyc || 0) + (s.rejected_kyc || 0);
  const kycPct = kycTotal ? Math.round(((s.verified_kyc || 0) / kycTotal) * 100) : 0;

  // Group status for pie chart
  const groupPie = [
    { name: 'Active', value: s.active_groups || 0 },
    { name: 'Draft', value: (s.total_groups || 0) - (s.active_groups || 0) - (s.completed_groups || 0) },
    { name: 'Completed', value: s.completed_groups || 0 },
  ].filter(g => g.value > 0);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
        <Button startIcon={<Refresh />} onClick={fetchStats} variant="outlined" size="small">Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stat Cards */}
      <Grid container spacing={3} mb={4}>
        {[
          { title: 'Total Members', value: s.total_users?.toLocaleString('en-IN'), icon: <PeopleIcon />, color: '#0B1F3B', sub: `${s.new_users_today || 0} new today`, onClick: () => navigate('/users') },
          { title: 'Active Chit Groups', value: s.active_groups?.toLocaleString('en-IN'), icon: <GroupIcon />, color: '#388e3c', sub: `${s.total_groups || 0} total`, onClick: () => navigate('/chit-groups') },
          { title: 'Monthly Collection', value: s.monthly_collection ? fmt(s.monthly_collection) : '₹0', icon: <MoneyIcon />, color: '#B8960F', sub: `${fmt(s.total_collection || 0)} overall`, onClick: () => navigate('/accounting') },
          { title: 'Pending KYC', value: s.pending_kyc?.toLocaleString('en-IN'), icon: <WarningIcon />, color: '#d32f2f', sub: 'Need approval', onClick: () => navigate('/documents') },
          { title: 'Live Auctions', value: s.live_auctions?.toLocaleString('en-IN'), icon: <GavelIcon />, color: '#7b1fa2', sub: `${s.total_auctions || 0} total`, onClick: () => navigate('/auctions') },
          { title: 'Overdue Payments', value: s.overdue_payments?.toLocaleString('en-IN'), icon: <TrendIcon />, color: '#e64a19', sub: `${fmt(s.overdue_amount || 0)} overdue`, onClick: () => navigate('/defaulters') },
        ].map(props => (
          <Grid item xs={12} sm={6} md={4} key={props.title}>
            <StatCard {...props} />
          </Grid>
        ))}
      </Grid>

      {/* Charts Row */}
      {pl && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Collection Trend (Last 6 Months)</Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={pl.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0B1F3B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0B1F3B" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#388e3c" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#388e3c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <RechartTooltip formatter={(v) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="collection" stroke="#0B1F3B" fill="url(#cGrad)" name="Collection" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" stroke="#388e3c" fill="url(#pGrad)" name="Commission" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Group Status</Typography>
                {groupPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={groupPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {groupPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                    <Typography color="text.secondary">No groups yet</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* KYC Progress + Quick Actions */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>KYC Status</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Completion Rate</Typography>
                <Typography variant="body2" fontWeight={700}>{kycPct}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={kycPct} sx={{ height: 10, borderRadius: 5, mb: 2 }} color={kycPct >= 80 ? 'success' : kycPct >= 50 ? 'warning' : 'error'} />
              <Divider sx={{ mb: 2 }} />
              {[
                { label: 'Verified', value: s.verified_kyc || 0, color: 'success' },
                { label: 'Pending', value: s.pending_kyc || 0, color: 'warning' },
                { label: 'Rejected', value: s.rejected_kyc || 0, color: 'error' },
              ].map(item => (
                <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle sx={{ fontSize: 16 }} color={item.color} />
                    <Typography variant="body2">{item.label}</Typography>
                  </Box>
                  <Chip label={item.value} size="small" color={item.color} />
                </Box>
              ))}
              <Button fullWidth variant="outlined" size="small" sx={{ mt: 1 }} endIcon={<ArrowForward />} onClick={() => navigate('/documents')}>
                Manage Documents
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Financial Summary</Typography>
              {[
                { label: 'Total Collected', value: fmt(s.total_collection), color: '#0B1F3B' },
                { label: 'Monthly Collection', value: fmt(s.monthly_collection), color: '#388e3c' },
                { label: 'Overdue Amount', value: fmt(s.overdue_amount), color: '#d32f2f' },
                { label: 'Foreman Commission (est.)', value: fmt((s.total_collection || 0) * 0.05), color: '#B8960F' },
              ].map((row, i) => (
                <Box key={i}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                    <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: row.color }}>{row.value}</Typography>
                  </Box>
                  {i < 3 && <Divider />}
                </Box>
              ))}
              <Button fullWidth variant="outlined" size="small" sx={{ mt: 2 }} endIcon={<ArrowForward />} onClick={() => navigate('/accounting')}>
                View Full Ledger
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Quick Actions</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                {[
                  { label: 'Add New Member', icon: <PeopleIcon fontSize="small" />, path: '/users', color: 'primary' },
                  { label: 'Create Chit Group', icon: <GroupIcon fontSize="small" />, path: '/chit-groups/create', color: 'success' },
                  { label: 'Schedule Auction', icon: <GavelIcon fontSize="small" />, path: '/auctions', color: 'secondary' },
                  { label: 'Record Payment', icon: <MoneyIcon fontSize="small" />, path: '/payments', color: 'warning' },
                  { label: 'View Reports', icon: <Assessment fontSize="small" />, path: '/reports', color: 'info' },
                  { label: 'Send Communication', icon: <PendingActions fontSize="small" />, path: '/communications', color: 'error' },
                ].map(item => (
                  <Button key={item.label} variant="outlined" color={item.color} size="small" startIcon={item.icon}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }} onClick={() => navigate(item.path)}>
                    {item.label}
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Registrations */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">Recent Registrations</Typography>
                <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/users')} sx={{ textTransform: 'none' }}>View all</Button>
              </Box>
              <Divider sx={{ mb: 1 }} />
              {(s.recent_users || []).length === 0
                ? <Typography color="text.secondary" py={2} textAlign="center">No recent registrations</Typography>
                : <List dense>
                  {(s.recent_users || []).map((u, i) => (
                    <React.Fragment key={u._id || u.id || i}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.light', fontSize: 14 }}>{(u.full_name || 'U')[0].toUpperCase()}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={u.full_name}
                          secondary={u.mobile}
                        />
                        <Chip label={u.kyc_status || 'pending'} size="small"
                          color={u.kyc_status === 'verified' ? 'success' : 'warning'}
                          sx={{ textTransform: 'capitalize' }} />
                      </ListItem>
                      {i < (s.recent_users || []).length - 1 && <Divider inset="56px" />}
                    </React.Fragment>
                  ))}
                </List>
              }
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Payments */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">Recent Payments</Typography>
                <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/payments')} sx={{ textTransform: 'none' }}>View all</Button>
              </Box>
              <Divider sx={{ mb: 1 }} />
              {(s.recent_payments || []).length === 0
                ? <Typography color="text.secondary" py={2} textAlign="center">No recent payments</Typography>
                : <List dense>
                  {(s.recent_payments || []).map((p, i) => (
                    <React.Fragment key={p._id || p.id || i}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'success.light', fontSize: 14 }}>₹</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`₹${Number(p.amount || 0).toLocaleString('en-IN')}`}
                          secondary={p.member?.full_name || '—'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {p.paid_date ? new Date(p.paid_date).toLocaleDateString('en-IN') : '—'}
                        </Typography>
                      </ListItem>
                      {i < (s.recent_payments || []).length - 1 && <Divider inset="56px" />}
                    </React.Fragment>
                  ))}
                </List>
              }
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
