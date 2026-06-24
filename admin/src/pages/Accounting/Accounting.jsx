import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, TextField, MenuItem, Button, Divider, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Tabs, Tab,
  Tooltip, LinearProgress,
} from '@mui/material';
import {
  AccountBalance, TrendingUp, Receipt, MoneyOff, Download, Add,
  Sync as SyncIcon,
  AccountTree, MenuBook, Assessment, PieChart,
  BarChart as BarChartIcon, Cancel, Print, ArrowUpward, ArrowDownward,
  Payments as PaymentsIcon,
  CheckCircle, Error as ErrorIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import { io as socketIO } from 'socket.io-client';

const API = process.env.REACT_APP_API_URL;
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const ROOT_COLORS = {
  Asset: '#0B1F3B', Liability: '#d32f2f', Income: '#388e3c', Expense: '#B8960F', Equity: '#7b1fa2',
};

const VOUCHER_TYPES = [
  'all', 'Journal Entry', 'Payment Entry', 'Disbursement Entry',
  'Commission Entry', 'Late Fee Entry', 'Refund Entry',
];

export default function Accounting() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dashboard
  const [summary, setSummary] = useState(null);

  // Chart of Accounts
  const [accounts, setAccounts] = useState([]);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', account_number: '', parent_account: '', root_type: 'Expense', account_type: '', is_group: false, description: '' });

  // Journal Entries
  const [entries, setEntries] = useState([]);
  const [entriesTot, setEntriesTot] = useState(0);
  const [jePage, setJePage] = useState(0);
  const [jeFilters, setJeFilters] = useState({ from: '', to: '', voucher_type: 'all' });
  const [newJeOpen, setNewJeOpen] = useState(false);
  const [jeForm, setJeForm] = useState({ title: '', posting_date: new Date().toISOString().split('T')[0], voucher_type: 'Journal Entry', user_remark: '', items: [{ account: '', debit: 0, credit: 0, description: '' }, { account: '', debit: 0, credit: 0, description: '' }] });

  // General Ledger
  const [gl, setGl] = useState(null);
  const [glPage, setGlPage] = useState(0);
  const [glFilters, setGlFilters] = useState({ from: '', to: '', account: '', party: '' });

  // Trial Balance
  const [tb, setTb] = useState(null);
  const [tbFilters, setTbFilters] = useState({ from: '', to: '' });

  // P&L
  const [pl, setPl] = useState(null);
  const [plFilters, setPlFilters] = useState({ from: '', to: '', group_id: '' });

  // Balance Sheet
  const [bs, setBs] = useState(null);

  // Cash Flow
  const [cf, setCf] = useState(null);

  // Groups for filter
  const [groups, setGroups] = useState([]);

  // Live sync status
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', lastSyncAt: null, lastResult: null, error: null });
  const socketRef = useRef(null);
  const tabRef = useRef(tab);

  // Keep tabRef in sync so socket callback always sees latest tab
  useEffect(() => { tabRef.current = tab; }, [tab]);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/accounting/summary`);
      setSummary(res.data.data);
    } catch (e) { setError('Failed to load summary'); }
    finally { setLoading(false); }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/accounting/chart-of-accounts`);
      setAccounts(res.data.data || []);
    } catch (e) { setError('Failed to load accounts'); }
    finally { setLoading(false); }
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: jePage + 1, limit: 50 };
      if (jeFilters.from) params.from = jeFilters.from;
      if (jeFilters.to) params.to = jeFilters.to;
      if (jeFilters.voucher_type !== 'all') params.voucher_type = jeFilters.voucher_type;
      const res = await axios.get(`${API}/admin/accounting/journal-entries`, { params });
      setEntries(res.data.data || []);
      setEntriesTot(res.data.total || 0);
    } catch (e) { setError('Failed to load journal entries'); }
    finally { setLoading(false); }
  }, [jePage, jeFilters]);

  const fetchGL = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: glPage + 1, limit: 100 };
      if (glFilters.from) params.from = glFilters.from;
      if (glFilters.to) params.to = glFilters.to;
      if (glFilters.account) params.account = glFilters.account;
      if (glFilters.party) params.party = glFilters.party;
      const res = await axios.get(`${API}/admin/accounting/general-ledger`, { params });
      setGl(res.data.data);
    } catch (e) { setError('Failed to load general ledger'); }
    finally { setLoading(false); }
  }, [glPage, glFilters]);

  const fetchTB = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (tbFilters.from) params.from = tbFilters.from;
      if (tbFilters.to) params.to = tbFilters.to;
      const res = await axios.get(`${API}/admin/accounting/trial-balance`, { params });
      setTb(res.data.data);
    } catch (e) { setError('Failed to load trial balance'); }
    finally { setLoading(false); }
  }, [tbFilters]);

  const fetchPL = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (plFilters.from) params.from = plFilters.from;
      if (plFilters.to) params.to = plFilters.to;
      if (plFilters.group_id) params.group_id = plFilters.group_id;
      const res = await axios.get(`${API}/admin/accounting/pl`, { params });
      setPl(res.data.data);
    } catch (e) { setError('Failed to load P&L'); }
    finally { setLoading(false); }
  }, [plFilters]);

  const fetchBS = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/accounting/balance-sheet`);
      setBs(res.data.data);
    } catch (e) { setError('Failed to load balance sheet'); }
    finally { setLoading(false); }
  }, []);

  const fetchCF = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/accounting/cash-flow`);
      setCf(res.data.data);
    } catch (e) { setError('Failed to load cash flow'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSummary();
    axios.get(`${API}/admin/chit-groups?limit=200`).then(r => {
      const d = r.data.data;
      setGroups(Array.isArray(d) ? d : (d?.chit_groups || d?.groups || []));
    }).catch(() => {});
  }, [fetchSummary]);

  useEffect(() => {
    if (tab === 1) fetchAccounts();
    if (tab === 2) fetchEntries();
    if (tab === 3) fetchGL();
    if (tab === 4) fetchTB();
    if (tab === 5) fetchPL();
    if (tab === 6) fetchBS();
    if (tab === 7) fetchCF();
  }, [tab, fetchAccounts, fetchEntries, fetchGL, fetchTB, fetchPL, fetchBS, fetchCF]);

  // Socket.IO: live accounting updates — no polling, instant push
  useEffect(() => {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const baseUrl = apiUrl.replace(/\/api\/v\d+$/, '');
    const socket = socketIO(baseUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_accounting');
    });

    socket.on('accounting_updated', (data) => {
      // Update summary & sync status instantly from server push
      if (data.summary) setSummary(data.summary);
      if (data.syncStatus) setSyncStatus(data.syncStatus);

      // Re-fetch current tab data so tables/reports update live
      const t = tabRef.current;
      if (t === 1) fetchAccounts();
      if (t === 2) fetchEntries();
      if (t === 3) fetchGL();
      if (t === 4) fetchTB();
      if (t === 5) fetchPL();
      if (t === 6) fetchBS();
      if (t === 7) fetchCF();
    });

    return () => {
      socket.emit('leave_accounting');
      socket.disconnect();
    };
  }, [fetchAccounts, fetchEntries, fetchGL, fetchTB, fetchPL, fetchBS, fetchCF]);

  const handleCreateAccount = async () => {
    try {
      await axios.post(`${API}/admin/accounting/accounts`, newAccount);
      setNewAccountOpen(false);
      setNewAccount({ name: '', account_number: '', parent_account: '', root_type: 'Expense', account_type: '', is_group: false, description: '' });
      fetchAccounts();
      setSuccess('Account created successfully');
    } catch (e) { setError(e.response?.data?.message || 'Failed to create account'); }
  };

  const handleCreateJE = async () => {
    try {
      const items = jeForm.items.filter(i => i.account && (i.debit > 0 || i.credit > 0));
      await axios.post(`${API}/admin/accounting/journal-entries`, { ...jeForm, items });
      setNewJeOpen(false);
      fetchEntries();
      fetchSummary();
      setSuccess('Journal entry created');
    } catch (e) { setError(e.response?.data?.message || 'Failed to create entry'); }
  };

  const handleCancelJE = async (id) => {
    if (!window.confirm('Cancel this journal entry? Account balances will be reversed.')) return;
    try {
      await axios.post(`${API}/admin/accounting/journal-entries/${id}/cancel`);
      fetchEntries();
      fetchSummary();
      setSuccess('Entry cancelled');
    } catch (e) { setError(e.response?.data?.message || 'Failed to cancel'); }
  };

  const handleBulkPost = async () => {
    if (!window.confirm('Post all historical payments as journal entries? This may take a while.')) return;
    try {
      setLoading(true);
      const res = await axios.post(`${API}/admin/accounting/bulk-post`);
      const d = res.data.data;
      setSuccess(`Bulk post complete: ${d.posted} posted, ${d.skipped} already existed, ${d.failed} failed`);
      fetchSummary();
      fetchEntries();
    } catch (e) { setError(e.response?.data?.message || 'Bulk post failed'); }
    finally { setLoading(false); }
  };

  const exportCSV = (headers, rows, filename) => {
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const addJeRow = () => setJeForm(f => ({ ...f, items: [...f.items, { account: '', debit: 0, credit: 0, description: '' }] }));
  const removeJeRow = (i) => setJeForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const jeTotDebit = jeForm.items.reduce((s, i) => s + (parseFloat(i.debit) || 0), 0);
  const jeTotCredit = jeForm.items.reduce((s, i) => s + (parseFloat(i.credit) || 0), 0);
  const jeBalanced = Math.abs(jeTotDebit - jeTotCredit) < 0.01;

  const leafAccounts = accounts.filter(a => !a.is_group);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Accounting & Finance</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Live Sync Status Indicator */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 0.8, borderRadius: 2,
            bgcolor: syncStatus.status === 'syncing' ? '#e3f2fd' : syncStatus.status === 'error' ? '#ffebee' : '#e8f5e9',
            border: '1px solid',
            borderColor: syncStatus.status === 'syncing' ? '#90caf9' : syncStatus.status === 'error' ? '#ef9a9a' : '#a5d6a7',
          }}>
            {syncStatus.status === 'syncing' ? (
              <SyncIcon sx={{ color: '#1976d2', animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }, fontSize: 20 }} />
            ) : syncStatus.status === 'error' ? (
              <ErrorIcon sx={{ color: '#d32f2f', fontSize: 20 }} />
            ) : (
              <CheckCircle sx={{ color: '#388e3c', fontSize: 20 }} />
            )}
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{
                color: syncStatus.status === 'syncing' ? '#1976d2' : syncStatus.status === 'error' ? '#d32f2f' : '#388e3c',
                lineHeight: 1.2, display: 'block',
              }}>
                {syncStatus.status === 'syncing' ? 'Syncing...' : syncStatus.status === 'error' ? 'Sync Error' : 'Synced'}
              </Typography>
              {syncStatus.lastSyncAt && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                  {new Date(syncStatus.lastSyncAt).toLocaleTimeString('en-IN')}
                </Typography>
              )}
            </Box>
            {syncStatus.status === 'error' && syncStatus.error && (
              <Tooltip title={syncStatus.error}><ErrorIcon sx={{ color: '#d32f2f', fontSize: 16, cursor: 'pointer' }} /></Tooltip>
            )}
            {syncStatus.lastResult && syncStatus.lastResult.posted > 0 && (
              <Chip label={`+${syncStatus.lastResult.posted}`} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            )}
          </Box>

        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<Assessment />} label="Dashboard" iconPosition="start" />
        <Tab icon={<AccountTree />} label="Chart of Accounts" iconPosition="start" />
        <Tab icon={<MenuBook />} label="Journal Entries" iconPosition="start" />
        <Tab icon={<Receipt />} label="General Ledger" iconPosition="start" />
        <Tab icon={<BarChartIcon />} label="Trial Balance" iconPosition="start" />
        <Tab icon={<TrendingUp />} label="Profit & Loss" iconPosition="start" />
        <Tab icon={<AccountBalance />} label="Balance Sheet" iconPosition="start" />
        <Tab icon={<PieChart />} label="Cash Flow" iconPosition="start" />
      </Tabs>

      {/* DASHBOARD */}
      {tab === 0 && summary && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'FY Revenue', value: fmt(summary.fy_income), icon: <TrendingUp />, color: '#388e3c' },
              { label: 'FY Expenses', value: fmt(summary.fy_expense), icon: <MoneyOff />, color: '#B8960F' },
              { label: 'FY Net Profit', value: fmt(summary.fy_profit), icon: <AccountBalance />, color: summary.fy_profit >= 0 ? '#0B1F3B' : '#d32f2f' },
              { label: 'Cash & Bank', value: fmt(summary.cash_balance), icon: <PaymentsIcon />, color: '#00838f' },
              { label: 'This Month Revenue', value: fmt(summary.month_income), icon: <TrendingUp />, color: '#388e3c' },
              { label: 'This Month Profit', value: fmt(summary.month_profit), icon: <AccountBalance />, color: '#0B1F3B' },
              { label: 'Total Journal Entries', value: summary.total_entries || 0, icon: <MenuBook />, color: '#7b1fa2' },
              { label: 'Active Accounts', value: summary.total_accounts || 0, icon: <AccountTree />, color: '#455a64' },
            ].map((c, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card sx={{ borderLeft: `4px solid ${c.color}`, height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                        <Typography variant="h6" fontWeight={700}>{c.value}</Typography>
                      </Box>
                      <Box sx={{ color: c.color, opacity: 0.7 }}>{c.icon}</Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>Quick Actions</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Button fullWidth variant="outlined" startIcon={<Add />} onClick={() => { setTab(2); setNewJeOpen(true); }}>Journal Entry</Button>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Button fullWidth variant="outlined" startIcon={<Receipt />} onClick={() => setTab(3)}>General Ledger</Button>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Button fullWidth variant="outlined" startIcon={<Assessment />} onClick={() => setTab(5)}>View P&L</Button>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Button fullWidth variant="outlined" startIcon={<AccountBalance />} onClick={() => setTab(6)}>Balance Sheet</Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>Financial Health</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Receivables Outstanding</Typography>
                    <Typography variant="h6" fontWeight={600} color="warning.main">{fmt(summary.receivable_balance)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Profit Margin</Typography>
                    <Typography variant="h6" fontWeight={600} color={summary.fy_income > 0 ? 'success.main' : 'text.secondary'}>
                      {summary.fy_income > 0 ? ((summary.fy_profit / summary.fy_income) * 100).toFixed(1) + '%' : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {/* CHART OF ACCOUNTS */}
      {tab === 1 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={600}>Chart of Accounts</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setNewAccountOpen(true)}>New Account</Button>
          </Box>
          <Divider />
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {['Code', 'Account Name', 'Type', 'Root Type', 'Balance', 'Status'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map(acc => (
                  <TableRow key={acc.name} hover sx={{ bgcolor: acc.is_group ? 'grey.50' : 'inherit' }}>
                    <TableCell><Typography variant="caption" fontFamily="monospace">{acc.account_number || '-'}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ pl: acc.parent_account ? (accounts.find(a => a.name === acc.parent_account)?.parent_account ? 4 : 2) : 0 }}>
                        <Typography fontWeight={acc.is_group ? 700 : 400} variant="body2">
                          {acc.is_group ? '\u{1F4C1} ' : '  '}{acc.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption">{acc.account_type || '-'}</Typography></TableCell>
                    <TableCell>
                      <Chip label={acc.root_type} size="small" sx={{ bgcolor: ROOT_COLORS[acc.root_type] + '20', color: ROOT_COLORS[acc.root_type], fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      {!acc.is_group && <Typography fontWeight={600} color={acc.balance >= 0 ? 'inherit' : 'error.main'}>{fmt(acc.balance)}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip label={acc.is_active ? 'Active' : 'Inactive'} size="small" color={acc.is_active ? 'success' : 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Typography variant="caption" color="text.secondary">{accounts.length} accounts</Typography>
          </Box>
        </Paper>
      )}

      {/* JOURNAL ENTRIES */}
      {tab === 2 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} value={jeFilters.from}
              onChange={e => setJeFilters(f => ({ ...f, from: e.target.value }))} />
            <TextField label="To" type="date" size="small" InputLabelProps={{ shrink: true }} value={jeFilters.to}
              onChange={e => setJeFilters(f => ({ ...f, to: e.target.value }))} />
            <TextField select label="Type" size="small" value={jeFilters.voucher_type} sx={{ minWidth: 180 }}
              onChange={e => setJeFilters(f => ({ ...f, voucher_type: e.target.value }))}>
              {VOUCHER_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>)}
            </TextField>
            <Button variant="contained" onClick={fetchEntries}>Filter</Button>
            <Box sx={{ ml: 'auto' }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => setNewJeOpen(true)}>New Entry</Button>
            </Box>
          </Box>
          <Divider />
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {['Voucher #', 'Date', 'Type', 'Title', 'Debit', 'Credit', 'Group', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}>No journal entries found. Post payments or create manual entries.</TableCell></TableRow>
                ) : entries.map(e => (
                  <TableRow key={e._id} hover>
                    <TableCell><Typography variant="caption" fontFamily="monospace">{e.voucher_number}</Typography></TableCell>
                    <TableCell>{new Date(e.posting_date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell><Chip label={e.voucher_type} size="small" variant="outlined" /></TableCell>
                    <TableCell>
                      <Typography variant="body2">{e.title || e.user_remark || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">{e.items?.length} line items</Typography>
                    </TableCell>
                    <TableCell><Typography fontWeight={600} color="success.main">{fmt(e.total_debit)}</Typography></TableCell>
                    <TableCell><Typography fontWeight={600} color="error.main">{fmt(e.total_credit)}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{e.chit_group_id?.group_name || '-'}</Typography></TableCell>
                    <TableCell>
                      {!e.is_cancelled && (
                        <Tooltip title="Cancel Entry">
                          <IconButton size="small" color="error" onClick={() => handleCancelJE(e._id)}><Cancel fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {e.is_cancelled && <Chip label="Cancelled" size="small" color="default" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={entriesTot} page={jePage} rowsPerPage={50}
            onPageChange={(_, v) => setJePage(v)} rowsPerPageOptions={[50]} />
        </Paper>
      )}

      {/* GENERAL LEDGER */}
      {tab === 3 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} value={glFilters.from}
              onChange={e => setGlFilters(f => ({ ...f, from: e.target.value }))} />
            <TextField label="To" type="date" size="small" InputLabelProps={{ shrink: true }} value={glFilters.to}
              onChange={e => setGlFilters(f => ({ ...f, to: e.target.value }))} />
            <TextField select label="Account" size="small" value={glFilters.account} sx={{ minWidth: 220 }}
              onChange={e => setGlFilters(f => ({ ...f, account: e.target.value }))}>
              <MenuItem value="">All Accounts</MenuItem>
              {leafAccounts.map(a => <MenuItem key={a.name} value={a.name}>{a.account_number ? `${a.account_number} - ` : ''}{a.name}</MenuItem>)}
            </TextField>
            <TextField label="Party" size="small" value={glFilters.party} placeholder="Member name..."
              onChange={e => setGlFilters(f => ({ ...f, party: e.target.value }))} />
            <Button variant="contained" onClick={fetchGL}>Filter</Button>
            {gl && (
              <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2">
                  Dr: <strong style={{ color: '#388e3c' }}>{fmt(gl.total_debit)}</strong> | Cr: <strong style={{ color: '#d32f2f' }}>{fmt(gl.total_credit)}</strong>
                </Typography>
                <Button size="small" startIcon={<Download />} onClick={() => exportCSV(
                  ['Date', 'Voucher', 'Type', 'Account', 'Party', 'Debit', 'Credit', 'Description'],
                  (gl.entries || []).map(e => [new Date(e.posting_date).toLocaleDateString('en-IN'), e.voucher_number, e.voucher_type, e.account, e.party || '', e.debit || 0, e.credit || 0, e.description || '']),
                  'general-ledger.csv'
                )}>Export</Button>
              </Box>
            )}
          </Box>
          <Divider />
          {gl && (
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['Date', 'Voucher #', 'Type', 'Account', 'Party', 'Debit', 'Credit', 'Description'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(gl.entries || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}>No ledger entries</TableCell></TableRow>
                  ) : (gl.entries || []).map((e, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{new Date(e.posting_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell><Typography variant="caption" fontFamily="monospace">{e.voucher_number}</Typography></TableCell>
                      <TableCell><Chip label={e.voucher_type} size="small" variant="outlined" /></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{e.account}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{e.party || '-'}</Typography></TableCell>
                      <TableCell>{e.debit > 0 && <Typography fontWeight={600} color="success.main">{fmt(e.debit)}</Typography>}</TableCell>
                      <TableCell>{e.credit > 0 && <Typography fontWeight={600} color="error.main">{fmt(e.credit)}</Typography>}</TableCell>
                      <TableCell><Typography variant="caption">{e.description || e.user_remark || '-'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* TRIAL BALANCE */}
      {tab === 4 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} value={tbFilters.from}
              onChange={e => setTbFilters(f => ({ ...f, from: e.target.value }))} />
            <TextField label="To" type="date" size="small" InputLabelProps={{ shrink: true }} value={tbFilters.to}
              onChange={e => setTbFilters(f => ({ ...f, to: e.target.value }))} />
            <Button variant="contained" onClick={fetchTB}>Generate</Button>
            {tb && (
              <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                <Chip label={Math.abs(tb.difference) < 1 ? 'Balanced' : `Difference: ${fmt(tb.difference)}`}
                  color={Math.abs(tb.difference) < 1 ? 'success' : 'error'} />
                <Button size="small" startIcon={<Download />} onClick={() => exportCSV(
                  ['Account', 'Code', 'Type', 'Total Debit', 'Total Credit', 'Balance'],
                  (tb.entries || []).map(e => [e.account, e.account_number, e.root_type, e.total_debit, e.total_credit, e.balance]),
                  'trial-balance.csv'
                )}>Export</Button>
              </Box>
            )}
          </Box>
          <Divider />
          {tb && (
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['Account', 'Code', 'Root Type', 'Total Debit', 'Total Credit', 'Balance'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(tb.entries || []).map((e, i) => (
                    <TableRow key={i} hover>
                      <TableCell><Typography fontWeight={500}>{e.account}</Typography></TableCell>
                      <TableCell><Typography variant="caption" fontFamily="monospace">{e.account_number}</Typography></TableCell>
                      <TableCell><Chip label={e.root_type} size="small" sx={{ bgcolor: ROOT_COLORS[e.root_type] + '20', color: ROOT_COLORS[e.root_type] }} /></TableCell>
                      <TableCell><Typography fontWeight={600} color="success.main">{fmt(e.total_debit)}</Typography></TableCell>
                      <TableCell><Typography fontWeight={600} color="error.main">{fmt(e.total_credit)}</Typography></TableCell>
                      <TableCell><Typography fontWeight={700} color={e.balance >= 0 ? 'inherit' : 'error.main'}>{fmt(e.balance)}</Typography></TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell colSpan={3}><Typography fontWeight={700}>TOTAL</Typography></TableCell>
                    <TableCell><Typography fontWeight={700} color="success.main">{fmt(tb.total_debit)}</Typography></TableCell>
                    <TableCell><Typography fontWeight={700} color="error.main">{fmt(tb.total_credit)}</Typography></TableCell>
                    <TableCell><Typography fontWeight={700}>{fmt(tb.difference)}</Typography></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* PROFIT & LOSS */}
      {tab === 5 && (
        <>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} value={plFilters.from}
                onChange={e => setPlFilters(f => ({ ...f, from: e.target.value }))} />
              <TextField label="To" type="date" size="small" InputLabelProps={{ shrink: true }} value={plFilters.to}
                onChange={e => setPlFilters(f => ({ ...f, to: e.target.value }))} />
              <TextField select label="Chit Group" size="small" value={plFilters.group_id} sx={{ minWidth: 200 }}
                onChange={e => setPlFilters(f => ({ ...f, group_id: e.target.value }))}>
                <MenuItem value="">All Groups</MenuItem>
                {groups.map(g => <MenuItem key={g._id} value={g._id}>{g.group_name}</MenuItem>)}
              </TextField>
              <Button variant="contained" onClick={fetchPL}>Generate</Button>
              {pl && (
                <Box sx={{ ml: 'auto' }}>
                  <Button size="small" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
                  <Button size="small" startIcon={<Download />} sx={{ ml: 1 }} onClick={() => exportCSV(
                    ['Category', 'Account', 'Amount'],
                    [...(pl.income || []).map(i => ['Income', i.account, i.amount]), ...(pl.expenses || []).map(e => ['Expense', e.account, e.amount])],
                    'profit-and-loss.csv'
                  )}>Export</Button>
                </Box>
              )}
            </Box>
          </Paper>
          {pl && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'Total Income', value: fmt(pl.total_income), color: '#388e3c', icon: <ArrowUpward /> },
                  { label: 'Total Expenses', value: fmt(pl.total_expenses), color: '#B8960F', icon: <ArrowDownward /> },
                  { label: 'Net Profit', value: fmt(pl.net_profit), color: pl.net_profit >= 0 ? '#0B1F3B' : '#d32f2f', icon: <TrendingUp /> },
                ].map((c, i) => (
                  <Grid item xs={12} md={4} key={i}>
                    <Card sx={{ borderTop: `4px solid ${c.color}` }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                            <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                          </Box>
                          <Box sx={{ color: c.color }}>{c.icon}</Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} color="success.main" gutterBottom>Income</Typography>
                    <Divider sx={{ mb: 2 }} />
                    {(pl.income || []).length === 0 ? (
                      <Typography color="text.secondary">No income recorded yet</Typography>
                    ) : (pl.income || []).map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                        <Typography variant="body2">{item.account}</Typography>
                        <Typography fontWeight={600} color="success.main">{fmt(item.amount)}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, mt: 1, borderTop: '2px solid #388e3c' }}>
                      <Typography fontWeight={700}>Total Income</Typography>
                      <Typography fontWeight={700} color="success.main">{fmt(pl.total_income)}</Typography>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} color="warning.main" gutterBottom>Expenses</Typography>
                    <Divider sx={{ mb: 2 }} />
                    {(pl.expenses || []).length === 0 ? (
                      <Typography color="text.secondary">No expenses recorded yet</Typography>
                    ) : (pl.expenses || []).map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                        <Typography variant="body2">{item.account}</Typography>
                        <Typography fontWeight={600} color="warning.main">{fmt(item.amount)}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, mt: 1, borderTop: '2px solid #B8960F' }}>
                      <Typography fontWeight={700}>Total Expenses</Typography>
                      <Typography fontWeight={700} color="warning.main">{fmt(pl.total_expenses)}</Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
              {(pl.monthly || []).length > 0 && (
                <Paper sx={{ p: 3, mt: 3 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>Monthly Trend</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pl.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={v => `\u20B9${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <RTooltip formatter={(v) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="income" fill="#388e3c" name="Income" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#B8960F" name="Expense" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" fill="#0B1F3B" name="Profit" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              )}
            </>
          )}
        </>
      )}

      {/* BALANCE SHEET */}
      {tab === 6 && bs && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">As of {new Date(bs.as_of_date).toLocaleDateString('en-IN')}</Typography>
            <Chip label={bs.is_balanced ? 'Balanced' : 'NOT Balanced'} color={bs.is_balanced ? 'success' : 'error'} />
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>Assets</Typography>
                <Divider sx={{ mb: 2 }} />
                {(bs.assets || []).map((a, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                    <Typography variant="body2">{a.account}</Typography>
                    <Typography fontWeight={600}>{fmt(a.balance)}</Typography>
                  </Box>
                ))}
                {(bs.assets || []).length === 0 && <Typography color="text.secondary">No asset entries yet</Typography>}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, mt: 1, borderTop: '2px solid #0B1F3B' }}>
                  <Typography fontWeight={700}>Total Assets</Typography>
                  <Typography fontWeight={700} color="primary">{fmt(bs.total_assets)}</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" fontWeight={700} color="error" gutterBottom>Liabilities</Typography>
                <Divider sx={{ mb: 2 }} />
                {(bs.liabilities || []).map((l, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                    <Typography variant="body2">{l.account}</Typography>
                    <Typography fontWeight={600}>{fmt(l.balance)}</Typography>
                  </Box>
                ))}
                {(bs.liabilities || []).length === 0 && <Typography color="text.secondary">No liability entries yet</Typography>}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, mt: 1, borderTop: '2px solid #d32f2f' }}>
                  <Typography fontWeight={700}>Total Liabilities</Typography>
                  <Typography fontWeight={700} color="error">{fmt(bs.total_liabilities)}</Typography>
                </Box>
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} color="secondary" gutterBottom>Equity</Typography>
                <Divider sx={{ mb: 2 }} />
                {(bs.equity || []).map((e, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                    <Typography variant="body2">{e.account}</Typography>
                    <Typography fontWeight={600}>{fmt(e.balance)}</Typography>
                  </Box>
                ))}
                {(bs.equity || []).length === 0 && <Typography color="text.secondary">No equity entries yet</Typography>}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, mt: 1, borderTop: '2px solid #7b1fa2' }}>
                  <Typography fontWeight={700}>Total Equity</Typography>
                  <Typography fontWeight={700} color="secondary">{fmt(bs.total_equity)}</Typography>
                </Box>
              </Paper>
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontWeight={700}>Liabilities + Equity</Typography>
                  <Typography fontWeight={700}>{fmt(bs.total_liabilities_and_equity)}</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {/* CASH FLOW */}
      {tab === 7 && cf && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Cash Inflow', value: fmt(cf.operating?.inflow), color: '#388e3c' },
              { label: 'Cash Outflow', value: fmt(cf.operating?.outflow), color: '#d32f2f' },
              { label: 'Net Cash Flow', value: fmt(cf.net_cash_flow), color: cf.net_cash_flow >= 0 ? '#0B1F3B' : '#d32f2f' },
            ].map((c, i) => (
              <Grid item xs={12} md={4} key={i}>
                <Card sx={{ borderTop: `4px solid ${c.color}` }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Cash Flow by Type</Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Type', 'Inflow', 'Outflow', 'Net'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(cf.by_type || []).map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell><Chip label={row.type} size="small" variant="outlined" /></TableCell>
                      <TableCell><Typography color="success.main" fontWeight={600}>{fmt(row.inflow)}</Typography></TableCell>
                      <TableCell><Typography color="error.main" fontWeight={600}>{fmt(row.outflow)}</Typography></TableCell>
                      <TableCell><Typography fontWeight={700} color={row.net >= 0 ? 'success.main' : 'error.main'}>{fmt(row.net)}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          {(cf.by_type || []).length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Cash Flow Distribution</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cf.by_type}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `\u20B9${(v / 1000).toFixed(0)}k`} />
                  <RTooltip formatter={v => fmt(v)} />
                  <Legend />
                  <Bar dataKey="inflow" fill="#388e3c" name="Inflow" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" fill="#d32f2f" name="Outflow" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}
        </>
      )}

      {/* NEW ACCOUNT DIALOG */}
      <Dialog open={newAccountOpen} onClose={() => setNewAccountOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Account</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={8}>
              <TextField fullWidth label="Account Name" value={newAccount.name}
                onChange={e => setNewAccount(f => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Account Number" value={newAccount.account_number}
                onChange={e => setNewAccount(f => ({ ...f, account_number: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth label="Root Type" value={newAccount.root_type}
                onChange={e => setNewAccount(f => ({ ...f, root_type: e.target.value }))}>
                {['Asset', 'Liability', 'Income', 'Expense', 'Equity'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth label="Parent Account" value={newAccount.parent_account}
                onChange={e => setNewAccount(f => ({ ...f, parent_account: e.target.value }))}>
                <MenuItem value="">None (Root)</MenuItem>
                {accounts.filter(a => a.is_group).map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth label="Account Type" value={newAccount.account_type || ''}
                onChange={e => setNewAccount(f => ({ ...f, account_type: e.target.value || null }))}>
                <MenuItem value="">None</MenuItem>
                {['Bank', 'Cash', 'Receivable', 'Payable', 'Income Account', 'Expense Account', 'Tax', 'Commission', 'Fixed Asset'].map(t =>
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                )}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth label="Is Group?" value={newAccount.is_group ? 'yes' : 'no'}
                onChange={e => setNewAccount(f => ({ ...f, is_group: e.target.value === 'yes' }))}>
                <MenuItem value="no">No (Ledger)</MenuItem>
                <MenuItem value="yes">Yes (Group)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" multiline rows={2} value={newAccount.description}
                onChange={e => setNewAccount(f => ({ ...f, description: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewAccountOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAccount} disabled={!newAccount.name}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* NEW JOURNAL ENTRY DIALOG */}
      <Dialog open={newJeOpen} onClose={() => setNewJeOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Journal Entry</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
            <Grid item xs={4}>
              <TextField fullWidth label="Title" value={jeForm.title}
                onChange={e => setJeForm(f => ({ ...f, title: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth type="date" label="Posting Date" InputLabelProps={{ shrink: true }}
                value={jeForm.posting_date} onChange={e => setJeForm(f => ({ ...f, posting_date: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField select fullWidth label="Type" value={jeForm.voucher_type}
                onChange={e => setJeForm(f => ({ ...f, voucher_type: e.target.value }))}>
                {VOUCHER_TYPES.filter(t => t !== 'all').map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Line Items</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Account</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Debit</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Credit</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jeForm.items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <TextField select fullWidth size="small" value={item.account}
                      onChange={e => { const items = [...jeForm.items]; items[i] = { ...items[i], account: e.target.value }; setJeForm(f => ({ ...f, items })); }}>
                      {leafAccounts.map(a => <MenuItem key={a.name} value={a.name}>{a.account_number ? `${a.account_number} - ` : ''}{a.name}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={item.debit} sx={{ width: 120 }}
                      onChange={e => { const items = [...jeForm.items]; items[i] = { ...items[i], debit: parseFloat(e.target.value) || 0 }; setJeForm(f => ({ ...f, items })); }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={item.credit} sx={{ width: 120 }}
                      onChange={e => { const items = [...jeForm.items]; items[i] = { ...items[i], credit: parseFloat(e.target.value) || 0 }; setJeForm(f => ({ ...f, items })); }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={item.description || ''}
                      onChange={e => { const items = [...jeForm.items]; items[i] = { ...items[i], description: e.target.value }; setJeForm(f => ({ ...f, items })); }} />
                  </TableCell>
                  <TableCell>
                    {jeForm.items.length > 2 && (
                      <IconButton size="small" color="error" onClick={() => removeJeRow(i)}><Cancel fontSize="small" /></IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, alignItems: 'center' }}>
            <Button size="small" startIcon={<Add />} onClick={addJeRow}>Add Row</Button>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Typography>Total Debit: <strong style={{ color: '#388e3c' }}>{fmt(jeTotDebit)}</strong></Typography>
              <Typography>Total Credit: <strong style={{ color: '#d32f2f' }}>{fmt(jeTotCredit)}</strong></Typography>
              <Chip label={jeBalanced ? 'Balanced' : `Diff: ${fmt(Math.abs(jeTotDebit - jeTotCredit))}`}
                color={jeBalanced ? 'success' : 'error'} size="small" />
            </Box>
          </Box>
          <TextField fullWidth label="Remarks" multiline rows={2} sx={{ mt: 2 }}
            value={jeForm.user_remark} onChange={e => setJeForm(f => ({ ...f, user_remark: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewJeOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateJE} disabled={!jeBalanced || jeTotDebit === 0}>Post Entry</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
