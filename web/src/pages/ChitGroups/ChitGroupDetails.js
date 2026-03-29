import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Chip,
  CircularProgress, Button, Tabs, Tab, LinearProgress, Alert,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider,
  Paper, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, CheckCircle as CheckIcon, Error as OverdueIcon, Schedule as PendingIcon, PersonAdd as JoinIcon, CreditCard as PayIcon, Close as CloseIcon, Payment as PaymentIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const ChitGroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [snack, setSnack] = useState('');
  const [payDialog, setPayDialog] = useState({ open: false, item: null });
  const [paying, setPaying] = useState(false);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, mRes, sRes] = await Promise.all([
        axios.get(`/chit-groups/${id}`),
        axios.get(`/chit-groups/${id}/members`).catch(() => ({ data: { data: [] } })),
        axios.get(`/chit-groups/${id}/payment-schedule`).catch(() => ({ data: { data: [] } })),
      ]);
      if (gRes.data.success) setGroup(gRes.data.data);
      const memberList = mRes.data.success ? (mRes.data.data || []) : [];
      setMembers(memberList);
      if (sRes.data.success) setSchedule(sRes.data.data || []);
      // check if current user is already enrolled
      if (user?.id || user?._id) {
        const userId = String(user.id || user._id);
        const isEnrolled = memberList.some(m => {
          const mid = String(m.user_id?._id || m.user_id || m.user?._id || '');
          return mid === userId;
        });
        setEnrolled(isEnrolled);
      }
    } catch (err) {
      setError('Could not load group details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async (scheduleItem) => {
    if (!scheduleItem || paying) return;
    setPaying(true);
    try {
      const res = await axios.post('/payments/create-order', {
        chit_group_id: id,
        month_number: scheduleItem.month_number,
        amount: scheduleItem.amount,
        late_fee: 0,
      });
      if (!res.data.success) {
        toast?.error?.(res.data.message || 'Could not create payment order');
        setPaying(false);
        return;
      }
      const { payment_session_id, order_id, payment_id: newPaymentId } = res.data.data;
      if (payment_session_id && window.Cashfree) {
        try {
          const cashfree = window.Cashfree({ mode: process.env.REACT_APP_CASHFREE_ENV || 'sandbox' });
          setPayDialog({ open: false, item: null });
          await cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_modal' });
          const vRes = await axios.post('/payments/verify', { order_id, payment_id: newPaymentId });
          if (vRes.data.success && (vRes.data.data?.payment_status === 'success' || vRes.data.message === 'Already verified')) {
            toast?.success?.('Payment successful! ✓');
          }
          fetchAll();
        } catch (sdkErr) {
          toast?.error?.('Payment checkout failed.');
        }
      } else if (payment_session_id) {
        const isTest = !process.env.REACT_APP_CASHFREE_ENV || process.env.REACT_APP_CASHFREE_ENV === 'sandbox';
        const payUrl = isTest
          ? `https://payments-test.cashfree.com/order/#${payment_session_id}`
          : `https://payments.cashfree.com/order/#${payment_session_id}`;
        window.location.href = payUrl;
      } else {
        toast?.warning?.('Cashfree gateway not configured. Contact admin.');
      }
    } catch (err) {
      toast?.error?.('Could not initiate payment.');
    } finally {
      setPaying(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await axios.post(`/chit-groups/${id}/enroll`);
      if (res.data.success) {
        setEnrolled(true);
        setSnack('Successfully joined the chit group!');
        fetchAll();
      }
    } catch (err) {
      setSnack(err.response?.data?.message || 'Failed to join group.');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (error || !group) return (
    <Container sx={{ py: 4 }}>
      <Alert severity="error">{error || 'Group not found.'}</Alert>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/chit-groups')} sx={{ mt: 2 }}>Back</Button>
    </Container>
  );

  const progress = group.duration_months > 0
    ? Math.round(((group.current_month || 0) / group.duration_months) * 100) : 0;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/chit-groups')} sx={{ mb: 2 }}>
        Back to Chit Groups
      </Button>

      {/* Header Card */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1976d2, #1565c0)', p: 3, color: 'white', borderRadius: '12px 12px 0 0' }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5" fontWeight={700}>{group.group_name}</Typography>
              <Typography sx={{ opacity: 0.8 }}>{group.group_number}</Typography>
            </Box>
            <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
              <Chip label={group.status?.replace('_', ' ')}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, textTransform: 'capitalize' }} />
              {!enrolled && group.status === 'active' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<JoinIcon />}
                  onClick={handleEnroll}
                  disabled={enrolling}
                  sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' }, fontWeight: 700 }}
                >
                  {enrolling ? 'Joining…' : 'Join Group'}
                </Button>
              )}
              {enrolled && (
                <Chip label="✓ Enrolled" sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 600 }} />
              )}
            </Box>
          </Box>
          <Box mt={2}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Progress</Typography>
              <Typography variant="caption">{group.current_month || 0} / {group.duration_months} months</Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress}
              sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: '#fff' } }} />
          </Box>
        </Box>
        <CardContent>
          <Grid container spacing={2}>
            {[
              { label: 'Chit Value', value: `₹${Number(group.chit_value || 0).toLocaleString('en-IN')}` },
              { label: 'Monthly Installment', value: `₹${Number(group.monthly_installment || 0).toLocaleString('en-IN')}` },
              { label: 'Total Members', value: group.total_members || group.max_members || '—' },
              { label: 'Start Date', value: group.start_date ? new Date(group.start_date).toLocaleDateString('en-IN') : '—' },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography fontWeight={700}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label={`Members (${members.length})`} />
        <Tab label="Payment Schedule" />
      </Tabs>

      {/* Overview Tab */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Group Information</Typography>
                <Divider sx={{ mb: 2 }} />
                {[
                  { label: 'Duration', value: `${group.duration_months} months` },
                  { label: 'Auction Day', value: group.auction_day || '—' },
                  { label: 'Current Month', value: group.current_month || 0 },
                  { label: 'Remaining Months', value: (group.duration_months || 0) - (group.current_month || 0) },
                ].map(({ label, value }) => (
                  <Box key={label} display="flex" justifyContent="space-between" py={0.8}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Your Position</Typography>
                <Divider sx={{ mb: 2 }} />
                {[
                  { label: 'Status', value: group.member_status?.replace('_', ' ') || 'Active' },
                  { label: 'Total Paid', value: `₹${Number(group.total_paid || 0).toLocaleString('en-IN')}` },
                  { label: 'Outstanding', value: `₹${Number(group.outstanding || 0).toLocaleString('en-IN')}` },
                  { label: 'Chit Received', value: group.chit_received ? 'Yes ✅' : 'No' },
                ].map(({ label, value }) => (
                  <Box key={label} display="flex" justifyContent="space-between" py={0.8}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Members Tab */}
      {tab === 1 && (
        members.length === 0
          ? <Alert severity="info">No member data available.</Alert>
          : <Card sx={{ borderRadius: 3 }}>
            <List>
              {members.map((m, i) => (
                <React.Fragment key={m._id || i}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>{(m.user_id?.full_name || m.full_name || 'M')[0].toUpperCase()}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={m.user_id?.full_name || m.user?.full_name || m.full_name || `Member #${i + 1}`}
                      secondary={`Ticket #${m.ticket_number || i + 1} • ${m.user_id?.mobile || m.user?.mobile || m.mobile || ''}`}
                    />
                    {(m.has_won_auction || m.chit_received) && <Chip label="Prized" size="small" color="success" />}
                  </ListItem>
                  {i < members.length - 1 && <Divider inset="72px" />}
                </React.Fragment>
              ))}
            </List>
          </Card>
      )}

      {/* Schedule Tab */}
      {tab === 2 && (
        schedule.length === 0
          ? <Alert severity="info">Payment schedule not available yet.</Alert>
          : <Card sx={{ borderRadius: 3 }}>
            <List>
              {schedule.map((s, i) => {
                const isPaid = s.status === 'paid';
                const isOverdue = s.status === 'overdue';
                return (
                  <React.Fragment key={i}>
                    <ListItem>
                      <ListItemAvatar>
                        {isPaid
                          ? <Avatar sx={{ bgcolor: 'success.main' }}><CheckIcon /></Avatar>
                          : isOverdue
                          ? <Avatar sx={{ bgcolor: 'error.main' }}><OverdueIcon /></Avatar>
                          : <Avatar sx={{ bgcolor: 'grey.400' }}><PendingIcon /></Avatar>}
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box>
                            {`Month ${s.month_number} — ₹${Number(s.amount || 0).toLocaleString('en-IN')}`}
                            {s.dividend_reduction > 0 && (
                              <Typography component="span" variant="caption" color="success.main" sx={{ ml: 1 }}>
                                (₹{Number(s.dividend_reduction).toLocaleString('en-IN')} dividend applied)
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={s.due_date ? new Date(s.due_date).toLocaleDateString('en-IN') : '—'}
                      />
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={s.status || 'pending'}
                          size="small"
                          color={isPaid ? 'success' : isOverdue ? 'error' : 'default'}
                          sx={{ textTransform: 'capitalize' }}
                        />
                        {s.can_pay && (
                          <Button
                            size="small"
                            variant="contained"
                            color={isOverdue ? 'error' : 'primary'}
                            startIcon={<PayIcon />}
                            onClick={() => setPayDialog({ open: true, item: s })}
                          >
                            Pay Now
                          </Button>
                        )}
                      </Box>
                    </ListItem>
                    {i < schedule.length - 1 && <Divider inset="72px" />}
                  </React.Fragment>
                );
              })}
            </List>
          </Card>
      )}
      {/* Pay Now Dialog */}
      <Dialog open={payDialog.open} onClose={() => !paying && setPayDialog({ open: false, item: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Pay Installment
          {!paying && <IconButton size="small" onClick={() => setPayDialog({ open: false, item: null })}><CloseIcon /></IconButton>}
        </DialogTitle>
        <DialogContent>
          {payDialog.item && (
            <Box>
              <Typography variant="h4" textAlign="center" fontWeight={900} my={2} color="primary.main">
                ₹{Number(payDialog.item.amount || 0).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
                {group?.group_name} — Month {payDialog.item.month_number}
              </Typography>
              {payDialog.item.dividend_reduction > 0 && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Dividend of ₹{Number(payDialog.item.dividend_reduction).toLocaleString('en-IN')} applied. Base: ₹{Number(payDialog.item.base_amount).toLocaleString('en-IN')}
                </Alert>
              )}
              {payDialog.item.status === 'overdue' && (
                <Alert severity="warning" sx={{ mb: 2 }}>This payment is overdue. Late fee may apply.</Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">Due Date</Typography>
                  <Typography variant="body2" fontWeight={600}>{payDialog.item.due_date ? new Date(payDialog.item.due_date).toLocaleDateString('en-IN') : '—'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography fontWeight={700}>Total</Typography>
                  <Typography fontWeight={700} color="primary.main">₹{Number(payDialog.item.amount || 0).toLocaleString('en-IN')}</Typography>
                </Box>
              </Paper>
              <Alert severity="info" icon={<PaymentIcon />}>
                You will be redirected to Cashfree secure payment page.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog({ open: false, item: null })} disabled={paying}>Cancel</Button>
          <Button variant="contained" startIcon={paying ? <CircularProgress size={16} /> : <PayIcon />} onClick={() => handlePayNow(payDialog.item)} disabled={paying}>
            {paying ? 'Processing...' : 'Pay with Cashfree'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack('')}
        message={snack}
      />
    </Container>
  );
};

export default ChitGroupDetails;

