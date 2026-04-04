import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Grid, Button,
  CircularProgress, Alert, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, Divider, TextField, MenuItem, Tabs, Tab,
} from '@mui/material';
import {
  Download as DownloadIcon, Refresh as RefreshIcon, Print as PrintIcon,
  Assessment, AccountBalance,
} from '@mui/icons-material';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const FINANCIAL_REPORTS = [
  { value: 'receivable', label: 'Accounts Receivable' },
  { value: 'group-pl', label: 'Group-wise P&L' },
];

const Reports = () => {
  const [tab, setTab] = useState(0); // 0=operational, 1=financial
  const [reportType, setReportType] = useState('monthly_collection');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Financial reports
  const [finType, setFinType] = useState('receivable');
  const [finData, setFinData] = useState(null);
  const [finLoading, setFinLoading] = useState(false);

  useEffect(() => { if (tab === 0) fetchReport(); }, [reportType, period, tab]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/admin/reports`, {
        params: { type: reportType, period },
      });
      if (res.data.success) setReport(res.data.data);
    } catch (err) {
      setError('Could not load report data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancial = async () => {
    setFinLoading(true); setError(null); setFinData(null);
    try {
      const res = await axios.get(`${API}/admin/accounting/${finType}`);
      setFinData(res.data.data);
    } catch (err) {
      setError('Could not load financial report.');
    } finally { setFinLoading(false); }
  };

  useEffect(() => { if (tab === 1) fetchFinancial(); }, [finType, tab]);

  const handleExport = () => {
    if (!report?.data?.length) return;
    const tableData = report.data;
    const headers = Object.keys(tableData[0]);
    const rows = tableData.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const summaryItems = report?.summary || [];
  const tableData = report?.data || [];
  const tableHeaders = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Typography variant="h4">Reports & Analytics</Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<Assessment />} label="Operational Reports" iconPosition="start" />
        <Tab icon={<AccountBalance />} label="Financial Reports" iconPosition="start" />
      </Tabs>

      {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}

      {/* OPERATIONAL REPORTS TAB */}
      {tab === 0 && (
        <>
          <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField select size="small" label="Report Type" value={reportType}
              onChange={e => setReportType(e.target.value)} sx={{ width: 220 }}>
              {[
                { value: 'monthly_collection', label: 'Monthly Collection' },
                { value: 'group_status', label: 'Group Status Report' },
                { value: 'overdue_payments', label: 'Overdue Payments' },
                { value: 'kyc_status', label: 'KYC Status Report' },
                { value: 'auction_summary', label: 'Auction Summary' },
                { value: 'members', label: 'New Members Report' },
              ].map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Period" type="month" value={period}
              onChange={e => setPeriod(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button startIcon={<RefreshIcon />} onClick={fetchReport}>Refresh</Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExport}
              disabled={!report?.data?.length}>Export CSV</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>Print</Button>
          </Box>

      {/* Summary Cards */}
      {summaryItems.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {summaryItems.map(({ label, value, color }) => (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Paper sx={{ p: 2.5, borderRadius: 3, borderLeft: `4px solid ${color || '#0B1F3B'}` }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h5" fontWeight={700}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Data Table */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {reportType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — {period}
          </Typography>
          <Divider sx={{ mb: 0 }} />
        </CardContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : tableData.length === 0 ? (
          <Box textAlign="center" py={6}>
            <Typography color="text.secondary">
              {error ? 'No data available.' : 'No report data for selected period.'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  {tableHeaders.map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                      {h.replace(/_/g, ' ')}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableData.map((row, i) => (
                  <TableRow key={i} hover>
                    {tableHeaders.map(h => (
                      <TableCell key={h}>{row[h] ?? '—'}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
        </>
      )}

      {/* FINANCIAL REPORTS TAB */}
      {tab === 1 && (
        <>
          <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField select size="small" label="Financial Report" value={finType}
              onChange={e => setFinType(e.target.value)} sx={{ width: 240 }}>
              {FINANCIAL_REPORTS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
            <Button startIcon={<RefreshIcon />} onClick={fetchFinancial}>Refresh</Button>
          </Box>

          {finLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
          ) : finData && finType === 'receivable' ? (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Accounts Receivable</Typography>
                <Divider sx={{ mb: 2 }} />
              </CardContent>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      {['Member / Party', 'Outstanding'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(finData.entries || []).length === 0 ? (
                      <TableRow><TableCell colSpan={2} align="center" sx={{ py: 6 }}>No receivables</TableCell></TableRow>
                    ) : (finData.entries || []).map((m, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{m.party || '-'}</TableCell>
                        <TableCell><Typography fontWeight={600} color={m.outstanding > 0 ? 'error.main' : 'success.main'}>{fmt(m.outstanding)}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              {finData.total_outstanding != null && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
                  <Typography fontWeight={700}>Total Outstanding: <span style={{ color: '#d32f2f' }}>{fmt(finData.total_outstanding)}</span></Typography>
                </Box>
              )}
            </Card>
          ) : finData && finType === 'group-pl' ? (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Group-wise Profit & Loss</Typography>
                <Divider sx={{ mb: 2 }} />
              </CardContent>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      {['Group', 'Income', 'Expenses', 'Profit'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(Array.isArray(finData) ? finData : (finData.groups || [])).length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>No data</TableCell></TableRow>
                    ) : (Array.isArray(finData) ? finData : (finData.groups || [])).map((g, i) => (
                      <TableRow key={i} hover>
                        <TableCell><Typography fontWeight={500}>{g.group?.group_name || g.group_name || '-'}</Typography></TableCell>
                        <TableCell><Typography color="success.main" fontWeight={600}>{fmt(g.income)}</Typography></TableCell>
                        <TableCell><Typography color="warning.main" fontWeight={600}>{fmt(g.expense)}</Typography></TableCell>
                        <TableCell><Typography fontWeight={700} color={g.profit >= 0 ? 'success.main' : 'error.main'}>{fmt(g.profit)}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Card>
          ) : null}
        </>
      )}
    </Container>
  );
};

export default Reports;

