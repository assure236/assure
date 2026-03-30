import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, TextField, MenuItem, Button, Divider, CircularProgress, Alert
} from '@mui/material';
import {
  AccountBalance, TrendingUp, Receipt, MoneyOff, Download,
  Sync as SyncIcon, Cloud as CloudIcon, CheckCircle, Error as ErrorIcon,
  People as PeopleIcon, Payments as PaymentsIcon, Business as BusinessIcon
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts';
import axios from 'axios';

const PAYMENT_TYPES = ['all', 'installment', 'commission', 'prize', 'penalty', 'refund'];

export default function Accounting() {
  const [tab, setTab] = useState('summary');
  const [pl, setPl] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerSum, setLedgerSum] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(50);
  const [filters, setFilters] = useState({ from: '', to: '', type: 'all' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ERPNext state
  const [erpConfigured, setErpConfigured] = useState(false);
  const [erpSummary, setErpSummary] = useState(null);
  const [erpSyncing, setErpSyncing] = useState(null); // 'members' | 'payments' | 'groups' | null
  const [erpSyncResult, setErpSyncResult] = useState(null);
  const [erpReport, setErpReport] = useState(null);
  const [erpReportType, setErpReportType] = useState('pl');
  const [erpLoading, setErpLoading] = useState(false);

  const fetchPL = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/accounting/pl`);
      setPl(res.data.data);
    } catch (e) {
      setError('Failed to load P&L data');
    } finally { setLoading(false); }
  }, []);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: page + 1, limit: rowsPerPage };
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.type && filters.type !== 'all') params.type = filters.type;
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/accounting/ledger`, { params });
      setLedger(res.data.data);
      setLedgerTotal(res.data.total);
      setLedgerSum(res.data.totalAmount);
    } catch (e) {
      setError('Failed to load ledger');
    } finally { setLoading(false); }
  }, [page, rowsPerPage, filters]);

  useEffect(() => { fetchPL(); fetchErpStatus(); }, [fetchPL]);
  useEffect(() => { if (tab === 'ledger') fetchLedger(); }, [tab, fetchLedger]);
  useEffect(() => { if (tab === 'erpnext' && erpConfigured) fetchErpSummary(); }, [tab, erpConfigured]);

  const fetchErpStatus = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/erpnext/status`);
      setErpConfigured(res.data.data?.configured || false);
    } catch {}
  };

  const fetchErpSummary = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/erpnext/summary`);
      if (res.data.success) setErpSummary(res.data.data);
    } catch {}
  };

  const handleErpSync = async (type) => {
    setErpSyncing(type);
    setErpSyncResult(null);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/admin/erpnext/sync/${type}`);
      if (res.data.success) setErpSyncResult({ type, ...res.data.data });
      fetchErpSummary();
    } catch (err) {
      setError(err.response?.data?.message || `Sync ${type} failed`);
    } finally { setErpSyncing(null); }
  };

  const fetchErpReport = async (reportType) => {
    setErpLoading(true);
    setErpReport(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/erpnext/reports/${reportType}`, {
        params: { from_date: filters.from || undefined, to_date: filters.to || undefined },
      });
      if (res.data.success) setErpReport(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch ERPNext report');
    } finally { setErpLoading(false); }
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const statCards = pl ? [
    { label: 'Total Collected', value: fmt(pl.summary?.total_collected), icon: <AccountBalance />, color: '#1976d2' },
    { label: 'Foreman Commission (5%)', value: fmt(pl.summary?.total_commission), icon: <TrendingUp />, color: '#388e3c' },
    { label: 'Late Fee Income', value: fmt(pl.summary?.total_late_fees), icon: <MoneyOff />, color: '#f57c00' },
    { label: 'Successful Payments', value: pl.summary?.successful_payments ?? 0, icon: <Receipt />, color: '#7b1fa2' },
  ] : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Accounting & Finance</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {['summary', 'ledger', 'erpnext'].map(t => (
            <Button key={t} variant={tab === t ? 'contained' : 'outlined'} onClick={() => setTab(t)} sx={{ textTransform: 'capitalize' }}>
              {t === 'summary' ? 'P&L Summary' : t === 'ledger' ? 'Payment Ledger' : 'ERPNext'}
            </Button>
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {tab === 'summary' && (
        <>
          {loading && !pl ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : pl && (
            <>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {statCards.map((c, i) => (
                  <Grid item xs={12} sm={6} md={3} key={i}>
                    <Card sx={{ borderTop: `4px solid ${c.color}` }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                            <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                          </Box>
                          <Box sx={{ color: c.color, opacity: 0.8 }}>{c.icon}</Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Monthly Collections</Typography>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={pl.monthly || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Legend />
                        <Bar dataKey="collection" fill="#1976d2" name="Collection" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit" fill="#388e3c" name="Commission" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Profit Trend</Typography>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={pl.monthly || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Line type="monotone" dataKey="profit" stroke="#388e3c" strokeWidth={2} dot={{ r: 4 }} name="Commission" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
              </Grid>
            </>
          )}
        </>
      )}

      {tab === 'ledger' && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }}
              value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            <TextField label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }}
              value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            <TextField select label="Type" size="small" value={filters.type} sx={{ minWidth: 140 }}
              onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              {PAYMENT_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>)}
            </TextField>
            <Button variant="contained" onClick={fetchLedger}>Apply</Button>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Total: <strong>{fmt(ledgerSum)}</strong></Typography>
              <Button variant="outlined" size="small" startIcon={<Download />}
                onClick={() => {
                  const headers = ['Date', 'Member', 'Mobile', 'Group', 'Type', 'Amount', 'Status', 'Ref'];
                  const rows2 = ledger.map(r => [
                    r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-IN') : '-',
                    r.user?.full_name || '-',
                    r.user?.mobile || '-',
                    r.chitGroup?.group_name || '-',
                    r.payment_type || '-',
                    r.amount || 0,
                    r.payment_status || '-',
                    r.transaction_id || '-'
                  ]);
                  const csv = [headers, ...rows2].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'ledger.csv'; a.click(); URL.revokeObjectURL(url);
                }}>Export CSV</Button>
            </Box>
          </Box>
          <Divider />
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <>
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {['Date', 'Member', 'Group', 'Type', 'Amount', 'Status', 'Ref'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ledger.length === 0 ? (
                      <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>No records found</TableCell></TableRow>
                    ) : ledger.map(row => (
                      <TableRow key={row._id || row.id} hover>
                        <TableCell>{row.payment_date ? new Date(row.payment_date).toLocaleDateString('en-IN') : '-'}</TableCell>
                        <TableCell>{row.user_id?.full_name || '-'}<br /><Typography variant="caption" color="text.secondary">{row.user_id?.mobile}</Typography></TableCell>
                        <TableCell><Typography variant="caption">{row.chit_group_id?.group_name || '-'}</Typography></TableCell>
                        <TableCell><Chip label={row.payment_type || '-'} size="small" sx={{ textTransform: 'capitalize' }} /></TableCell>
                        <TableCell><Typography fontWeight={600}>{fmt(row.total_amount)}</Typography></TableCell>
                        <TableCell>
                          <Chip label={row.payment_status} size="small"
                            color={row.payment_status === 'success' ? 'success' : row.payment_status === 'pending' ? 'warning' : 'error'} />
                        </TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary">{row.transaction_id || '-'}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div" count={ledgerTotal} page={page} rowsPerPage={rowsPerPage}
                onPageChange={(_, v) => setPage(v)} rowsPerPageOptions={[50]}
              />
            </>
          )}
        </Paper>
      )}
      {tab === 'erpnext' && (
        <Box>
          {!erpConfigured ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              ERPNext is not configured. Add <strong>ERPNEXT_URL</strong>, <strong>ERPNEXT_API_KEY</strong>, and <strong>ERPNEXT_API_SECRET</strong> in your backend <code>.env</code> file.
            </Alert>
          ) : (
            <>
              {/* Sync Summary Cards */}
              {erpSummary && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  {[
                    { label: 'Customers Synced', value: erpSummary.customers_synced, icon: <PeopleIcon />, color: '#1976d2' },
                    { label: 'Journal Entries', value: erpSummary.journal_entries, icon: <Receipt />, color: '#388e3c' },
                    { label: 'Projects Synced', value: erpSummary.projects_synced, icon: <BusinessIcon />, color: '#7b1fa2' },
                    { label: 'Total Debits', value: fmt(erpSummary.total_debits), icon: <AccountBalance />, color: '#f57c00' },
                  ].map((c, i) => (
                    <Grid item xs={12} sm={6} md={3} key={i}>
                      <Card sx={{ borderTop: `4px solid ${c.color}` }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                              <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                            </Box>
                            <Box sx={{ color: c.color, opacity: 0.8 }}>{c.icon}</Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* Sync Actions */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  <SyncIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Sync Data to ERPNext
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { key: 'members', label: 'Sync Members as Customers', desc: 'Push all members to ERPNext Customer list', icon: <PeopleIcon /> },
                    { key: 'payments', label: 'Sync Payments as Journal Entries', desc: 'Push successful payments to ERPNext accounting', icon: <PaymentsIcon /> },
                    { key: 'groups', label: 'Sync Chit Groups as Projects', desc: 'Push all chit groups to ERPNext Projects', icon: <BusinessIcon /> },
                  ].map(s => (
                    <Grid item xs={12} md={4} key={s.key}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {s.icon}
                            <Typography fontWeight={600}>{s.label}</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{s.desc}</Typography>
                          <Button
                            variant="contained" fullWidth
                            startIcon={erpSyncing === s.key ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                            onClick={() => handleErpSync(s.key)}
                            disabled={!!erpSyncing}
                          >
                            {erpSyncing === s.key ? 'Syncing...' : 'Sync Now'}
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                {erpSyncResult && (
                  <Alert severity={erpSyncResult.failed > 0 ? 'warning' : 'success'} sx={{ mt: 2 }}>
                    <strong>{erpSyncResult.type}:</strong> {erpSyncResult.synced} synced, {erpSyncResult.failed} failed.
                    {erpSyncResult.errors?.length > 0 && (
                      <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                        {erpSyncResult.errors.slice(0, 5).map((e, i) => (
                          <li key={i}>{e.member_id || e.payment_number || e.group}: {e.error}</li>
                        ))}
                      </Box>
                    )}
                  </Alert>
                )}
              </Paper>

              {/* ERPNext Financial Reports */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  ERPNext Financial Reports
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField select size="small" label="Report" value={erpReportType} sx={{ minWidth: 200 }}
                    onChange={e => setErpReportType(e.target.value)}>
                    {[
                      { value: 'pl', label: 'Profit & Loss' },
                      { value: 'balance-sheet', label: 'Balance Sheet' },
                      { value: 'general-ledger', label: 'General Ledger' },
                      { value: 'trial-balance', label: 'Trial Balance' },
                      { value: 'receivable', label: 'Accounts Receivable' },
                    ].map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                  <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }}
                    value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
                  <TextField label="To" type="date" size="small" InputLabelProps={{ shrink: true }}
                    value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
                  <Button variant="contained" onClick={() => fetchErpReport(erpReportType)}
                    startIcon={erpLoading ? <CircularProgress size={16} color="inherit" /> : <CloudIcon />}
                    disabled={erpLoading}>
                    Fetch Report
                  </Button>
                </Box>
                {erpReport && (
                  <Box>
                    {/* Columns & data from ERPNext report response */}
                    {erpReport[0] && erpReport[1] && (
                      <TableContainer sx={{ maxHeight: 500 }}>
                        <Table stickyHeader size="small">
                          <TableHead>
                            <TableRow>
                              {(erpReport[0] || []).map((col, i) => (
                                <TableCell key={i} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>
                                  {col.label || col.fieldname || `Col ${i}`}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(erpReport[1] || []).slice(0, 200).map((row, ri) => (
                              <TableRow key={ri} hover>
                                {(erpReport[0] || []).map((col, ci) => (
                                  <TableCell key={ci}>
                                    {typeof row[col.fieldname] === 'number'
                                      ? fmt(row[col.fieldname])
                                      : (row[col.fieldname] ?? '—')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                    {/* Fallback: raw JSON */}
                    {!erpReport[0] && (
                      <Alert severity="info">Report data received. Raw preview:
                        <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 11 }}>
                          {JSON.stringify(erpReport, null, 2)}
                        </pre>
                      </Alert>
                    )}
                  </Box>
                )}
              </Paper>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
