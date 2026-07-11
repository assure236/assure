import React, { useState, useEffect } from 'react';
import {
  Grid, Typography, Box, CircularProgress, LinearProgress, Chip, Button, Alert, Stack,
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
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { securityLogger } from '../../utils/securityLogger';
import { useDisplayUser } from '../../hooks/useDisplayUser';
import SimpleTour from '../../components/Onboarding/SimpleTour';
import ReferralShareModal from '../../components/Onboarding/ReferralShareModal';
import { CHART_TOOLTIP_PROPS } from '../../theme/uiOverrides';
import { brand, fmtINR } from '../../theme/brand';
import {
  PageShell, PageHeader, Surface, MetricTile, EmptyState, SectionTitle,
} from '../../components/ui/PageKit';

const Dashboard = () => {
  const { refreshKey, isSwitched, activeMemberId } = useActiveMember();
  const displayUser = useDisplayUser();
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

  useEffect(() => { fetchDashboardData(); }, [refreshKey]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('onboarding') === 'just_completed') {
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
      securityLogger.error('Dashboard load failed', { status: err?.response?.status });
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

  const dividendTotal = (dividendData?.groups || []).reduce(
    (s, g) => s + (g.avg_dividend_per_member * g.completed_auctions || 0),
    0
  );
  const activeLoan = loanData.find((l) => ['active', 'disbursed'].includes(l.status));
  const pendingLoan = loanData.find((l) => ['requested', 'under_review', 'approved'].includes(l.status));

  const kycStatus = dashboardData?.user?.kyc_status || displayUser?.kyc_status || 'pending';
  const memberships = dashboardData?.memberships || [];
  const recentPayments = dashboardData?.recentPayments || [];
  const upcomingAuctions = dashboardData?.upcomingAuctions || [];
  const dueNowPayments = duePayments.filter((p) => p.payment_status === 'pending' || p.payment_status === 'overdue');
  const dueNowAmount = dueNowPayments.reduce((sum, p) => sum + Number(p.total_amount || p.amount || 0), 0);
  const upcomingAuctionCount = upcomingAuctions.length;
  const pendingPaymentCount = analytics?.payment_status?.pending || 0;
  const firstName = (displayUser?.full_name || (isSwitched ? activeMemberId : 'Member') || 'Member')
    .toString()
    .split(' ')[0];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Member dashboard"
        title={`Welcome back, ${firstName}`}
        subtitle={`Member ID ${displayUser?.member_id || (isSwitched ? activeMemberId : '—')} · Your chits, auctions, and payments in one place.`}
        actions={
          <>
            <Button variant="outlined" startIcon={<GavelIcon />} onClick={() => navigate('/auctions')}>
              Auctions
            </Button>
            <Button variant="contained" startIcon={<PaymentIcon />} onClick={() => navigate('/payments')}>
              Pay now
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {profileCompletion && !profileCompletion.isComplete && (
        <Surface accent sx={{ mb: 2.5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={1} flexWrap="wrap">
            <Typography variant="h6">Complete your profile</Typography>
            <Chip label={`${profileCompletion.percentage}%`} size="small" color="primary" />
          </Box>
          <LinearProgress
            variant="determinate"
            value={profileCompletion.percentage}
            sx={{ height: 8, mb: 1.5 }}
          />
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} mb={1}>
            {profileCompletion.fields.filter((f) => !f.filled).map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => navigate('/profile')}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>
          <Button size="small" onClick={() => navigate('/profile')}>
            Finish profile
          </Button>
        </Surface>
      )}

      {kycStatus !== 'verified' && (
        <Alert
          severity={kycStatus === 'rejected' ? 'error' : 'warning'}
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/documents')}>
              Complete KYC
            </Button>
          }
        >
          {kycStatus === 'rejected'
            ? 'Your KYC was rejected. Please re-upload your documents.'
            : 'Complete KYC verification to unlock auctions and payouts.'}
        </Alert>
      )}

      {dueNowPayments.length > 0 && (
        <Alert
          severity={dueNowPayments.some((p) => p.payment_status === 'overdue') ? 'warning' : 'info'}
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/payments')}>
              Pay Now
            </Button>
          }
        >
          {dueNowPayments.length} due payment{dueNowPayments.length > 1 ? 's' : ''} totaling {fmtINR(dueNowAmount)}.
        </Alert>
      )}

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricTile
            label="Active chits"
            value={dashboardData?.activeGroups || 0}
            hint="Enrolled groups"
            icon={<GroupIcon />}
            tone="navy"
            onClick={() => navigate('/chit-groups')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricTile
            label="Total invested"
            value={fmtINR(dashboardData?.totalInvested || 0)}
            hint="Lifetime contribution"
            icon={<AccountBalanceIcon />}
            tone="green"
            onClick={() => navigate('/dashboard/total-investment')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricTile
            label="Dividends earned"
            value={fmtINR(dividendTotal)}
            hint="Across all groups"
            icon={<TrendingUpIcon />}
            tone="gold"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricTile
            label="Loan status"
            value={
              activeLoan
                ? fmtINR(activeLoan.outstanding_amount || 0)
                : pendingLoan
                  ? 'Pending'
                  : 'None'
            }
            hint={activeLoan ? 'Outstanding' : 'Active loans'}
            icon={<WalletIcon />}
            tone="blue"
            onClick={() => navigate('/loans')}
          />
        </Grid>
      </Grid>

      <Surface sx={{ mb: 3 }} id="tour-quick-access">
        <SectionTitle title="Quick access" />
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
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
            startIcon={<DescriptionIcon />}
            onClick={() => navigate('/documents')}
          >
            Documents
          </Button>
        </Stack>
      </Surface>

      {(memberships.length > 0 || loanData.length > 0) && (
        <Surface sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" gap={1.25} mb={2}>
            <WalletIcon sx={{ color: brand.gold }} />
            <Typography variant="h6">Financial summary</Typography>
          </Box>
          <Grid container spacing={1.5}>
            {[
              {
                label: 'Total chit value',
                value: fmtINR(memberships.reduce((s, m) => s + Number((m.chit_group_id || m)?.chit_value || 0), 0)),
                wash: 'rgba(21,128,61,0.08)',
                ink: brand.success,
              },
              {
                label: 'Total dividends',
                value: fmtINR(dividendTotal),
                wash: 'rgba(201,162,39,0.14)',
                ink: brand.goldDark,
              },
              {
                label: 'Pending payments',
                value: analytics?.payment_status?.pending || 0,
                wash: 'rgba(30,58,138,0.08)',
                ink: brand.royal,
              },
              {
                label: 'Active loans',
                value: loanData.filter((l) =>
                  ['active', 'disbursed', 'requested', 'under_review', 'approved'].includes(l.status)
                ).length,
                wash: brand.mist,
                ink: brand.navy,
              },
            ].map((cell) => (
              <Grid item xs={6} md={3} key={cell.label}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: cell.wash, textAlign: 'center', height: '100%' }}>
                  <Typography variant="caption" color="text.secondary">{cell.label}</Typography>
                  <Typography sx={{ fontFamily: brand.fontDisplay, fontWeight: 600, fontSize: '1.25rem', color: cell.ink, mt: 0.5 }}>
                    {cell.value}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {memberships.length > 0 && (
            <Box mt={2.5}>
              <Typography variant="subtitle2" sx={{ mb: 1.25, color: brand.muted }}>
                Chit-wise status
              </Typography>
              {memberships.slice(0, 5).map((m, i) => {
                const g = m.chit_group_id || m;
                const progress = g.duration_months > 0 ? ((g.current_month || 0) / g.duration_months) * 100 : 0;
                const dGroup = (dividendData?.groups || []).find((dg) => dg.group_id === (g._id || g.id));
                return (
                  <Box
                    key={i}
                    onClick={() => navigate(`/chit-groups/${g._id || g.id}`)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      mb: 1,
                      p: 1.75,
                      borderRadius: 2,
                      border: `1px solid ${brand.line}`,
                      bgcolor: 'rgba(255,255,255,0.55)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, transform 0.15s ease',
                      '&:hover': { borderColor: 'rgba(201,162,39,0.45)', transform: 'translateY(-1px)' },
                    }}
                  >
                    <Box flex={1} minWidth={0}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                        <Typography fontWeight={700} noWrap>{g.group_name}</Typography>
                        <Chip
                          label={(g.status || '').toUpperCase()}
                          size="small"
                          color={g.status === 'active' ? 'success' : 'default'}
                        />
                      </Box>
                      <Box display="flex" gap={2} mt={0.5} flexWrap="wrap">
                        <Typography variant="caption" color="text.secondary">
                          {fmtINR(g.monthly_installment)}/mo
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Month {g.current_month || 0}/{g.duration_months}
                        </Typography>
                        {dGroup && (
                          <Typography variant="caption" sx={{ color: brand.success }}>
                            Dividend {fmtINR(Math.round(dGroup.avg_dividend_per_member * dGroup.completed_auctions))}
                          </Typography>
                        )}
                      </Box>
                      <LinearProgress variant="determinate" value={progress} sx={{ mt: 1, height: 5 }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Surface>
      )}

      {analytics && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={8}>
            <Surface>
              <SectionTitle title="Monthly collections" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={analytics.monthly_collections} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={brand.navy} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={brand.navy} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,31,59,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: brand.muted }} />
                  <YAxis
                    tick={{ fontSize: 12, fill: brand.muted }}
                    tickFormatter={(v) => (v > 0 ? `₹${(v / 1000).toFixed(0)}k` : '0')}
                  />
                  <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v) => [fmtINR(v), 'Amount']} />
                  <Area type="monotone" dataKey="amount" stroke={brand.navy} fill="url(#collGrad)" strokeWidth={2.25} />
                </AreaChart>
              </ResponsiveContainer>
            </Surface>
          </Grid>
          <Grid item xs={12} md={4}>
            <Surface sx={{ height: '100%' }}>
              <SectionTitle title="Payment status" />
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Paid', value: analytics.payment_status?.paid || 0 },
                      { name: 'Pending', value: analytics.payment_status?.pending || 0 },
                      { name: 'Failed', value: analytics.payment_status?.failed || 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {[brand.success, brand.gold, brand.danger].map((color, i) => (
                      <Cell key={i} fill={color} />
                    ))}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip {...CHART_TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
              <Typography variant="body2" color="text.secondary" textAlign="center" mt={1}>
                Invested <strong>{fmtINR(analytics.total_invested || 0)}</strong>
              </Typography>
            </Surface>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Surface>
            <SectionTitle
              title="My chit groups"
              action={
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/chit-groups')}>
                  View all
                </Button>
              }
            />
            {memberships.length === 0 ? (
              <EmptyState
                icon={<GroupIcon />}
                title="No chit groups yet"
                description="Browse open groups and invest when a slot fits your plan."
                actionLabel="Browse groups"
                onAction={() => navigate('/chit-groups')}
              />
            ) : (
              memberships.slice(0, 3).map((m, i) => {
                const group = m.chit_group_id || m;
                const progress = group.duration_months > 0
                  ? ((group.current_month || 0) / group.duration_months) * 100
                  : 0;
                return (
                  <Box
                    key={i}
                    onClick={() => navigate(`/chit-groups/${group._id || group.id}`)}
                    sx={{
                      mb: 1.25,
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${brand.line}`,
                      bgcolor: brand.mist,
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'rgba(201,162,39,0.4)' },
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" mb={1} gap={1}>
                      <Typography fontWeight={700}>{group.group_name}</Typography>
                      <Chip
                        label={(group.status || '').toUpperCase()}
                        size="small"
                        color={group.status === 'active' ? 'success' : 'default'}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      {fmtINR(group.chit_value)} · {fmtINR(group.monthly_installment)}/month
                    </Typography>
                    <LinearProgress variant="determinate" value={progress} sx={{ height: 6 }} />
                    <Typography variant="caption" color="text.secondary" mt={0.75} display="block">
                      Month {group.current_month || 0} of {group.duration_months}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Surface>
        </Grid>

        <Grid item xs={12} md={5}>
          <Surface sx={{ mb: 2 }}>
            <SectionTitle
              title="Upcoming auctions"
              action={
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/auctions')}>
                  View all
                </Button>
              }
            />
            {upcomingAuctions.length === 0 ? (
              <Typography color="text.secondary" variant="body2" textAlign="center" py={2}>
                No upcoming auctions scheduled.
              </Typography>
            ) : (
              upcomingAuctions.slice(0, 3).map((auction, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1.5,
                    gap: 1.5,
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: auction.status === 'active' ? 'rgba(220,38,38,0.06)' : 'transparent',
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: auction.status === 'active' ? 'rgba(220,38,38,0.12)' : brand.mist,
                      color: auction.status === 'active' ? brand.danger : brand.navy,
                    }}
                  >
                    <GavelIcon fontSize="small" />
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {auction.chit_group_id?.group_name || auction.chitGroup?.group_name || 'Chit Group'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.75}>
                      Month {auction.month_number} —
                      {auction.status === 'active' ? (
                        <>
                          <span className="assure-live-dot" /> LIVE
                        </>
                      ) : (
                        ' Scheduled'
                      )}
                    </Typography>
                  </Box>
                </Box>
              ))
            )}
          </Surface>

          <Surface>
            <SectionTitle
              title="Recent transactions"
              action={
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/payments')}>
                  View all
                </Button>
              }
            />
            {recentPayments.length === 0 ? (
              <Typography color="text.secondary" variant="body2" textAlign="center" py={2}>
                No transactions recorded yet.
              </Typography>
            ) : (
              recentPayments.slice(0, 4).map((payment, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.25,
                    borderBottom: i < Math.min(3, recentPayments.length - 1) ? `1px solid ${brand.line}` : 'none',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor:
                        payment.payment_status === 'success'
                          ? 'rgba(21,128,61,0.1)'
                          : 'rgba(196,127,10,0.12)',
                      color: payment.payment_status === 'success' ? brand.success : brand.warning,
                    }}
                  >
                    {payment.payment_status === 'success' ? (
                      <CheckCircleIcon fontSize="small" />
                    ) : (
                      <WarningIcon fontSize="small" />
                    )}
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {payment.chit_group_id?.group_name || payment.chitGroup?.group_name || 'Chit Group'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {payment.payment_date
                        ? new Date(payment.payment_date).toLocaleDateString('en-IN')
                        : 'Pending'}
                    </Typography>
                  </Box>
                  <Typography fontWeight={800} color="primary">
                    {fmtINR(payment.amount || 0)}
                  </Typography>
                </Box>
              ))
            )}
          </Surface>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3.5 }}>
        <Typography variant="h6" gutterBottom>
          Trusted & certified
        </Typography>
        <Grid container spacing={1.5}>
          {[
            { src: '/assets/images/trusted_dpiit.png', label: 'DPIIT Registered' },
            { src: '/assets/images/trusted_telangana.png', label: 'Telangana Govt. Registered' },
            { src: '/assets/images/trusted_data_secured.png', label: 'Data Secured' },
          ].map((b) => (
            <Grid item xs={4} key={b.label}>
              <Surface sx={{ textAlign: 'center', py: 2 }}>
                <Box component="img" src={b.src} alt={b.label} sx={{ height: 44, objectFit: 'contain', mb: 1 }} />
                <Typography variant="caption" display="block" fontWeight={700}>
                  {b.label}
                </Typography>
              </Surface>
            </Grid>
          ))}
        </Grid>
      </Box>

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
        referralCode={displayUser?.referral_code}
      />
    </PageShell>
  );
};

export default Dashboard;
