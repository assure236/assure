import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, TextField, MenuItem, Button, Divider, CircularProgress, Alert
} from '@mui/material';
import {
  AccountBalance, TrendingUp, Receipt, MoneyOff, Download
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

  useEffect(() => { fetchPL(); }, [fetchPL]);
  useEffect(() => { if (tab === 'ledger') fetchLedger(); }, [tab, fetchLedger]);

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
          {['summary', 'ledger'].map(t => (
            <Button key={t} variant={tab === t ? 'contained' : 'outlined'} onClick={() => setTab(t)} sx={{ textTransform: 'capitalize' }}>
              {t === 'summary' ? 'P&L Summary' : 'Payment Ledger'}
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
    </Box>
  );
}
