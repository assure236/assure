import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Chip,
  CircularProgress, Alert, Tabs, Tab, List, ListItem, ListItemText,
  ListItemAvatar, Avatar, Divider, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Paper, Tooltip, IconButton, TextField,
  Stepper, Step, StepLabel, LinearProgress,
} from '@mui/material';
import {
  CheckCircle as PaidIcon, Schedule as PendingIcon,
  Error as OverdueIcon, CreditCard as PayIcon,
  AccountBalance as BankIcon, Download as DownloadIcon,
  Receipt as ReceiptIcon, Warning as WarnIcon,
  TableChart as StatementIcon, Refresh as RefreshIcon,
  Payment as PaymentIcon, Close as CloseIcon,
  CheckCircleOutline as SuccessIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const statusConfig = {
  success: { color: 'success', icon: <PaidIcon />, bg: 'success.main' },
  failed: { color: 'error', icon: <OverdueIcon />, bg: 'error.main' },
  pending: { color: 'warning', icon: <PendingIcon />, bg: 'warning.main' },
  refunded: { color: 'info', icon: <PaidIcon />, bg: 'info.main' },
};

const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const Payments = () => {
  const [tab, setTab] = useState(0);
  const [payments, setPayments] = useState([]);
  const [duePayments, setDuePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payDialog, setPayDialog] = useState({ open: false, payment: null });
  const [paymentStep, setPaymentStep] = useState(0); // 0=idle 1=creating 2=paying 3=verifying 4=done
  const [paymentResult, setPaymentResult] = useState(null); // {success, message}
  const [lateFeeInfo, setLateFeeInfo] = useState({});
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [histRes, dueRes] = await Promise.allSettled([
        axios.get('/payments/my-payments'),
        axios.get('/payments/due-payments'),
      ]);
      if (histRes.status === 'fulfilled' && histRes.value.data.success) {
        setPayments(histRes.value.data.data.all || histRes.value.data.data.payments || []);
      }
      if (dueRes.status === 'fulfilled' && dueRes.value.data.success) {
        setDuePayments(dueRes.value.data.data || []);
      }
    } catch (err) {
      setError('Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: check if returning from Cashfree payment page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    const paymentId = params.get('payment_id');
    if (orderId) {
      window.history.replaceState({}, '', '/payments');
      verifyPaymentOrder(orderId, paymentId).then(fetchPayments);
    } else {
      fetchPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyPaymentOrder = async (orderId, paymentId) => {
    setPaymentStep(3);
    try {
      const res = await axios.post('/payments/verify', { order_id: orderId, payment_id: paymentId });
      if (res.data.success) {
        const payStatus = res.data.data?.payment_status;
        if (payStatus === 'success' || payStatus === 'paid' || res.data.message === 'Already verified') {
          setPaymentResult({ success: true, message: 'Payment successful! Your receipt will appear below.' });
          toast.success('Payment confirmed ✓');
        } else {
          setPaymentResult({ success: null, message: `Payment status: ${payStatus || 'Pending'}. We will notify you once confirmed.` });
          toast.info('Payment pending confirmation');
        }
      } else {
        const orderStatus = res.data.data?.order_status;
        if (orderStatus === 'PAID') {
          setPaymentResult({ success: true, message: 'Payment successful!' });
        } else {
          setPaymentResult({ success: false, message: res.data.message || 'Payment failed. Please try again.' });
          toast.error('Payment not completed');
        }
      }
    } catch {
      setPaymentResult({ success: null, message: 'Could not verify payment automatically. Check your payment history below.' });
    }
    setPaymentStep(4);
  };

  const handleInitiatePayment = async (payment) => {
    if (!payment) return;
    setPaymentStep(1);

    try {
      const groupId = typeof payment.chit_group_id === 'object' ? (payment.chit_group_id?._id || payment.chit_group_id) : (payment.chit_group_id || payment.chitGroup?._id || payment.chit_group?._id);
      const res = await axios.post('/payments/create-order', {
        chit_group_id: groupId,
        month_number: payment.month_number,
        amount: payment.amount,
        late_fee: payment.late_fee || lateFeeInfo[payment.id]?.late_fee || 0,
      });

      if (!res.data.success) {
        toast.error(res.data.message || 'Could not create payment order');
        setPaymentStep(0);
        return;
      }

      const { payment_session_id, order_id, payment_id: newPaymentId, total_amount } = res.data.data;
      setPaymentStep(2);

      if (payment_session_id && window.Cashfree) {
        try {
          const cashfree = window.Cashfree({
            mode: (process.env.REACT_APP_CASHFREE_ENV || 'sandbox'),
          });
          setPayDialog({ ...payDialog, open: false });
          await cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_modal' });
          // After modal closes, verify
          await verifyPaymentOrder(order_id, newPaymentId);
          await fetchPayments();
        } catch (sdkErr) {
          console.error('Cashfree checkout error:', sdkErr);
          toast.error('Payment checkout failed. Please try again.');
          setPaymentStep(0);
        }
      } else if (payment_session_id) {
        // SDK not loaded — redirect to hosted payment page
        setPayDialog({ ...payDialog, open: false });
        const isTest = !process.env.REACT_APP_CASHFREE_ENV || process.env.REACT_APP_CASHFREE_ENV === 'sandbox';
        const payUrl = isTest
          ? `https://payments-test.cashfree.com/order/#${payment_session_id}`
          : `https://payments.cashfree.com/order/#${payment_session_id}`;
        window.location.href = payUrl;
      } else {
        toast.warning('Cashfree gateway not configured. Contact your admin.');
        setPaymentStep(0);
      }
    } catch (err) {
      toast.error('Could not initiate payment. Please try again.');
      setPaymentStep(0);
    }
  };

  const handleDownloadReceipt = (paymentId) => {
    window.open(`${axios.defaults.baseURL}/payments/receipt/${paymentId}`, '_blank');
  };

  const handleDownloadStatement = async () => {
    setDownloadingStatement(true);
    try {
      const res = await axios.get('/payments/statement?format=csv', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'account_statement.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Statement downloaded!');
    } catch {
      toast.error('Could not download statement.');
    } finally {
      setDownloadingStatement(false);
    }
  };

  const historyPayments = payments.filter(p => p.payment_status === 'success' || p.payment_status === 'refunded');
  const overdueList = duePayments.filter(p => p.payment_status === 'overdue');
  const totalPaid = historyPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalUpcoming = duePayments.reduce((s, p) => s + Number(p.total_amount || p.amount || 0), 0);
  const totalPaidLateFees = historyPayments.reduce((s, p) => s + Number(p.late_fee || 0), 0);

  const tabList = [
    { label: `History (${historyPayments.length})`, data: historyPayments },
    { label: `Upcoming (${duePayments.length})`, data: duePayments },
  ];

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h4" fontWeight={700}>Payments</Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchPayments}><RefreshIcon /></IconButton>
          </Tooltip>
          <Button
            variant="outlined" startIcon={downloadingStatement ? <CircularProgress size={16} /> : <StatementIcon />}
            onClick={handleDownloadStatement} disabled={downloadingStatement}
          >
            CSV
          </Button>
          <Button
            variant="contained" startIcon={<StatementIcon />}
            onClick={() => window.open(`${axios.defaults.baseURL}/payments/statement?format=html`, '_blank')}
          >
            Statement
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {paymentResult && (
        <Alert
          severity={paymentResult.success === true ? 'success' : paymentResult.success === false ? 'error' : 'info'}
          sx={{ mb: 2 }}
          action={<IconButton size="small" onClick={() => setPaymentResult(null)}><CloseIcon fontSize="inherit" /></IconButton>}
        >
          {paymentResult.message}
        </Alert>
      )}

      {overdueList.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarnIcon />}>
          You have <strong>{overdueList.length}</strong> overdue payment{overdueList.length > 1 ? 's' : ''} totaling{' '}
          <strong>{formatCurrency(overdueList.reduce((s, p) => s + Number(p.amount || 0), 0))}</strong>.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Total Paid', value: formatCurrency(totalPaid), color: '#1976d2', icon: <PaidIcon /> },
          { label: 'Upcoming Due', value: formatCurrency(totalUpcoming), color: '#ff9800', icon: <PendingIcon /> },
          { label: 'Overdue Amount', value: formatCurrency(overdueList.reduce((s, p) => s + Number(p.amount || 0), 0)), color: '#f44336', icon: <OverdueIcon /> },
          { label: 'Late Fees Paid', value: formatCurrency(totalPaidLateFees), color: '#9c27b0', icon: <WarnIcon /> },
        ].map(({ label, value, color, icon }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Paper sx={{ p: 2, borderRadius: 3, borderLeft: `4px solid ${color}` }}>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Box sx={{ color }}>{icon}</Box>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </Box>
              <Typography variant="h6" fontWeight={700} color={color}>{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        {tabList.map((t, i) => <Tab key={i} label={t.label} />)}
      </Tabs>

      {tabList[tab].data.length === 0 ? (
        <Box textAlign="center" py={8}>
          <BankIcon sx={{ fontSize: 64, color: 'grey.300' }} />
          <Typography color="text.secondary" mt={1}>
            {tab === 0 ? 'No payment history yet.' : 'No upcoming payments.'}
          </Typography>
        </Box>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <List disablePadding>
            {tabList[tab].data.map((p, i) => {
              const status = p.payment_status || 'pending';
              const cfg = statusConfig[status] || statusConfig.pending;
              const isOverdue = status === 'overdue' || (status === 'pending' && p.due_date && new Date(p.due_date) < new Date());
              const lateFee = Number(p.late_fee || lateFeeInfo[p._id]?.late_fee || 0);
              const group = p.chitGroup || p.chit_group;

              return (
                <React.Fragment key={p._id || i}>
                  <ListItem
                    alignItems="flex-start"
                    sx={{ py: 2 }}
                    secondaryAction={
                      <Box display="flex" gap={1} alignItems="center">
                        {(status === 'success' || status === 'refunded') && p._id && (
                          <Tooltip title="Download Receipt">
                            <IconButton size="small" color="primary" onClick={() => handleDownloadReceipt(p._id)}>
                              <ReceiptIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {status !== 'success' && status !== 'refunded' && (
                          <Button
                            size="small" variant="contained"
                            color={isOverdue ? 'error' : 'primary'}
                            startIcon={<PayIcon />}
                            onClick={() => setPayDialog({ open: true, payment: p })}
                          >
                            Pay Now
                          </Button>
                        )}
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: isOverdue ? 'error.main' : cfg.bg }}>
                        {isOverdue ? <OverdueIcon /> : cfg.icon}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="body1" fontWeight={700}>
                            {formatCurrency(p.amount)}
                          </Typography>
                          {lateFee > 0 && (
                            <Chip label={`+${formatCurrency(lateFee)} late fee`} size="small" color="error" variant="outlined" />
                          )}
                          <Chip
                            label={isOverdue ? 'OVERDUE' : status}
                            size="small"
                            color={isOverdue ? 'error' : cfg.color}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          {group?.group_name && (
                            <Typography variant="caption" display="block">
                              {group.group_name} — Month {p.month_number}
                            </Typography>
                          )}
                          <Typography variant="caption" color={isOverdue ? 'error.main' : 'text.secondary'}>
                            {status === 'success'
                              ? `Paid on ${formatDate(p.payment_date)}`
                              : `Due: ${formatDate(p.due_date)}${p.days_overdue > 0 ? ` (${p.days_overdue} days overdue)` : ''}`}
                          </Typography>
                          {p.receipt_number && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              Receipt: {p.receipt_number}
                            </Typography>
                          )}
                          {p.payment_number && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              Ref: {p.payment_number}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  {i < tabList[tab].data.length - 1 && <Divider inset="72px" />}
                </React.Fragment>
              );
            })}
          </List>
        </Card>
      )}

      {/* Pay Now Dialog */}
      <Dialog
        open={payDialog.open}
        onClose={() => paymentStep === 0 || paymentStep === 4 ? setPayDialog({ open: false, payment: null }) : null}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Pay Installment
          {(paymentStep === 0 || paymentStep === 4) && (
            <IconButton size="small" onClick={() => setPayDialog({ open: false, payment: null })}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          {paymentStep === 0 && payDialog.payment && (
            <Box>
              <Typography variant="h4" textAlign="center" fontWeight={900} my={2} color="primary.main">
                {formatCurrency(payDialog.payment.total_amount || payDialog.payment.amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
                {(payDialog.payment.chit_group || payDialog.payment.chitGroup)?.group_name} — Month {payDialog.payment.month_number}
              </Typography>
              {payDialog.payment.late_fee > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }} icon={<WarnIcon />}>
                  Includes late fee of {formatCurrency(payDialog.payment.late_fee)}
                </Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">Base Amount</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatCurrency(payDialog.payment.amount)}</Typography>
                </Box>
                {payDialog.payment.late_fee > 0 && (
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="error.main">Late Fee</Typography>
                    <Typography variant="body2" color="error.main" fontWeight={600}>{formatCurrency(payDialog.payment.late_fee)}</Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                <Box display="flex" justifyContent="space-between">
                  <Typography fontWeight={700}>Total</Typography>
                  <Typography fontWeight={700} color="primary.main">
                    {formatCurrency(payDialog.payment.total_amount || payDialog.payment.amount)}
                  </Typography>
                </Box>
              </Paper>
              <Alert severity="info" icon={<PaymentIcon />}>
                You will be redirected to Cashfree secure payment page. UPI, Net Banking, Cards & EMI accepted.
              </Alert>
            </Box>
          )}

          {(paymentStep === 1 || paymentStep === 2 || paymentStep === 3) && (
            <Box textAlign="center" py={3}>
              <CircularProgress size={56} sx={{ mb: 2 }} />
              <Typography fontWeight={600}>
                {paymentStep === 1 ? 'Creating payment order...' :
                  paymentStep === 2 ? 'Opening payment page...' :
                    'Verifying payment...'}
              </Typography>
              <LinearProgress sx={{ mt: 2, borderRadius: 2 }} />
            </Box>
          )}

          {paymentStep === 4 && paymentResult && (
            <Box textAlign="center" py={2}>
              {paymentResult.success === true ? (
                <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
              ) : paymentResult.success === false ? (
                <OverdueIcon sx={{ fontSize: 64, color: 'error.main', mb: 1 }} />
              ) : (
                <PendingIcon sx={{ fontSize: 64, color: 'warning.main', mb: 1 }} />
              )}
              <Typography variant="h6" fontWeight={700} mb={1}>
                {paymentResult.success === true ? 'Payment Successful!' :
                  paymentResult.success === false ? 'Payment Failed' : 'Payment Pending'}
              </Typography>
              <Typography color="text.secondary">{paymentResult.message}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {paymentStep === 0 && (
            <>
              <Button onClick={() => setPayDialog({ open: false, payment: null })}>Cancel</Button>
              <Button
                variant="contained"
                startIcon={<PayIcon />}
                onClick={() => handleInitiatePayment(payDialog.payment)}
              >
                Pay with Cashfree
              </Button>
            </>
          )}
          {paymentStep === 4 && (
            <Button
              fullWidth
              variant="contained"
              onClick={() => { setPayDialog({ open: false, payment: null }); setPaymentStep(0); setPaymentResult(null); }}
            >
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Payments;
