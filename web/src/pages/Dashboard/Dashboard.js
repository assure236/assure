import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Paper, Typography, Box, Card, CardContent,
  CircularProgress, LinearProgress, Chip, List, ListItem,
  ListItemText, ListItemAvatar, Avatar, Button, Divider, Alert
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Group as GroupIcon,
  TrendingUp as TrendingUpIcon,
  Gavel as GavelIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AccountBalanceWallet as WalletIcon,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import SimpleTour from '../../components/Onboarding/SimpleTour';
import ReferralShareModal from '../../components/Onboarding/ReferralShareModal';

const StatCard = ({ title, value, icon, color, subtitle, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      height: '100%',
      cursor: onClick ? 'pointer' : 'default',
      transition: onClick ? 'transform 0.15s ease, box-shadow 0.15s ease' : 'none',
      '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: 5 } : undefined,
    }}
  >
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
  const [dividendData, setDividendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [loanData, setLoanData] = useState([]);
  const [duePayments, setDuePayments] = useState([]);
  const [showTour, setShowTour] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => { fetchDashboardData(); }, []);

  // Post-onboarding: take a tour + share popup
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('onboarding') === 'just_completed') {
      // Clean URL but keep on dashboard
      window.history.replaceState({}, '', '/dashboard');
      setTimeout(() => setShowTour(true), 500);
    }
  }, []);

  const handleTourDone = () => {
    setShowTour(false);
    axios.post('/onboarding/tour-complete').catch(() => {});
    setTimeout(() => setShowShare(true), 300);
  };

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const [dashRes, analyticsRes, profileRes, dividendRes, loanRes, dueRes] = await Promise.allSettled([
        axios.get('/dashboard/member'),
        axios.get('/dashboard/analytics'),
        axios.get('/dashboard/profile-completion'),
        axios.get('/dashboard/dividend-analytics'),
        axios.get('/loans/my-loans'),
        axios.get('/payments/due-payments'),
      ]);
      if (dashRes.status === 'fulfilled' && dashRes.value.data.success) {
        setDashboardData(dashRes.value.data.data);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data.success) {
        setAnalytics(analyticsRes.value.data.data);
      }
      if (profileRes.status === 'fulfilled' && profileRes.value.data.success) {
        setProfileCompletion(profileRes.value.data.data);
      }
      if (dividendRes.status === 'fulfilled' && dividendRes.value.data.success) {
        setDividendData(dividendRes.value.data.data);
      }
      if (loanRes.status === 'fulfilled' && loanRes.value.data.success) {
        setLoanData(loanRes.value.data.data || []);
      }
      if (dueRes && dueRes.status === 'fulfilled' && dueRes.value.data.success) {
        setDuePayments(dueRes.value.data.data || []);
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
      title: 'Active Chit Groups', color: '#0B1F3B',
      value: dashboardData?.activeGroups || 0,
      icon: <GroupIcon />, subtitle: 'enrolled groups'
    },
    {
      title: 'Total Invested', color: '#2e7d32',
      value: `₹${(dashboardData?.totalInvested || 0).toLocaleString('en-IN')}`,
      icon: <AccountBalanceIcon />, subtitle: 'lifetime contribution'
      , onClick: () => navigate('/dashboard/total-investment')
    },
    {
      title: 'Dividend Earned', color: '#ed6c02',
      value: `₹${((dividendData?.groups || []).reduce((s, g) => s + (g.avg_dividend_per_member * g.completed_auctions || 0), 0)).toLocaleString('en-IN')}`,
      icon: <TrendingUpIcon />, subtitle: 'total dividends'
    },
    {
      title: 'Loan Status', color: '#9c27b0',
      value: loanData.find(l => ['active', 'disbursed'].includes(l.status))
        ? `₹${(loanData.find(l => ['active', 'disbursed'].includes(l.status))?.outstanding_amount || 0).toLocaleString('en-IN')}`
        : loanData.find(l => ['requested', 'under_review', 'approved'].includes(l.status)) ? 'Pending' : 'None',
      icon: <AccountBalanceIcon />,
      subtitle: loanData.find(l => ['active', 'disbursed'].includes(l.status)) ? 'outstanding' : 'active loans'
    }
  ];

  const kycStatus = dashboardData?.user?.kyc_status || user?.kyc_status || 'pending';
  const memberships = dashboardData?.memberships || [];
  const recentPayments = dashboardData?.recentPayments || [];
  const upcomingAuctions = dashboardData?.upcomingAuctions || [];
  const dueNowPayments = duePayments.filter((p) => p.payment_status === 'pending' || p.payment_status === 'overdue');
  const dueNowAmount = dueNowPayments.reduce((sum, p) => sum + Number(p.total_amount || p.amount || 0), 0);
  const upcomingAuctionCount = upcomingAuctions.length;
  const pendingPaymentCount = analytics?.payment_status?.pending || 0;

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

      {/* Profile Completion Tracker */}
      {profileCompletion && !profileCompletion.isComplete && (
        <Paper sx={{ p: 3, borderRadius: 3, mb: 4, border: '1px solid #0B1F3B' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Complete Your Profile</Typography>
            <Chip label={`${profileCompletion.percentage}%`} color="primary" size="small" />
          </Box>
          <LinearProgress variant="determinate" value={profileCompletion.percentage} sx={{ height: 8, borderRadius: 4, mb: 2 }} />
          <Box display="flex" flexWrap="wrap" gap={1}>
            {profileCompletion.fields.filter(f => !f.filled).map(f => (
              <Chip key={f.key} label={f.label} size="small" variant="outlined" color="warning"
                onClick={() => navigate('/profile')} sx={{ cursor: 'pointer' }} />
            ))}
          </Box>
          <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/profile')}>
            Complete Profile →
          </Button>
        </Paper>
      )}

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

      {dueNowPayments.length > 0 && (
        <Alert
          severity={dueNowPayments.some((p) => p.payment_status === 'overdue') ? 'warning' : 'info'}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/payments')}>
              Pay Now
            </Button>
          }
        >
          You have {dueNowPayments.length} due payment{dueNowPayments.length > 1 ? 's' : ''} totaling ₹{dueNowAmount.toLocaleString('en-IN')}.
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

      <Paper sx={{ p: 2, borderRadius: 3, mb: 4, border: '1px solid #E2E8F0' }} id="tour-quick-access">
        <Typography variant="h6" sx={{ mb: 1.5 }}>Quick Access</Typography>
        <Box display="flex" gap={1.5} flexWrap="wrap">
          <Button
            id="tour-auctions"
            variant="outlined"
            startIcon={<GavelIcon />}
            onClick={() => navigate('/auctions')}
          >
            Auctions ({upcomingAuctionCount})
          </Button>
          <Button
            id="tour-payments"
            variant="outlined"
            startIcon={<PaymentIcon />}
            onClick={() => navigate('/payments')}
          >
            Payments ({pendingPaymentCount})
          </Button>
          <Button
            id="tour-documents"
            variant="outlined"
            color="inherit"
            startIcon={<DescriptionIcon />}
            onClick={() => navigate('/documents')}
          >
            Documents
          </Button>
        </Box>
      </Paper>

      {/* Consolidated Financial Summary */}
      {(memberships.length > 0 || loanData.length > 0) && (
        <Paper sx={{ p: 3, borderRadius: 3, mb: 4, border: '1px solid #E2E8F0' }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <WalletIcon sx={{ color: '#D4AF37' }} />
            <Typography variant="h6" fontWeight={700}>My Financial Summary</Typography>
          </Box>
          <Grid container spacing={2}>
            {/* Chit Groups breakdown */}
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ p: 2, bgcolor: '#F0FDF4', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Total Chit Value</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#16A34A' }}>
                  ₹{memberships.reduce((s, m) => s + Number((m.chit_group_id || m)?.chit_value || 0), 0).toLocaleString('en-IN')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ p: 2, bgcolor: '#FFF8E1', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Total Dividends</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#D4AF37' }}>
                  ₹{((dividendData?.groups || []).reduce((s, g) => s + (g.avg_dividend_per_member * g.completed_auctions || 0), 0)).toLocaleString('en-IN')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ p: 2, bgcolor: '#EFF6FF', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Pending Payments</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#1E3A8A' }}>
                  {analytics?.payment_status?.pending || 0}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ p: 2, bgcolor: '#FAF5FF', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Active Loans</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#9c27b0' }}>
                  {loanData.filter(l => ['active', 'disbursed', 'requested', 'under_review', 'approved'].includes(l.status)).length}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Per-group status */}
          {memberships.length > 0 && (
            <Box mt={2}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" fontWeight={600} sx={{ color: '#0B1F3B', mb: 1 }}>Chit-wise Status</Typography>
              {memberships.slice(0, 5).map((m, i) => {
                const g = m.chit_group_id || m;
                const progress = g.duration_months > 0 ? ((g.current_month || 0) / g.duration_months) * 100 : 0;
                const dGroup = (dividendData?.groups || []).find(dg => dg.group_id === (g._id || g.id));
                return (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 2, cursor: 'pointer' }}
                    onClick={() => navigate(`/chit-groups/${g._id || g.id}`)}>
                    <Box flex={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={600}>{g.group_name}</Typography>
                        <Chip label={g.status?.toUpperCase()} size="small" color={g.status === 'active' ? 'success' : 'default'} />
                      </Box>
                      <Box display="flex" gap={2} mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          ₹{Number(g.monthly_installment || 0).toLocaleString('en-IN')}/mo
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Month {g.current_month || 0}/{g.duration_months}
                        </Typography>
                        {dGroup && (
                          <Typography variant="caption" sx={{ color: '#16A34A' }}>
                            Dividend: ₹{Math.round(dGroup.avg_dividend_per_member * dGroup.completed_auctions).toLocaleString('en-IN')}
                          </Typography>
                        )}
                      </Box>
                      <LinearProgress variant="determinate" value={progress} sx={{ mt: 0.5, height: 4, borderRadius: 2 }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      )}

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
                      <stop offset="5%" stopColor="#0B1F3B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0B1F3B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => v > 0 ? `₹${(v/1000).toFixed(0)}k` : '0'} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Amount']} />
                  <Area type="monotone" dataKey="amount" stroke="#0B1F3B" fill="url(#collGrad)" strokeWidth={2} />
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
                    {['#4caf50', '#D4AF37', '#f44336'].map((color, i) => <Cell key={i} fill={color} />)}
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

      {showTour && (
        <SimpleTour
          onDone={handleTourDone}
          steps={[
            { selector: '#tour-quick-access', title: 'Quick Access', body: 'Jump straight to auctions, payments, and your documents from here.', placement: 'bottom' },
            { selector: '#tour-auctions', title: 'Live Auctions', body: 'Bid in upcoming auctions for your chit groups every month.', placement: 'bottom' },
            { selector: '#tour-payments', title: 'Payments', body: 'Pay your monthly installments and view receipts.', placement: 'bottom' },
            { selector: '#tour-documents', title: 'Documents', body: 'View and manage your KYC, cheque, and other documents anytime.', placement: 'bottom' },
          ]}
        />
      )}

      <ReferralShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        referralCode={user?.referral_code}
      />
    </Container>
  );
};

export default Dashboard;
