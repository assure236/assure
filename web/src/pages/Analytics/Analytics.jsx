import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Paper, Typography, Box, Card, CardContent,
  CircularProgress, Alert, Tabs, Tab, Chip, Divider, Button,
  Table, TableBody, TableCell, TableHead, TableRow, LinearProgress,
  TextField, MenuItem
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Gavel as GavelIcon,
  AccountBalanceWallet as WalletIcon,
  EmojiEvents as TrophyIcon,
  BarChart as BarChartIcon,
  Calculate as CalcIcon,
  Download as DownloadIcon,
  CompareArrows as CompareIcon,
  Savings as SavingsIcon,
} from '@mui/icons-material';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import axios from 'axios';
import { useActiveMember } from '../../context/ActiveMemberContext';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const COLORS = ['#0B1F3B', '#4caf50', '#D4AF37', '#e91e63', '#9c27b0', '#00bcd4'];

// ─── Dividend Calculator (standalone) ────────────────────────────────────────
const DividendCalculator = () => {
  const [form, setForm] = useState({
    chit_value: 100000,
    duration: 20,
    members: 20,
    commission: 5,
    avg_bid_pct: 25,
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: Number(e.target.value) }));

  const chitValue = form.chit_value;
  const avgWinBid = chitValue * (form.avg_bid_pct / 100);
  const commissionAmt = chitValue * (form.commission / 100);
  const dividendPerMember = avgWinBid / form.members;
  const totalDividends = dividendPerMember * form.duration;
  const monthlyInstallment = chitValue / form.members;
  const totalPaid = monthlyInstallment * form.duration;
  const netGain = totalDividends - (monthlyInstallment * form.duration - chitValue);
  const winProbability = (1 / form.members) * 100;
  const effectiveReturn = ((totalDividends / totalPaid) * 100).toFixed(1);

  const projectionData = Array.from({ length: form.duration }, (_, i) => ({
    month: i + 1,
    dividend: Math.round(dividendPerMember),
    cumulative: Math.round(dividendPerMember * (i + 1)),
    installment: Math.round(monthlyInstallment),
  }));

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CalcIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Dividend & Return Calculator
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Estimate your probable dividend earnings and expected returns from any chit fund group.
      </Typography>

      <Grid container spacing={3}>
        {/* Inputs */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Chit Fund Parameters</Typography>
            <Grid container spacing={2} mt={0.5}>
              {[
                { label: 'Chit Value (₹)', key: 'chit_value', options: [50000, 100000, 200000, 500000, 1000000] },
                { label: 'Duration (months)', key: 'duration', options: [12, 18, 20, 24, 30, 36] },
                { label: 'Total Members', key: 'members', options: [10, 15, 20, 25, 30] },
                { label: 'Commission (%)', key: 'commission', options: [3, 4, 5, 6, 7, 8] },
                { label: 'Avg Winning Bid (%)', key: 'avg_bid_pct', options: [10, 15, 20, 25, 30, 35, 40] },
              ].map(({ label, key, options }) => (
                <Grid item xs={12} key={key}>
                  <TextField select fullWidth size="small" label={label} value={form[key]} onChange={set(key)}>
                    {options.map(o => (
                      <MenuItem key={o} value={o}>
                        {key === 'chit_value' ? `₹${o.toLocaleString('en-IN')}` : o}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Results */}
        <Grid item xs={12} md={7}>
          <Grid container spacing={2} mb={2}>
            {[
              { label: 'Monthly Installment', value: fmt(monthlyInstallment), color: '#0B1F3B' },
              { label: 'Avg Dividend / Month', value: fmt(dividendPerMember), color: '#4caf50' },
              { label: 'Total Dividends (Lifetime)', value: fmt(totalDividends), color: '#9c27b0' },
              { label: 'Win Probability / Month', value: `${winProbability.toFixed(1)}%`, color: '#D4AF37' },
              { label: 'Effective Return Rate', value: `${effectiveReturn}%`, color: '#e91e63' },
              { label: 'Commission (Foreman)', value: fmt(commissionAmt), color: '#607d8b' },
            ].map(({ label, value, color }) => (
              <Grid item xs={6} key={label}>
                <Paper sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${color}` }}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="h6" fontWeight={700} color={color}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Cumulative Chart */}
          <Paper sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="subtitle2" mb={1}>Cumulative Dividend Projection</Typography>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={projectionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4caf50" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4caf50" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [fmt(v), 'Cumulative Dividends']} />
                <Area type="monotone" dataKey="cumulative" stroke="#4caf50" fill="url(#divGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

// ─── Savings Goal Calculator ──────────────────────────────────────────────────
const SavingsGoalCalculator = () => {
  const [goal, setGoal] = useState({ target: 500000, months: 20, has_savings: 0 });
  const set = (k) => (e) => setGoal(f => ({ ...f, [k]: Number(e.target.value) }));

  const remaining = Math.max(0, goal.target - goal.has_savings);
  const monthlyNeeded = goal.months > 0 ? remaining / goal.months : 0;

  // Find best matching plan
  const plans = [
    { name: 'Silver Plan', value: 50000, monthly: 2500 },
    { name: 'Gold Plan', value: 100000, monthly: 5000 },
    { name: 'Diamond Plan', value: 200000, monthly: 10000 },
    { name: 'Platinum Plan', value: 500000, monthly: 25000 },
  ];
  const bestPlan = plans.find(p => p.monthly >= monthlyNeeded) || plans[plans.length - 1];
  const multiplePlans = monthlyNeeded > 25000;

  const savingsData = Array.from({ length: goal.months }, (_, i) => ({
    month: i + 1,
    saved: Math.round(monthlyNeeded * (i + 1)) + goal.has_savings,
    target: goal.target,
  }));

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CalcIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Savings Goal Planner
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Set your savings goal and see which chit plan helps you reach it fastest.
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Your Goal</Typography>
            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Target Amount (₹)" type="number"
                  value={goal.target} onChange={set('target')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Timeline (months)" type="number"
                  value={goal.months} onChange={set('months')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Existing Savings (₹)" type="number"
                  value={goal.has_savings} onChange={set('has_savings')} />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Grid container spacing={2} mb={2}>
            {[
              { label: 'Remaining Amount', value: fmt(remaining), color: '#0B1F3B' },
              { label: 'Monthly Savings Needed', value: fmt(monthlyNeeded), color: '#4caf50' },
              { label: 'Recommended Plan', value: multiplePlans ? 'Multiple Plans' : bestPlan.name, color: '#D4AF37' },
              { label: 'Plan Monthly', value: multiplePlans ? `${Math.ceil(monthlyNeeded / 25000)} × ₹25K` : fmt(bestPlan.monthly), color: '#9c27b0' },
            ].map(({ label, value, color }) => (
              <Grid item xs={6} key={label}>
                <Paper sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${color}` }}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="h6" fontWeight={700} color={color}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Paper sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="subtitle2" mb={1}>Savings Progress Projection</Typography>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={savingsData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B1F3B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0B1F3B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [fmt(v)]} />
                <Area type="monotone" dataKey="saved" stroke="#0B1F3B" fill="url(#savGrad)" strokeWidth={2} name="Savings" />
                <Line type="monotone" dataKey="target" stroke="#f44336" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Target" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

// ─── Chit Comparison Calculator ────────────────────────────────────────────────
const ChitComparisonCalculator = () => {
  const [planA, setPlanA] = useState({ chit_value: 100000, duration: 20, members: 20, commission: 5, avg_bid: 25 });
  const [planB, setPlanB] = useState({ chit_value: 200000, duration: 20, members: 20, commission: 5, avg_bid: 25 });

  const calc = (p) => {
    const monthly = p.chit_value / p.members;
    const avgWinBid = p.chit_value * (p.avg_bid / 100);
    const dividend = avgWinBid / p.members;
    const totalDiv = dividend * p.duration;
    const totalPaid = monthly * p.duration;
    const effectiveReturn = totalPaid > 0 ? ((totalDiv / totalPaid) * 100).toFixed(1) : '0';
    return { monthly, dividend, totalDiv, totalPaid, effectiveReturn };
  };

  const a = calc(planA);
  const b = calc(planB);

  const PlanInput = ({ plan, setPlan, label }) => (
    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>{label}</Typography>
      <Grid container spacing={1.5}>
        {[
          { label: 'Chit Value (₹)', key: 'chit_value', options: [50000, 100000, 200000, 500000] },
          { label: 'Duration', key: 'duration', options: [12, 18, 20, 24, 30] },
          { label: 'Members', key: 'members', options: [10, 15, 20, 25, 30] },
          { label: 'Avg Bid (%)', key: 'avg_bid', options: [10, 15, 20, 25, 30, 35, 40] },
        ].map(({ label, key, options }) => (
          <Grid item xs={6} key={key}>
            <TextField select fullWidth size="small" label={label} value={plan[key]}
              onChange={e => setPlan(f => ({ ...f, [key]: Number(e.target.value) }))}>
              {options.map(o => <MenuItem key={o} value={o}>{key === 'chit_value' ? `₹${o.toLocaleString('en-IN')}` : o}</MenuItem>)}
            </TextField>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );

  const metrics = [
    { label: 'Monthly Installment', a: fmt(a.monthly), b: fmt(b.monthly), betterIsLower: true, va: a.monthly, vb: b.monthly },
    { label: 'Dividend / Month', a: fmt(a.dividend), b: fmt(b.dividend), betterIsLower: false, va: a.dividend, vb: b.dividend },
    { label: 'Total Dividends', a: fmt(a.totalDiv), b: fmt(b.totalDiv), betterIsLower: false, va: a.totalDiv, vb: b.totalDiv },
    { label: 'Total Paid', a: fmt(a.totalPaid), b: fmt(b.totalPaid), betterIsLower: true, va: a.totalPaid, vb: b.totalPaid },
    { label: 'Return Rate', a: `${a.effectiveReturn}%`, b: `${b.effectiveReturn}%`, betterIsLower: false, va: parseFloat(a.effectiveReturn), vb: parseFloat(b.effectiveReturn) },
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CalcIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Compare Chit Plans
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Compare two chit plans side by side to see which one gives better returns.
      </Typography>
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <PlanInput plan={planA} setPlan={setPlanA} label="Plan A" />
        </Grid>
        <Grid item xs={12} md={6}>
          <PlanInput plan={planB} setPlan={setPlanB} label="Plan B" />
        </Grid>
      </Grid>
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>Comparison Results</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: '#0B1F3B' }}>Plan A</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: '#1E3A8A' }}>Plan B</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Better</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.map(m => {
              const aWins = m.betterIsLower ? m.va < m.vb : m.va > m.vb;
              const bWins = m.betterIsLower ? m.vb < m.va : m.vb > m.va;
              const tie = m.va === m.vb;
              return (
                <TableRow key={m.label}>
                  <TableCell>{m.label}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: aWins ? 700 : 400, color: aWins ? '#4caf50' : 'inherit' }}>{m.a}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: bWins ? 700 : 400, color: bWins ? '#4caf50' : 'inherit' }}>{m.b}</TableCell>
                  <TableCell align="center">
                    {tie ? <Chip size="small" label="Tie" /> : <Chip size="small" label={aWins ? 'Plan A' : 'Plan B'} color={aWins ? 'primary' : 'secondary'} />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

// ─── Main Analytics Page ──────────────────────────────────────────────────────
const Analytics = () => {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statement, setStatement] = useState(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const { refreshKey } = useActiveMember();

  useEffect(() => { fetchAnalytics(); }, [refreshKey]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, dividendRes] = await Promise.allSettled([
        axios.get('/dashboard/analytics'),
        axios.get('/dashboard/dividend-analytics'),
      ]);
      setData({
        analytics: analyticsRes.status === 'fulfilled' ? analyticsRes.value.data.data : null,
        dividend: dividendRes.status === 'fulfilled' ? dividendRes.value.data.data : null,
      });
    } catch (err) {
      setError('Could not load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatement = async () => {
    setStmtLoading(true);
    try {
      const res = await axios.get('/payments/my-payments');
      if (res.data.success) setStatement(res.data.data || []);
    } catch { setStatement([]); }
    finally { setStmtLoading(false); }
  };

  useEffect(() => { if (tab === 5) fetchStatement(); }, [tab, refreshKey]);

  const handleExportStatement = () => {
    if (!statement?.length) return;
    const headers = ['Date', 'Group', 'Type', 'Amount', 'Status', 'Ref'];
    const rows = statement.map(p => [
      p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '-',
      p.chit_group_id?.group_name || '-',
      p.payment_type || '-',
      p.total_amount || p.amount || 0,
      p.payment_status || '-',
      p.transaction_id || '-',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_account_statement.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const analytics = data?.analytics;
  const dividend = data?.dividend;
  const monthly = analytics?.monthly_collections || [];
  const paymentStatus = analytics?.payment_status || {};

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4">Analytics & Insights</Typography>
          <Typography variant="body2" color="text.secondary">
            Track your dividends, bidding patterns, payment health, and estimated returns.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportStatement}>
          Download Statement
        </Button>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }} variant="scrollable" scrollButtons="auto">
        <Tab label="My Overview" icon={<BarChartIcon />} iconPosition="start" />
        <Tab label="Dividend Analytics" icon={<WalletIcon />} iconPosition="start" />
        <Tab label="Dividend Calculator" icon={<CalcIcon />} iconPosition="start" />
        <Tab label="Savings Planner" icon={<SavingsIcon />} iconPosition="start" />
        <Tab label="Compare Plans" icon={<CompareIcon />} iconPosition="start" />
        <Tab label="Account Statement" icon={<DownloadIcon />} iconPosition="start" />
      </Tabs>

      {/* ── Tab 0: Overview ─────────────────────────────────────────── */}
      {tab === 0 && (
        <Grid container spacing={3}>
          {/* Payment Status Summary */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
              <Typography variant="h6" mb={2}>Payment Health</Typography>
              {[
                { label: 'Paid', value: paymentStatus.paid || 0, color: '#4caf50' },
                { label: 'Pending', value: paymentStatus.pending || 0, color: '#D4AF37' },
                { label: 'Failed', value: paymentStatus.failed || 0, color: '#f44336' },
              ].map(({ label, value, color }) => {
                const total = (paymentStatus.paid || 0) + (paymentStatus.pending || 0) + (paymentStatus.failed || 0) || 1;
                return (
                  <Box key={label} mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2">{label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{value}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(value / total) * 100}
                      sx={{ height: 8, borderRadius: 4, bgcolor: `${color}20`, '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                  </Box>
                );
              })}
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Total invested: <strong>₹{Number(analytics?.total_invested || 0).toLocaleString('en-IN')}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                Active chit groups: <strong>{analytics?.active_chits || 0}</strong>
              </Typography>
            </Paper>
          </Grid>

          {/* Monthly Chart */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" mb={2}>Monthly Payment History (6 Months)</Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => v > 0 ? `₹${(v / 1000).toFixed(0)}k` : '0'} />
                  <Tooltip formatter={v => [fmt(v), 'Amount Paid']} />
                  <Bar dataKey="amount" fill="#0B1F3B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Chit Group Details */}
          {analytics?.chit_details?.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" mb={2}>My Chit Groups — Payment Breakdown</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Group</TableCell>
                      <TableCell align="right">Chit Value</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.chit_details.map((c, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{c.group_name}</TableCell>
                        <TableCell align="right">{fmt(c.chit_value)}</TableCell>
                        <TableCell align="center">
                          <Chip label={c.status} size="small" color={c.status === 'active' ? 'success' : 'default'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── Tab 1: Dividend Analytics ────────────────────────────────── */}
      {tab === 1 && (
        <Box>
          {!dividend?.groups?.length ? (
            <Paper sx={{ p: 6, borderRadius: 3, textAlign: 'center' }}>
              <WalletIcon sx={{ fontSize: 64, color: 'grey.300' }} />
              <Typography color="text.secondary" mt={2}>
                Enroll in a chit group to see dividend analytics.
              </Typography>
            </Paper>
          ) : (
            dividend.groups.map((g, i) => (
              <Paper key={g.group_id} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1} mb={3}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{g.group_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Month {g.current_month} of {g.duration_months} &nbsp;|&nbsp; Chit Value: {fmt(g.chit_value)}
                    </Typography>
                  </Box>
                  <Chip
                    icon={<TrophyIcon />}
                    label={`Win Probability: ${g.win_probability_pct}%/month`}
                    color="primary" variant="outlined"
                  />
                </Box>

                <Grid container spacing={2} mb={3}>
                  {[
                    { label: 'Avg Dividend / Month', value: fmt(g.avg_dividend_per_member), color: '#4caf50' },
                    { label: 'Net Return (Lifetime)', value: fmt(g.net_return), color: '#0B1F3B' },
                    { label: 'Avg Winning Bid', value: fmt(g.avg_winning_bid), color: '#D4AF37' },
                    { label: 'Effective Return', value: `${g.effective_return_pct}%`, color: '#9c27b0' },
                    { label: 'Monthly Installment', value: fmt(g.monthly_installment), color: '#607d8b' },
                    { label: 'Completed Auctions', value: g.completed_auctions, color: '#e91e63' },
                  ].map(({ label, value, color }) => (
                    <Grid item xs={6} sm={4} md={2} key={label}>
                      <Box sx={{ p: 1.5, bgcolor: `${color}10`, borderRadius: 2, borderLeft: `3px solid ${color}`, height: '100%' }}>
                        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                        <Typography variant="subtitle2" fontWeight={700} color={color}>{value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                {/* Projected Dividends Chart */}
                <Typography variant="subtitle2" mb={1}>Monthly Dividend Projection</Typography>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={g.projected_dividends || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
                    <Tooltip formatter={v => [fmt(v)]} />
                    <Line type="monotone" dataKey="estimated_dividend" stroke="#4caf50" strokeWidth={2} dot={false} name="Est. Dividend" />
                    <Line type="monotone" dataKey="cumulative" stroke="#0B1F3B" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Cumulative" />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>

                {/* Bidding Pattern Insight */}
                <Alert severity="info" sx={{ mt: 2 }}>
                  <strong>Bidding Insight:</strong> Historical data shows average winning bid of {fmt(g.avg_winning_bid)}{' '}
                  ({g.avg_winning_bid > 0 && g.chit_value > 0 ? Math.round((g.avg_winning_bid / g.chit_value) * 100) : 25}% of chit value).
                  If bidding trends continue, estimated lifetime dividend: <strong>{fmt(g.net_return)}</strong>.
                </Alert>
              </Paper>
            ))
          )}
        </Box>
      )}

      {/* ── Tab 2: Dividend Calculator ───────────────────────────────── */}
      {tab === 2 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <DividendCalculator />
        </Paper>
      )}

      {/* ── Tab 3: Savings Goal Planner ──────────────────────────────── */}
      {tab === 3 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <SavingsGoalCalculator />
        </Paper>
      )}

      {/* ── Tab 4: Compare Plans ─────────────────────────────────────── */}
      {tab === 4 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <ChitComparisonCalculator />
        </Paper>
      )}

      {/* ── Tab 5: Account Statement ─────────────────────────────────── */}
      {tab === 5 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Account Statement</Typography>
            <Button variant="contained" size="small" startIcon={<DownloadIcon />}
              onClick={handleExportStatement} disabled={!statement?.length}>
              Export CSV
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {stmtLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
          ) : !statement?.length ? (
            <Alert severity="info">No payment records found.</Alert>
          ) : (
            <>
              <Grid container spacing={2} mb={3}>
                {(() => {
                  const total = statement.reduce((s, p) => s + (p.total_amount || p.amount || 0), 0);
                  const success = statement.filter(p => p.payment_status === 'success');
                  const pending = statement.filter(p => p.payment_status === 'pending' || p.payment_status === 'overdue');
                  return [
                    { label: 'Total Transactions', value: statement.length, color: '#0B1F3B' },
                    { label: 'Total Amount', value: fmt(total), color: '#4caf50' },
                    { label: 'Successful', value: success.length, color: '#388e3c' },
                    { label: 'Pending/Overdue', value: pending.length, color: '#B8960F' },
                  ].map(c => (
                    <Grid item xs={6} sm={3} key={c.label}>
                      <Paper sx={{ p: 2, borderLeft: `4px solid ${c.color}`, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                        <Typography variant="h6" fontWeight={700}>{c.value}</Typography>
                      </Paper>
                    </Grid>
                  ));
                })()}
              </Grid>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Date', 'Group', 'Month', 'Type', 'Amount', 'Status', 'Reference'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statement.map((p, i) => (
                      <TableRow key={p._id || i} hover>
                        <TableCell>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}</TableCell>
                        <TableCell>{p.chit_group_id?.group_name || '—'}</TableCell>
                        <TableCell>{p.month_number || '—'}</TableCell>
                        <TableCell><Chip label={p.payment_type || '—'} size="small" sx={{ textTransform: 'capitalize' }} /></TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{fmt(p.total_amount || p.amount)}</TableCell>
                        <TableCell>
                          <Chip label={p.payment_status} size="small"
                            color={p.payment_status === 'success' ? 'success' : p.payment_status === 'pending' ? 'warning' : 'error'} />
                        </TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary">{p.transaction_id || '—'}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </Paper>
      )}
    </Container>
  );
};

export default Analytics;
