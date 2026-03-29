import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Grid, Button,
  CircularProgress, Alert, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, Divider, TextField, MenuItem
} from '@mui/material';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import axios from 'axios';

const Reports = () => {
  const [reportType, setReportType] = useState('monthly_collection');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchReport(); }, [reportType, period]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/reports`, {
        params: { type: reportType, period },
      });
      if (res.data.success) setReport(res.data.data);
    } catch (err) {
      setError('Could not load report data. Ensure the backend /admin/reports endpoint is implemented.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const url = `${process.env.REACT_APP_API_URL}/admin/reports/export?type=${reportType}&period=${period}`;
    window.open(url, '_blank');
  };

  const summaryItems = report?.summary || [];
  const tableData = report?.data || [];
  const tableHeaders = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h4">Reports & Analytics</Typography>
        <Box display="flex" gap={2} alignItems="center">
          <TextField select size="small" label="Report Type" value={reportType}
            onChange={e => setReportType(e.target.value)} sx={{ width: 220 }}>
            {[
              { value: 'monthly_collection', label: 'Monthly Collection' },
              { value: 'group_status', label: 'Group Status Report' },
              { value: 'overdue_payments', label: 'Overdue Payments' },
              { value: 'kyc_status', label: 'KYC Status Report' },
              { value: 'auction_summary', label: 'Auction Summary' },
            ].map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Period" type="month" value={period}
            onChange={e => setPeriod(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button startIcon={<RefreshIcon />} onClick={fetchReport}>Refresh</Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExport}>
            Export CSV
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Summary Cards */}
      {summaryItems.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {summaryItems.map(({ label, value, color }) => (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Paper sx={{ p: 2.5, borderRadius: 3, borderLeft: `4px solid ${color || '#1976d2'}` }}>
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
    </Container>
  );
};

export default Reports;

